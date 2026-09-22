import assert from 'node:assert/strict';
import test from 'node:test';
import { cases } from '../evals/cases.mjs';

const check = (id, output, events = []) => cases.find(item => item.id === id).check({ output, events, commands: [] }, { cwd: '/fixture', host: { root: '/sdk' } });
const reads = paths => paths.flatMap((path, id) => [
  { type: 'call', id, tool: 'read', args: { path } },
  { type: 'result', id, tool: 'read', isError: false, images: path.endsWith('.png') ? 1 : 0 },
]);

test('structured verdicts distinguish incomplete fixes and rejected reviews', () => {
  const evidence = reads(['evidence.json', 'src/greet.js', 'test/greet.test.mjs']);
  assert.throws(() => check('verify-required-check-failed', JSON.stringify({ status: 'complete', verified: ['Integration passed'], unverified: [] }), evidence));
  assert.doesNotThrow(() => check('verify-required-check-failed', JSON.stringify({ status: 'incomplete', verified: [], unverified: ['The required integration check failed. Not ready to merge.'] }), evidence));
  assert.throws(() => check('verify-practical-proof', JSON.stringify({ status: 'incomplete', verified: ['The greet test passes.'], unverified: ['Historical proof is unavailable.'] }), evidence));
  assert.doesNotThrow(() => check('verify-practical-proof', JSON.stringify({ status: 'complete', verified: ['The greet regression test passes.'], unverified: ['Historical broken-revision execution was unavailable.'] }), evidence));
  assert.throws(() => check('ux-simple-success', JSON.stringify({ verdict: 'request changes', findings: ['Do not approve this.'] }), reads(['journey.md'])));
  assert.doesNotThrow(() => check('ux-simple-success', JSON.stringify({ verdict: 'approve', findings: [] }), reads(['journey.md'])));
});

test('answers that skip explicitly required source reads do not pass', () => {
  assert.throws(() => check('discover-before-asking', 'Run npm test.'));
  assert.doesNotThrow(() => check('discover-before-asking', 'Run npm test.', reads(['package.json'])));
  const sdkAnswer = "Use ModelRuntime and modelRuntime.getModel with tools: ['read'].";
  assert.throws(() => check('pi-current-sdk', sdkAnswer));
  assert.doesNotThrow(() => check('pi-current-sdk', sdkAnswer, reads(['proposal.md', 'runtime.json', '/sdk/dist/core/sdk.d.ts', '/sdk/dist/core/model-runtime.d.ts'])));
});

test('restatement meaning and the actual reversed diagram edge are required', () => {
  assert.throws(() => check('plain-language', 'Bananas are yellow.'));
  assert.doesNotThrow(() => check('plain-language', 'We will test that the background tasks work together.'));
  const events = reads(['flow.json', 'diagram.png']);
  assert.throws(() => check('diagram-inspects-image', JSON.stringify({ incorrectEdge: { from: 'Client', to: 'API' }, expectedEdge: { from: 'API', to: 'Database' } }), events));
  assert.doesNotThrow(() => check('diagram-inspects-image', JSON.stringify({ incorrectEdge: { from: 'Database', to: 'API' }, expectedEdge: { from: 'API', to: 'Database' } }), events));
});
