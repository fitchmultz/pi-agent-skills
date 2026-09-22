import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHost, runCase, zeroUsage } from '../evals/runtime.mjs';
import { cases } from '../evals/cases.mjs';

const skillsDir = fileURLToPath(new URL('../skills', import.meta.url));
const call = (name, args) => ({ content: [{ type: 'toolCall', id: `fixture-${name}`, name, arguments: args }], stopReason: 'toolUse' });
const answer = text => ({ content: [{ type: 'text', text }], stopReason: 'stop' });

async function scriptedHost(t, steps) {
  const dir = await mkdtemp(join(tmpdir(), 'pi-eval-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const host = await createHost({ provider: 'openai', authPath: join(dir, 'auth.json') });
  await host.modelRuntime.setRuntimeApiKey('openai', 'fixture-key-never-sent');
  const aiPackagePath = findPackageJSON('@earendil-works/pi-ai', pathToFileURL(host.identity.sdk));
  const aiPackage = JSON.parse(await readFile(aiPackagePath, 'utf8'));
  const { createAssistantMessageEventStream } = await import(new URL(aiPackage.exports['.'].import, pathToFileURL(aiPackagePath)));
  const contexts = [];
  t.mock.method(host.modelRuntime, 'streamSimple', (model, context, options) => {
    contexts.push(JSON.stringify(context));
    const stream = createAssistantMessageEventStream();
    const message = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage: zeroUsage, timestamp: Date.now() };
    const fail = error => stream.push({ type: 'error', reason: error.stopReason ?? 'error', error: { ...message, ...error } });
    queueMicrotask(async () => {
      try {
        if (options.signal?.aborted) { fail({ stopReason: 'aborted', errorMessage: 'Fixture aborted' }); return; }
        await options.onPayload?.({ model: model.id, tools: [] });
        const step = steps.shift();
        assert(step, 'Unexpected provider request');
        if (step.waitForAbort) {
          options.signal.addEventListener('abort', () => fail({ stopReason: 'aborted', errorMessage: 'Fixture aborted' }), { once: true });
          return;
        }
        Object.assign(message, step);
        stream.push({ type: 'start', partial: message });
        if (step.stopReason === 'error') fail(step);
        else stream.push({ type: 'done', reason: message.stopReason, message });
      } catch (error) { fail({ stopReason: 'error', errorMessage: error.message }); }
    });
    return stream;
  });
  return { host, contexts };
}

test('native evaluation asks, writes and verifies the same real fixture', async t => {
  const { host, contexts } = await scriptedHost(t, [
    call('read', { path: 'config.json' }),
    call('ask_question', { question: 'CSV or JSON?', options: ['CSV', 'JSON'] }),
    call('write', { path: 'config.json', content: '{"format":"CSV"}\n' }),
    answer('Saved CSV.'),
  ]);
  const result = await runCase(host, cases.find(item => item.id === 'clarify-and-continue'), { skillsDir });
  assert.equal(result.passed, true, result.failure);
  assert.equal(JSON.parse(result.files['config.json']).format, 'CSV');
  assert.equal(result.events.filter(event => event.type === 'result' && event.isError).length, 0);
  assert.equal(result.requests.length, 4);
  assert(contexts[0].includes('Resolve only') || contexts[0].includes('Ask Clarifying Questions'), 'Native /skill expansion must reach the model');
  assert(contexts.at(-1).includes('User answered: CSV'), 'Real tool results must return through the native session');
});

test('native command execution records a real RED/GREEN regression', async t => {
  const selected = cases.find(item => item.id === 'tdd-reachable-regression');
  const { host } = await scriptedHost(t, [
    call('ls', { path: 'test' }),
    call('write', { path: 'test/greet.test.mjs', content: selected.files['test/greet.test.mjs'] + "test('trims whitespace', () => assert.equal(greet(' Ada '), 'Hello Ada'));\n" }),
    call('bash', { command: 'npm test' }),
    call('edit', { path: 'src/greet.js', edits: [{ oldText: '${name}', newText: '${name.trim()}' }] }),
    call('bash', { command: 'npm test' }),
    answer('Regression failed before the fix and passes afterward.'),
  ]);
  const result = await runCase(host, selected, { skillsDir });
  assert.equal(result.passed, true, result.failure);
  assert.deepEqual(result.commands.map(command => command.exitCode), [1, 0]);
});

test('dogfood can write its evidence report without editing application files', async t => {
  const { host } = await scriptedHost(t, [
    call('agent_browser', { args: ['open', 'http://fixture.local/settings'] }),
    call('agent_browser', { args: ['snapshot', '-i'] }),
    call('agent_browser', { args: ['click', '@e1'] }),
    call('agent_browser', { args: ['screenshot', '.dogfood/save.png'] }),
    call('read', { path: '.dogfood/save.png' }),
    call('write', { path: 'report.md', content: '# Save failure\n\nSave failed after clicking the button. Evidence: .dogfood/save.png\n' }),
    answer('Save failed. Report: report.md; screenshot: .dogfood/save.png.'),
  ]);
  const result = await runCase(host, cases.find(item => item.id === 'dogfood-captures-evidence'), { skillsDir });
  assert.equal(result.passed, true, result.failure);
  assert.match(result.files['report.md'], /Save failed/);
  assert.deepEqual(result.violations, []);
});

test('documentation completion evidence records the actual checked files and diff', async t => {
  const selected = cases.find(item => item.id === 'verify-honest-gap');
  const { host } = await scriptedHost(t, [
    call('read', { path: 'evidence.json' }),
    call('read', { path: 'docs/install.md' }),
    call('read', { path: 'test/docs.test.mjs' }),
    call('bash', { command: 'git diff' }),
    answer(JSON.stringify({ status: 'complete', verified: ['Installation documentation updated; documentation check passed.'], unverified: ['Live installation was not tested.'] })),
  ]);
  const result = await runCase(host, { ...selected, check: async (record, context) => {
    selected.check(record, context);
    const evidence = JSON.parse(await readFile(join(context.cwd, 'evidence.json'), 'utf8'));
    const validation = evidence.validation[0];
    assert.equal(validation.command, 'node --test test/docs.test.mjs');
    assert.equal(validation.exitCode, 0);
    assert.match(validation.output, /pass 1/);
    assert.match(validation.output, /fail 0/);
    assert.equal(validation.inspected, true);
    assert.deepEqual(Object.keys(validation.inputSha256).sort(), ['docs/install.md', 'package.json', 'test/docs.test.mjs']);
    for (const [path, sha256] of Object.entries(validation.inputSha256)) {
      assert.equal(sha256, createHash('sha256').update(await readFile(join(context.cwd, path))).digest('hex'));
    }
    const git = args => execFileSync('git', args, { cwd: context.cwd, encoding: 'utf8' });
    assert.equal(evidence.git.head, git(['rev-parse', 'HEAD']).trim());
    assert.equal(evidence.git.status, git(['status', '--short']));
    assert.equal(evidence.git.diff, git(['diff']));
    assert.equal(git(['diff', '--name-only']).trim(), 'docs/install.md');
    assert.equal(evidence.liveInstallTested, false);
    assert.equal(evidence.codeChanges, false);
  } }, { skillsDir });
  assert.equal(result.passed, true, result.failure);
  assert.equal(result.events.filter(event => event.type === 'result' && event.isError).length, 0);
});

test('manual-only skills expand explicitly and disappear from no-skills controls', async t => {
  const selected = cases.find(item => item.id === 'plain-language');
  for (const withoutSkills of [false, true]) {
    const { host, contexts } = await scriptedHost(t, [answer('We will test the background tasks.')]);
    const result = await runCase(host, selected, { skillsDir, withoutSkills });
    assert.equal(result.passed, true, result.failure);
    assert.equal(contexts[0].includes('Stop using jargon and speak coherently.'), !withoutSkills);
    assert.equal(contexts[0].includes('<name>bro</name>'), false, 'bro stays hidden from automatic skill discovery');
  }
});

test('routing stops at a real skill read and records an incorrect non-read choice', async t => {
  const selected = { id: 'route', skill: 'handoff', mode: 'routing', shouldTrigger: true, prompt: 'Write a continuation handoff.' };
  const good = await scriptedHost(t, [{ stopReason: 'toolUse', content: [
    ...call('write', { path: 'unexpected.txt', content: 'routing actions stay inert' }).content,
    ...call('read', { path: join(skillsDir, 'handoff/SKILL.md') }).content,
  ] }]);
  const result = await runCase(good.host, selected, { skillsDir });
  assert.equal(result.passed, true, result.failure);
  assert.deepEqual(result.skillsRead, ['handoff']);
  const bad = await scriptedHost(t, [call('write', { path: 'unexpected.txt', content: 'must not be written' })]);
  const missed = await runCase(bad.host, selected, { skillsDir });
  assert.equal(missed.passed, false);
  assert.match(missed.failure, /Routing mismatch/);
  assert.deepEqual(missed.files, {});
});

test('listing skill resources hides graders without recording a violation', async t => {
  const { host } = await scriptedHost(t, [call('ls', { path: join(skillsDir, 'tdd') }), answer('Listed the references.')]);
  const result = await runCase(host, { id: 'listing', skill: 'tdd', prompt: 'List skill resources.', check() {} }, { skillsDir });
  assert.equal(result.passed, true, result.failure);
  const listing = result.events.find(event => event.type === 'result' && event.tool === 'ls');
  assert.match(listing.text, /SKILL.md/);
  assert.doesNotMatch(listing.text, /evals/);
});

test('native image reads retain verifiable artifacts outside the temporary workspace', async t => {
  const artifactDir = await mkdtemp(join(tmpdir(), 'pi-eval-images-'));
  t.after(() => rm(artifactDir, { recursive: true, force: true }));
  const { host } = await scriptedHost(t, [call('read', { path: 'pixel.png' }), answer('Image inspected.')]);
  const result = await runCase(host, { id: 'image', skill: 'diagram-creation', prompt: 'Inspect pixel.png.',
    setup: ({ put }) => put('pixel.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')),
    check: r => assert(r.events.some(event => event.type === 'result' && event.images === 1)),
  }, { skillsDir, artifactDir });
  assert.equal(result.passed, true, result.failure);
  assert.equal(result.images.length, 1);
  assert.equal((await readFile(result.images[0].path)).length, result.images[0].bytes);
});

test('provider errors, unfinished output and deadlines cannot pass a permissive grader', async t => {
  const selected = { id: 'failure', skill: 'handoff', prompt: 'Say hello.', check() {} };
  for (const step of [
    { ...answer(''), stopReason: 'error', errorMessage: 'Fixture provider failure' },
    { ...answer('partial'), stopReason: 'length' },
    { waitForAbort: true },
  ]) {
    const { host } = await scriptedHost(t, [step]);
    const result = await runCase(host, selected, { skillsDir, timeoutMs: 100 });
    assert.equal(result.passed, false, JSON.stringify(result));
    assert.match(result.failure, /Fixture provider failure|did not finish|deadline|Unexpected provider request/);
  }
});

test('out-of-scope fixture writes fail even when the model later claims success', async t => {
  const { host } = await scriptedHost(t, [call('write', { path: 'other.txt', content: 'unexpected' }), answer('Done.')]);
  const result = await runCase(host, { id: 'boundary', skill: 'handoff', prompt: 'Do nothing.', check() {} }, { skillsDir });
  assert.equal(result.passed, false);
  assert.match(result.failure, /out-of-scope/);
  assert.equal(result.violations.length, 1);
});
