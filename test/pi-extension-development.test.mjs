import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(root, "skills", "pi-extension-development");

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const hazards = readFileSync(path.join(skillDir, "references", "current-version-hazards.md"), "utf8");
const runtime = readFileSync(path.join(skillDir, "references", "runtime-authoring-guide.md"), "utf8");
const tui = readFileSync(path.join(skillDir, "references", "tui-authoring-guide.md"), "utf8");
const lifecycle = readFileSync(path.join(skillDir, "references", "lifecycle-checklist.md"), "utf8");
const evals = JSON.parse(readFileSync(path.join(skillDir, "evals", "evals.json"), "utf8"));

test("pi extension guidance tracks the Pi 0.84 contract", () => {
  const text = filesUnder(skillDir)
    .filter((file) => /\.(?:json|md|py)$/.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.match(skill, /version: "1\.13\.0"/);
  assert.match(skill, /last-verified-pi: "0\.84\.2"/);
  assert.doesNotMatch(text, /\b0\.83(?:\.0)?\b/);
  assert.doesNotMatch(text, /context\.store\.(?:read|write)\(/);
  assert.match(skill, /ModelsRequestTransforms/);
  assert.match(hazards, /ModelsStreamTransforms.*no longer exists/);
  assert.match(skill, /ProviderHeaders.*string \| null/);
  assert.match(skill, /message_update.*delta-only/);
  assert.match(skill, /no path synthesizes results for unstarted siblings in a sequential tool batch/);
  assert.match(skill, /ModelsRefreshResult/);
  assert.match(skill, /context\.stored.*context\.publish/);
  assert.match(skill, /JsonlSessionRepo.*InMemorySessionRepo/);
  assert.match(skill, /AgentHarness.*HarnessNotImplemented/);
  assert.match(skill, /RemoteSession\.sessions.*SessionMetadata/);
  assert.match(hazards, /SettingsManager\.create\(cwd, agentDir\?, options\?\)/);
  assert.match(hazards, /There is no `create\(\{ cwd, \.\.\. \}\)` overload/);
  assert.match(hazards, /TypeBox 1\.3\.7/);
  assert.match(hazards, /message_end\.message/);
  assert.match(hazards, /renameFile\(source, destination, signal\?\)/);
  assert.match(skill, /ctx\.scopedModels/);
  assert.match(tui, /\{ expanded, outputPad \}/);
  assert.match(runtime, /RPC bash runs extension `user_bash` handlers before execution/);
  assert.match(hazards, /unstarted siblings in a sequential tool batch unmatched/);
  assert.match(runtime, /leaves later unstarted sibling calls without results/);
  assert.match(lifecycle, /Unstarted siblings in a sequential tool batch can remain unmatched/);

  const replacementEval = evals.evals.find(({ id }) => id === "active-session-replacement-persistence");
  assert.match(replacementEval.expected_output, /later unstarted sequential siblings/);
  assert.match(replacementEval.expected_output, /AgentSession\.waitForIdle\(\)/);

  const ids = new Set(evals.evals.map(({ id }) => id));
  for (const id of [
    "typebox-1-3-7-migration",
    "scoped-model-extension-picker",
    "message-renderer-output-padding",
    "rpc-user-bash-policy",
    "active-session-replacement-persistence",
    "models-request-transforms-and-null-headers",
    "json-rpc-delta-message-updates",
    "model-refresh-and-auth-cancellation",
    "provider-refresh-generation-publication",
    "oauth-refresh-concrete-abort-signal",
    "agent-core-v4-session-repositories",
    "agent-core-filesystem-rename",
    "remote-session-metadata-snapshot",
  ]) {
    assert.ok(ids.has(id), `missing eval ${id}`);
  }
});
