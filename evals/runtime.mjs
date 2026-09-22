import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const inside = (root, path) => { const p = relative(root, path); return p === '' || (!p.startsWith(`..${sep}`) && p !== '..' && !isAbsolute(p)); };
export const zeroUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

export async function skillDigest(root) {
  const digest = createHash('sha256');
  async function visit(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else { digest.update(relative(root, path)); digest.update('\0'); digest.update(await readFile(path)); }
    }
  }
  await visit(root);
  return digest.digest('hex');
}

export async function createHost({ index = process.env.PI_HOST_INDEX, provider = 'openai-codex', modelId = 'gpt-6-astra', authPath } = {}) {
  const url = index ? pathToFileURL(resolve(index)).href : import.meta.resolve('@earendil-works/pi-coding-agent');
  const root = await realpath(fileURLToPath(new URL('..', url)));
  assert.equal(await realpath(fileURLToPath(url)), join(root, 'dist', 'index.js'), 'Select the native SDK index, not a CLI or another package');
  process.env.PI_PACKAGE_DIR = root;
  const sdk = await import(url);
  const resourceRoot = await realpath(sdk.getPackageDir());
  assert.equal(resourceRoot, root, 'Native SDK resources must belong to the selected host');
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const modelRuntime = await sdk.ModelRuntime.create({ authPath: authPath ?? join(sdk.getAgentDir(), 'auth.json'), modelsPath: null, refreshOnCreate: false });
  const model = modelRuntime.getModel(provider, modelId);
  assert(model, `Model unavailable in this host: ${provider}/${modelId}; no fallback is allowed`);
  const receiptPath = resolve(root, '../../..', 'fork-release.json');
  const receipt = existsSync(receiptPath) ? JSON.parse(await readFile(receiptPath, 'utf8')) : undefined;
  return { sdk, root, modelRuntime, model, identity: {
    label: process.env.PI_COMPAT_HOST ?? 'installed', version: manifest.version, sdk: fileURLToPath(url), resourceRoot,
    sdkSha256: hash(await readFile(fileURLToPath(url))), sourceCommit: receipt?.commit,
    provider: model.provider, model: model.id, api: model.api, contextWindow: model.contextWindow, maxTokens: model.maxTokens,
  } };
}

export async function runCase(host, testCase, { skillsDir, thinking = 'max', timeoutMs = 120000, withoutSkills = false, profile = '', artifactDir } = {}) {
  const { sdk, modelRuntime, model } = host;
  skillsDir = await realpath(skillsDir);
  const beforeDigest = await skillDigest(skillsDir);
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'pi-skill-eval-')));
  const cwd = join(temp, 'workspace');
  const agentDir = join(temp, 'profile');
  await mkdir(cwd); await mkdir(agentDir);
  const events = [], commands = [], violations = [], requests = [], images = new Map();
  const state = {};
  const record = { id: testCase.id, skill: testCase.skill, mode: testCase.mode ?? 'task', host: host.identity, skillsDigest: beforeDigest, withoutSkills, requestedThinking: thinking, events, commands, requests, violations };
  let session, timedOut = false, routingDecision, timer;
  const start = performance.now();
  const writable = new Set(testCase.writable ?? []);
  const put = async (path, content) => { const target = resolve(cwd, path); assert(inside(cwd, target), 'Fixture path required'); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); };
  const git = (args) => exec('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd, env: { PATH: process.env.PATH, HOME: temp } });
  async function authorize(path, writing = false) {
    const absolute = resolve(cwd, path);
    const actual = await realpath(writing && !existsSync(absolute) ? dirname(absolute) : absolute);
    const skillResource = !withoutSkills && inside(skillsDir, actual) && !relative(skillsDir, actual).split(sep).includes('evals');
    const allowed = writing ? inside(cwd, actual) && writable.has(relative(cwd, absolute))
      : inside(cwd, actual) || skillResource || inside(dirname(host.root), actual);
    if (!allowed) { violations.push({ path, writing }); throw new Error('This evaluation tool is limited to the declared fixture files and read-only skill/runtime sources'); }
    return absolute;
  }
  const snapshot = async () => Object.fromEntries(await Promise.all([...writable].map(async path => [path, existsSync(join(cwd, path)) ? await readFile(join(cwd, path), 'utf8') : null])));
  try {
    for (const [path, text] of Object.entries(testCase.files ?? {})) await put(path, text);
    if (testCase.git) {
      await git(['init', '-b', 'main']); await git(['add', '.']);
      await git(['-c', 'user.name=Skill Eval', '-c', 'user.email=eval@example.invalid', 'commit', '-m', 'Fixture baseline']);
      for (const [path, text] of Object.entries(testCase.changes ?? {})) await put(path, text);
    }
    await put('runtime.json', JSON.stringify({ packageDir: host.root, ...host.identity }, null, 2));
    await testCase.setup?.({ cwd, put, host, state });
    for (const path of writable) await mkdir(dirname(join(cwd, path)), { recursive: true });
    const commandMap = new Map([
      ['pwd', [process.execPath, ['-e', 'console.log(process.cwd())']]],
      ...['status --short', 'status --porcelain', 'diff', 'diff HEAD', 'diff main...HEAD', 'diff --stat', 'rev-parse --show-toplevel', 'rev-parse HEAD'].map(args => [`git ${args}`, ['git', args.split(' ')]]),
      ...['npm test', 'node --test'].map(command => [command, [process.execPath, ['--permission', `--allow-fs-read=${cwd}`, '--experimental-test-isolation=none', '--test']]]),
      ['pi --version', [process.execPath, [join(host.root, 'dist', 'cli.js'), '--version']]],
    ]);
    if (!withoutSkills) commandMap.set(`python3 ${join(skillsDir, 'pi-extension-development/scripts/resolve_pi.py')} --json`, ['python3', [join(skillsDir, 'pi-extension-development/scripts/resolve_pi.py'), '--json']]);
    const commandParts = command => command.split('&&').map(value => value.trim());
    const isInspection = (name, args) => name === 'read' || name === 'ls' || (name === 'bash' && typeof args?.command === 'string'
      && commandParts(args.command).every(part => commandMap.has(part) && part !== 'npm test' && part !== 'node --test'));
    const customTools = [
      sdk.createReadToolDefinition(cwd, { operations: {
        access: async path => access(await authorize(path)), readFile: async path => readFile(await authorize(path)),
        detectImageMimeType: async path => path.endsWith('.png') ? 'image/png' : null,
      } }),
      sdk.createLsToolDefinition(cwd, { operations: {
        exists: async path => existsSync(await authorize(path)), stat: async path => stat(await authorize(path)),
        readdir: async path => (await readdir(await authorize(path))).filter(name => !inside(skillsDir, path) || name !== 'evals'),
      } }),
      sdk.createWriteToolDefinition(cwd, { operations: {
        mkdir: async path => { assert(inside(cwd, await realpath(path)), 'Use an existing fixture directory'); },
        writeFile: async (path, content) => writeFile(await authorize(path, true), content),
      } }),
      sdk.createEditToolDefinition(cwd, { operations: {
        access: async path => access(await authorize(path, true)), readFile: async path => readFile(await authorize(path, true)),
        writeFile: async (path, content) => writeFile(await authorize(path, true), content),
      } }),
      sdk.createBashToolDefinition(cwd, { exposeSessionEnvironment: false, operations: { exec: async (command, _cwd, options) => {
        for (const part of commandParts(command)) {
          const invocation = commandMap.get(part);
          if (!invocation) throw new Error(`Supported fixture commands: ${[...commandMap.keys()].join('; ')}`);
          const entry = { command: part, files: await snapshot() };
          commands.push(entry);
          try {
            const [program, args] = invocation;
            const executable = program === 'python3' ? (await exec('python3', ['-c', 'import sys; print(sys.executable)'])).stdout.trim() : program;
            const result = await exec(executable, args, { cwd, timeout: 15000, signal: options.signal, maxBuffer: 1024 * 1024,
              env: { PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, HOME: temp, PI_PACKAGE_DIR: host.root, NODE_NO_WARNINGS: '1' } });
            entry.exitCode = 0; entry.output = result.stdout + result.stderr;
          } catch (error) {
            if (typeof error.code !== 'number') throw error;
            entry.exitCode = error.code; entry.output = (error.stdout ?? '') + (error.stderr ?? '');
          }
          options.onData(Buffer.from(entry.output));
          if (entry.exitCode !== 0) return { exitCode: entry.exitCode };
        }
        return { exitCode: 0 };
      } } }),
      ...(testCase.tools?.({ sdk, cwd, state, put }) ?? []),
    ];
    customTools.find(tool => tool.name === 'bash').description += `\nThis synthetic workspace supports these exact commands only (optionally joined with &&): ${[...commandMap.keys()].join('; ')}. Use read for source inspection.`;
    if (testCase.mode === 'routing') for (const tool of customTools) {
      const execute = tool.execute;
      tool.execute = async (...args) => isInspection(tool.name, args[1]) ? execute(...args)
        : { content: [{ type: 'text', text: 'Routing action observed; task execution is outside this routing probe.' }], details: {} };
    }
    const settingsManager = sdk.SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, providerRetry: { maxRetries: 0 }, cacheWarming: 'off', transport: 'sse' });
    const loader = new sdk.DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
      noContextFiles: true, noPromptTemplates: true, noThemes: true, additionalSkillPaths: withoutSkills ? [] : [skillsDir],
      agentsFilesOverride: () => ({ agentsFiles: profile ? [{ path: join(cwd, 'AGENTS.md'), content: profile }] : [] }),
      extensionFactories: [pi => pi.on('before_provider_request', event => {
        const payload = JSON.parse(JSON.stringify(event.payload));
        requests.push({ model: payload.model, reasoning: payload.reasoning, toolNames: payload.tools?.map(tool => tool.name ?? tool.type), keys: Object.keys(payload).sort() });
      })],
    });
    await loader.reload();
    assert.deepEqual(loader.getSkills().diagnostics, []);
    const sessionManager = sdk.SessionManager.inMemory(cwd);
    if (testCase.previousAnswer) sessionManager.appendMessage({ role: 'assistant', content: [{ type: 'text', text: testCase.previousAnswer }],
      api: model.api, provider: model.provider, model: model.id, usage: zeroUsage, stopReason: 'stop', timestamp: Date.now() });
    ({ session } = await sdk.createAgentSession({ cwd, agentDir, modelRuntime, model, thinkingLevel: thinking,
      tools: customTools.map(tool => tool.name), customTools, resourceLoader: loader, settingsManager, sessionManager }));
    await session.bindExtensions({ mode: 'print' });
    record.thinking = session.thinkingLevel;
    record.systemPromptChars = session.systemPrompt.length;
    assert.equal(session.systemPrompt.includes('<available_skills>'), !withoutSkills, 'Native skill discovery must actually reach the model');
    const calls = new Map();
    session.subscribe(event => {
      if (event.type === 'tool_execution_start') { calls.set(event.toolCallId, event); events.push({ type: 'call', id: event.toolCallId, tool: event.toolName, args: event.args }); }
      if (event.type === 'tool_execution_end') {
        const call = calls.get(event.toolCallId);
        for (const part of event.result.content.filter(part => part.type === 'image')) {
          const bytes = Buffer.from(part.data, 'base64');
          images.set(hash(bytes), { bytes, mimeType: part.mimeType });
        }
        events.push({ type: 'result', id: event.toolCallId, tool: event.toolName, isError: event.isError,
          text: event.result.content.filter(part => part.type === 'text').map(part => part.text).join('\n'),
          images: event.result.content.filter(part => part.type === 'image').length });
        if (testCase.mode === 'routing' && call) {
          if (!event.isError && call.toolName === 'read' && loader.getSkills().skills.some(skill => skill.name === testCase.skill && resolve(cwd, call.args.path) === skill.filePath)) routingDecision = 'target-skill';
          else if (!isInspection(call.toolName, call.args)) routingDecision ??= 'task-action';
        }
      }
      if (event.type === 'turn_end' && routingDecision && !record.routingStop) {
        record.routingStop = { reason: routingDecision, afterAssistantMessages: session.messages.filter(message => message.role === 'assistant').length - (testCase.previousAnswer ? 1 : 0) };
        void session.abort();
      }
    });
    timer = setTimeout(() => { timedOut = true; void session.abort(); }, timeoutMs);
    const prompt = testCase.prompt.replaceAll('{cwd}', cwd);
    await session.prompt(testCase.invoke && !withoutSkills ? `/skill:${testCase.skill} ${prompt}` : prompt);
    await session.waitForIdle();
    const messages = session.messages.filter(message => message.role === 'assistant').slice(testCase.previousAnswer ? 1 : 0);
    record.progress = messages.slice(0, -1).flatMap(message => message.content.filter(part => part.type === 'text').map(part => part.text));
    record.output = messages.at(-1)?.content.filter(part => part.type === 'text').map(part => part.text).join('\n') ?? '';
    record.stopReasons = messages.map(message => message.stopReason);
    record.responseModels = [...new Set(messages.map(message => message.responseModel ?? message.model))];
    record.diagnostics = messages.flatMap((message, messageIndex) => {
      if (message.stopReason !== 'error' && message.stopReason !== 'aborted') return [];
      const controlledRoutingStop = !timedOut && !!record.routingStop && messageIndex >= record.routingStop.afterAssistantMessages
        && (message.stopReason === 'aborted' || message.errorMessage === 'This operation was aborted');
      return [{ messageIndex, stopReason: message.stopReason, errorMessage: message.errorMessage ?? message.stopReason, controlledRoutingStop }];
    });
    record.errors = record.diagnostics.filter(diagnostic => !diagnostic.controlledRoutingStop).map(diagnostic => diagnostic.errorMessage);
    record.usage = session.getSessionStats();
    record.files = await snapshot();
    record.skillsRead = events.filter(event => event.type === 'result' && event.tool === 'read' && !event.isError).flatMap(event => {
      const call = calls.get(event.id);
      return loader.getSkills().skills.filter(skill => resolve(cwd, call.args.path) === skill.filePath).map(skill => skill.name);
    });
    assert(!timedOut, 'Evaluation deadline expired');
    assert.equal(record.errors.length, 0, record.errors.join('\n'));
    assert.equal(violations.length, 0, 'Agent attempted an out-of-scope file operation');
    assert(messages.length > 0, 'No model response');
    if (!record.routingStop) assert.equal(messages.at(-1).stopReason, 'stop', 'Model did not finish the task');
    assert(requests.length > 0 && requests.every(request => request.model === model.id), 'The exact selected model must reach the provider request');
    if (testCase.mode === 'routing') assert.equal(record.skillsRead.includes(testCase.skill), testCase.shouldTrigger, `Routing mismatch: ${record.skillsRead.join(', ') || 'no skill'}`);
    else await testCase.check(record, { cwd, state, host });
    record.passed = true;
  } catch (error) { record.passed = false; record.failure = error.message; }
  finally {
    clearTimeout(timer);
    if (session) { await session.abort(); session.dispose(); }
    record.elapsedMs = Math.round(performance.now() - start);
    record.files ??= await snapshot();
    record.images = [];
    try {
      for (const [sha256, image] of images) {
        const artifact = { sha256, mimeType: image.mimeType, bytes: image.bytes.length };
        if (artifactDir) {
          await mkdir(artifactDir, { recursive: true });
          artifact.path = join(artifactDir, `${sha256}.${image.mimeType.split('/')[1]}`);
          await writeFile(artifact.path, image.bytes, { flag: 'wx' });
        }
        record.images.push(artifact);
      }
    } catch (error) { record.passed = false; record.failure = `Image evidence could not be saved: ${error.message}`; }
    if (await skillDigest(skillsDir) !== beforeDigest) { record.passed = false; record.failure = 'Skill sources changed during evaluation'; }
    await rm(temp, { recursive: true, force: true });
  }
  return record;
}
