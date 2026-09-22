import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/pi-extension-development/", import.meta.url));
const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const { evals } = JSON.parse(readFileSync(path.join(skillDir, "evals/evals.json"), "utf8"));

test("Pi guidance links its shipped resolver and conditional references", () => {
  for (const file of [
    "scripts/resolve_pi.py",
    "references/current-version-hazards.md",
    "references/runtime-authoring-guide.md",
    "references/lifecycle-checklist.md",
    "references/tool-design-checklist.md",
    "references/tui-authoring-guide.md",
    "references/provider-model-guide.md",
    "references/idea-evaluation-checklist.md",
    "references/linux-docker-validation.md",
    "references/publishing/workflow.md",
  ]) {
    assert.ok(skill.includes(file), `missing entry-point link: ${file}`);
    assert.ok(existsSync(path.join(skillDir, file)), `missing resource: ${file}`);
  }
});

test("Pi contract scenarios remain available to behavioral evaluation", () => {
  const ids = new Set(evals.map(({ id }) => id));
  assert.equal(ids.size, evals.length);
  for (const entry of evals) {
    assert.ok(entry.prompt.trim(), `missing prompt: ${entry.id}`);
    assert.ok(entry.expected_output.trim(), `missing expectation: ${entry.id}`);
  }
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
    "public-extension-shared-host-policy",
    "official-fork-lifecycle-boundary",
    "optional-tools-and-execution-cwd",
  ]) assert.ok(ids.has(id), `missing eval: ${id}`);
});
