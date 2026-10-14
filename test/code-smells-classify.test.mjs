import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "skills/code-smells/scripts/classify.mjs");
const hostIndex = process.env.PI_HOST_INDEX ? pathToFileURL(process.env.PI_HOST_INDEX).href : import.meta.resolve("@earendil-works/pi-coding-agent");
const hostDir = fileURLToPath(new URL("..", hostIndex));
const { ModelRuntime } = await import(hostIndex);
const { AuthStorage } = await import(new URL("./core/auth-storage.js", hostIndex));
const runtime = await ModelRuntime.create({
  credentials: AuthStorage.inMemory(), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false,
});
const supportsFullClef = !!runtime.getModelOfType("classifier", "cloudflare-workers-ai", "@cf/cloudflare/clef");
const hash = value => createHash("sha256").update(value).digest("hex");
const lines = path => readFileSync(path, "utf8").trim().split("\n").map(line => JSON.parse(line));

function fixture(t, { gateway = true, accountDrift } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "code-smells-classify-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = join(dir, "project");
  const agent = join(dir, "agent");
  mkdirSync(project);
  mkdirSync(agent);
  writeFileSync(join(agent, "auth.json"), JSON.stringify({
    "cloudflare-workers-ai": { type: "api_key", key: "synthetic-key", env: { CLOUDFLARE_ACCOUNT_ID: "synthetic-account" } },
  }));
  writeFileSync(join(agent, "models.json"), JSON.stringify({
    providers: { "cloudflare-workers-ai": { headers: gateway ? { "cf-aig-gateway-id": "synthetic-gateway" } : {} } },
  }));
  const observed = join(dir, "requests.jsonl");
  const preload = join(dir, "transport.mjs");
  writeFileSync(preload, `
import { appendFileSync, writeFileSync } from "node:fs";
globalThis.fetch = async (url, options) => {
  const request = JSON.parse(options.body);
  appendFileSync(${JSON.stringify(observed)}, JSON.stringify({
    url: String(url), model: request.model,
    gateway: new Headers(options.headers).get("cf-aig-gateway-id"),
    authorization: new Headers(options.headers).get("authorization"),
    state: request.input.state
  }) + "\\n");
  if (${JSON.stringify(accountDrift)} === "stored") {
    writeFileSync(${JSON.stringify(join(agent, "auth.json"))}, JSON.stringify({
      "cloudflare-workers-ai": { type: "api_key", key: "synthetic-key", env: { CLOUDFLARE_ACCOUNT_ID: "other-account" } }
    }));
  }
  if (${JSON.stringify(accountDrift)} === "environment") process.env.CLOUDFLARE_ACCOUNT_ID = "other-account";
  return new Response(JSON.stringify({ success: true, result: {
    model: "clef", answers: { smell: {
      type: "choice", choice: "insufficient_evidence",
      probabilities: { present: 0.05, absent: 0.05, insufficient_evidence: 0.9 }, confidence: 0.9
    } }, usage: { input_tokens: 100, output_tokens: 0 }
  } }), { status: 200, headers: { "content-type": "application/json", "cf-aig-log-id": "synthetic-log" } });
};
`);
  const jobs = join(dir, "jobs.jsonl");
  const output = join(dir, "judgments.jsonl");
  const run = (...extra) => spawnSync(process.execPath, [script, "--root", project, "--input", jobs, "--output", output, ...extra], {
    cwd: project, encoding: "utf8", timeout: 60000,
    env: { ...process.env, PI_PACKAGE_DIR: hostDir, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: "1", PI_TELEMETRY: "0",
      CLOUDFLARE_API_KEY: "synthetic-key", CLOUDFLARE_ACCOUNT_ID: "synthetic-account",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(preload).href}` },
  });
  const job = (id, source) => ({
    id, sources: { "module.js": hash(source) }, state: { source },
    questions: { smell: { type: "choice", instructions: "Is a maintainability problem established?",
      criteria: { present: "Supported by code", absent: "Not present", insufficient_evidence: "More source is required" } } },
  });
  return { dir, project, agent, jobs, output, observed, run, job };
}

if (!supportsFullClef) {
  test("a host without native full Clef reports the capability gap without making requests", t => {
    const f = fixture(t);
    const source = "export const untouched = true;\n";
    writeFileSync(join(f.project, "module.js"), source);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", source)) + "\n");
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /active Pi host does not provide full Clef/);
    assert.throws(() => readFileSync(f.observed), { code: "ENOENT" });
    assert.throws(() => readFileSync(f.output), { code: "ENOENT" });
  });
} else {
  test("Clef runner preserves every job and complete evidence, including non-positive judgments", t => {
    const f = fixture(t);
    const source = `// ${"source ".repeat(1300)}\nexport const finalEvidence = true;\n`;
    writeFileSync(join(f.project, "module.js"), source);
    // The former shared Orrery lane stopped at 48 calls; a result limit must not become an analysis limit.
    const jobs = Array.from({ length: 49 }, (_, index) => f.job(`candidate-${index}`, source));
    writeFileSync(f.jobs, jobs.map(job => JSON.stringify(job)).join("\n") + "\n");
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { processed: jobs.length, reused: 0, failed: 0, output: f.output });
    const requests = lines(f.observed);
    assert.equal(requests.length, jobs.length);
    for (const request of requests) {
      assert.equal(request.model, "@cf/cloudflare/clef");
      assert.equal(request.gateway, "synthetic-gateway");
      assert.equal(request.url, "https://api.cloudflare.com/client/v4/accounts/synthetic-account/ai/run");
      assert.equal(request.state.source, source);
    }
    const judgments = lines(f.output).slice(1);
    assert.deepEqual(judgments.map(row => row.id), jobs.map(job => job.id));
    assert(judgments.every(row => row.status === "complete" && row.answers.smell.choice === "insufficient_evidence"));
    const before = readFileSync(f.output, "utf8");
    const resumed = f.run("--resume");
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(JSON.parse(resumed.stdout).reused, jobs.length);
    assert.equal(readFileSync(f.output, "utf8"), before);
    assert.equal(lines(f.observed).length, jobs.length);
  });

  test("resume never reuses a judgment after its source changes and recovers an interrupted tail", t => {
    const f = fixture(t);
    const original = "export const original = true;\n";
    const changed = "export const changed = true;\n";
    writeFileSync(join(f.project, "module.js"), original);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", original)) + "\n");
    assert.equal(f.run().status, 0);
    const complete = readFileSync(f.output, "utf8");
    appendFileSync(f.output, '{"type":"judgment","id":"interrupted"');
    const recovered = f.run("--resume");
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal(readFileSync(f.output, "utf8"), complete);
    assert.equal(lines(f.observed).length, 1);
    writeFileSync(join(f.project, "module.js"), changed);
    const stale = f.run("--resume");
    assert.equal(stale.status, 1);
    assert.match(lines(f.output).at(-1).error, /Source changed/);
    assert.equal(lines(f.observed).length, 1, "Stale evidence must not be sent or silently reused");
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", changed)) + "\n");
    const refreshed = f.run("--resume");
    assert.equal(refreshed.status, 0, refreshed.stderr);
    assert.equal(JSON.parse(refreshed.stdout).processed, 1);
    assert.equal(lines(f.observed).length, 2);
  });

  test("missing Gateway configuration fails before any request", t => {
    const f = fixture(t, { gateway: false });
    const source = "export const untouched = true;\n";
    writeFileSync(join(f.project, "module.js"), source);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", source)) + "\n");
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cf-aig-gateway-id/);
    assert.throws(() => readFileSync(f.observed), { code: "ENOENT" });
    assert.equal(readFileSync(join(f.project, "module.js"), "utf8"), source);
  });

  test("environment credentials work without creating auth.json or changing configuration", t => {
    const f = fixture(t);
    rmSync(join(f.agent, "auth.json"));
    const config = readFileSync(join(f.agent, "models.json"), "utf8");
    const source = "export const untouched = true;\n";
    writeFileSync(join(f.project, "module.js"), source);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", source)) + "\n");
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(lines(f.observed).length, 1);
    assert.deepEqual(readdirSync(f.agent), ["models.json"]);
    assert.equal(readFileSync(join(f.agent, "models.json"), "utf8"), config);
  });

  test("configured credential commands retain native resolution without credential-file writes", t => {
    const f = fixture(t);
    const credential = JSON.stringify({
      "cloudflare-workers-ai": { type: "api_key", key: `!${JSON.stringify(process.execPath)} -p "'synthetic-command-key'"`,
        env: { CLOUDFLARE_ACCOUNT_ID: "synthetic-account" } },
    });
    writeFileSync(join(f.agent, "auth.json"), credential);
    const source = "export const untouched = true;\n";
    writeFileSync(join(f.project, "module.js"), source);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", source)) + "\n");
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(lines(f.observed)[0].authorization, "Bearer synthetic-command-key");
    assert.equal(readFileSync(join(f.agent, "auth.json"), "utf8"), credential);
  });

  for (const accountDrift of ["stored", "environment"]) {
    test(`a changing ${accountDrift} account cannot send evidence under a stale route fingerprint`, t => {
      const f = fixture(t, { accountDrift });
      if (accountDrift === "environment") rmSync(join(f.agent, "auth.json"));
      const source = "export const untouched = true;\n";
      writeFileSync(join(f.project, "module.js"), source);
      writeFileSync(f.jobs, ["first", "second"].map(id => JSON.stringify(f.job(id, source))).join("\n") + "\n");
      const result = f.run();
      assert.equal(result.status, accountDrift === "stored" ? 0 : 1, result.stderr);
      const requests = lines(f.observed);
      assert(requests.every(request => request.url === "https://api.cloudflare.com/client/v4/accounts/synthetic-account/ai/run"),
        "Never send source to a different account under the original route fingerprint");
      const judgments = lines(f.output).slice(1);
      assert.equal(judgments[0].status, "complete");
      if (accountDrift === "environment") {
        assert.equal(requests.length, 1);
        assert.equal(judgments[1].status, "error");
        assert.match(judgments[1].error, /route|Gateway/);
      } else {
        assert.equal(requests.length, 2);
        assert.equal(judgments[1].status, "complete");
        writeFileSync(join(f.agent, "auth.json"), JSON.stringify({
          "cloudflare-workers-ai": { type: "api_key", key: "synthetic-key", env: { CLOUDFLARE_ACCOUNT_ID: "synthetic-account" } },
        }));
        const resumed = f.run("--resume");
        assert.equal(resumed.status, 0, resumed.stderr);
        assert.equal(JSON.parse(resumed.stdout).reused, 2);
        assert.equal(lines(f.observed).length, 2);
      }
    });
  }

  test("an existing output is never overwritten without explicit ledger resumption", t => {
    const f = fixture(t);
    const source = "export const untouched = true;\n";
    writeFileSync(join(f.project, "module.js"), source);
    writeFileSync(f.jobs, JSON.stringify(f.job("candidate", source)) + "\n");
    writeFileSync(f.output, "user-owned evidence\n");
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EEXIST/);
    assert.throws(() => readFileSync(f.observed), { code: "ENOENT" });
    assert.equal(readFileSync(f.output, "utf8"), "user-owned evidence\n");
  });
}
