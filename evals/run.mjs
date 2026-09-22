import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { cases, routingTools } from './cases.mjs';
import { createHost, runCase, skillDigest } from './runtime.mjs';

const { values } = parseArgs({ options: {
  suite: { type: 'string', default: 'behavior' }, skills: { type: 'string', default: fileURLToPath(new URL('../skills', import.meta.url)) },
  baseline: { type: 'string' }, 'no-skills-control': { type: 'boolean', default: false },
  case: { type: 'string', multiple: true }, skill: { type: 'string' }, repeat: { type: 'string', default: '1' }, jobs: { type: 'string', default: '1' },
  provider: { type: 'string', default: 'openai-codex' }, model: { type: 'string', default: 'gpt-6-astra' }, thinking: { type: 'string', default: 'max' },
  profile: { type: 'string' }, auth: { type: 'string' }, out: { type: 'string' }, timeout: { type: 'string', default: '300000' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('Run native Pi skill evaluations. Requires configured model access.\n\nnode evals/run.mjs [--suite behavior|routing|held-out] [--skills PATH] [--baseline PATH]\n  [--no-skills-control] [--case ID ...] [--skill NAME] [--repeat N] [--jobs N]\n  [--provider openai-codex|openai] [--model ID] [--thinking LEVEL]\n  [--profile FILE] [--auth FILE] [--out JSONL] [--timeout MS]\n\nPI_HOST_INDEX selects another installed Pi SDK; each host keeps its own dependencies.\nReports contain synthetic task outputs and tool traces, never headers or credentials.');
  process.exit(0);
}
assert(['behavior', 'routing', 'held-out'].includes(values.suite), 'Unknown suite');
const repeat = Number(values.repeat), timeoutMs = Number(values.timeout), jobs = Number(values.jobs);
assert(Number.isSafeInteger(repeat) && repeat > 0, 'repeat must be a positive integer');
assert(Number.isSafeInteger(jobs) && jobs > 0 && jobs <= 8, 'jobs must be an integer from 1 to 8');
assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'timeout must be positive milliseconds');
assert(!(values.suite !== 'behavior' && values['no-skills-control']), 'No-skills controls measure task quality, not skill selection');
const skillsDir = resolve(values.skills);
let selected = cases;
if (values.suite === 'routing') {
  selected = [];
  for (const skill of (await readdir(skillsDir)).sort()) {
    const file = join(skillsDir, skill, 'evals', 'trigger-evals.json');
    let prompts;
    try { prompts = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    selected.push(...prompts.map((entry, index) => ({ id: `${skill}:${index + 1}`, skill, mode: 'routing', prompt: entry.query, shouldTrigger: entry.should_trigger, tools: routingTools })));
  }
}
if (values.suite === 'held-out') selected = JSON.parse(await readFile(new URL('./held-out.json', import.meta.url), 'utf8')).map((entry, index) => ({
  id: `held-out:${index + 1}`, skill: entry.skill, mode: 'routing', prompt: entry.query, shouldTrigger: entry.should_trigger, tools: routingTools,
}));
if (values.skill) selected = selected.filter(item => item.skill === values.skill);
if (values.case) {
  for (const id of values.case) assert(selected.some(item => item.id === id), `Unknown case: ${id}`);
  selected = selected.filter(item => values.case.includes(item.id));
}
assert(selected.length > 0, 'No evaluation cases selected');
const host = await createHost({ provider: values.provider, modelId: values.model, authPath: values.auth });
assert(host.model.thinkingLevelMap?.[values.thinking] != null, `Unsupported thinking level: ${values.thinking}`);
const available = await host.modelRuntime.getAvailable(values.provider, { signal: AbortSignal.timeout(15000) });
assert(available.some(model => model.id === values.model), `Authentication unavailable for ${values.provider}/${values.model}`);
const profile = values.profile ? await readFile(values.profile, 'utf8') : '';
const harnessDigest = async () => createHash('sha256').update((await Promise.all(['run.mjs', 'runtime.mjs', 'cases.mjs', 'held-out.json'].map(file => readFile(new URL(file, import.meta.url))))).join('\0')).digest('hex');
const harnessSha256 = await harnessDigest();
const variants = [
  ...(values.baseline ? [{ name: 'baseline', skillsDir: resolve(values.baseline) }] : []),
  ...(values['no-skills-control'] ? [{ name: 'no-skills', skillsDir, withoutSkills: true }] : []),
  { name: 'candidate', skillsDir },
];
for (const variant of variants) variant.digest = await skillDigest(variant.skillsDir);
const output = resolve(values.out ?? `.eval-results/${new Date().toISOString().replaceAll(':', '-')}-${process.pid}.jsonl`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, '', { flag: 'wx' });
let writes = Promise.resolve();
const emit = value => (writes = writes.then(() => appendFile(output, `${JSON.stringify(value)}\n`)));
await emit({ type: 'run', startedAt: new Date().toISOString(), host: host.identity, suite: values.suite, thinking: values.thinking, repeat, jobs, timeoutMs,
  harnessSha256, profileSha256: createHash('sha256').update(profile).digest('hex'), cases: selected.map(item => item.id), variants });
const results = [];
const pending = Array.from({ length: repeat }, (_, iteration) => selected.map(testCase => ({ iteration, testCase }))).flat();
await Promise.all(Array.from({ length: jobs }, async () => {
  while (pending.length) {
    const { iteration, testCase } = pending.shift();
    for (const variant of iteration % 2 ? [...variants].reverse() : variants) {
      const record = await runCase(host, testCase, { ...variant, thinking: values.thinking, timeoutMs, profile,
        artifactDir: `${output}.artifacts/${variant.name}/${iteration + 1}/${testCase.id.replaceAll(/[^a-zA-Z0-9_.-]/g, '-')}` });
      Object.assign(record, { type: 'case', variant: variant.name, iteration: iteration + 1 });
      results.push(record); await emit(record);
      console.log(`${record.passed ? 'PASS' : 'FAIL'} ${variant.name} ${testCase.id} #${iteration + 1}${record.failure ? `: ${record.failure}` : ''}`);
      assert.equal(record.skillsDigest, variant.digest, 'Source changed between cases; discard this comparison');
    }
  }
}));
const summary = Object.fromEntries(variants.map(variant => {
  const rows = results.filter(row => row.variant === variant.name);
  return [variant.name, { passed: rows.filter(row => row.passed).length, total: rows.length,
    tokens: rows.reduce((sum, row) => sum + (row.usage?.tokens.total ?? 0), 0),
    elapsedMs: rows.reduce((sum, row) => sum + row.elapsedMs, 0),
    toolCalls: rows.reduce((sum, row) => sum + row.events.filter(event => event.type === 'call').length, 0) }];
}));
assert.equal(await harnessDigest(), harnessSha256, 'Evaluation code changed during the run; discard this comparison');
await emit({ type: 'summary', summary });
console.log(JSON.stringify({ output, summary }, null, 2));
if (results.some(row => row.variant === 'candidate' && !row.passed)) process.exitCode = 1;
