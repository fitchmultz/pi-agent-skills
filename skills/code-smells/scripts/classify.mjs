#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { appendFile, open, readFile, realpath, stat, truncate } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const provider = "cloudflare-workers-ai";
const modelId = "@cf/cloudflare/clef";
const format = "code-smells-clef-ledger";
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function validateJob(job) {
  if (!record(job) || typeof job.id !== "string" || !job.id.trim()) throw new Error("Each job needs an id");
  if (!record(job.state) || !record(job.questions) || !Object.keys(job.questions).length) {
    throw new Error("Each job needs state and questions objects");
  }
  if (!record(job.sources) || !Object.keys(job.sources).length) {
    throw new Error("Each job needs source paths and their SHA-256 hashes");
  }
  for (const [path, hash] of Object.entries(job.sources)) {
    if (!path || isAbsolute(path) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid source path/hash");
  }
}

function validateAnswers(answers, questions) {
  for (const [id, question] of Object.entries(questions)) {
    const answer = answers?.[id];
    if (!answer || answer.type !== question.type) throw new Error(`Missing or wrong answer type: ${id}`);
    if (answer.type === "bool" && (!Number.isFinite(answer.probability) || answer.probability < 0 || answer.probability > 1)) {
      throw new Error(`Invalid boolean probability: ${id}`);
    }
    if (answer.type === "choice" && !Object.hasOwn(question.criteria, answer.choice)) {
      throw new Error(`Unoffered choice: ${id}`);
    }
    if (answer.type === "score" && !Number.isFinite(answer.score)) throw new Error(`Invalid score: ${id}`);
  }
}

async function verifySources(root, sources) {
  for (const [path, expected] of Object.entries(sources)) {
    const file = await realpath(resolve(root, path));
    const inside = relative(root, file);
    if (inside === ".." || inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(inside)) {
      throw new Error(`Source is outside the project: ${path}`);
    }
    if (!(await stat(file)).isFile()) throw new Error(`Source is not a regular file: ${path}`);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (hash.digest("hex") !== expected) throw new Error(`Source changed; rebuild evidence: ${path}`);
  }
}

async function readLedger(output, root) {
  // ponytail: Resume indexes the ledger in memory; use an on-disk index if actual ledgers exhaust host memory.
  const bytes = await readFile(output);
  const lines = bytes.toString("utf8").split("\n");
  const header = JSON.parse(lines.shift());
  if (header.format !== format || header.root !== root || header.model !== modelId) {
    throw new Error("Resume requires this project's full-Clef ledger");
  }
  const completed = new Map();
  for (const [index, line] of lines.entries()) {
    if (!line && index === lines.length - 1) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      if (index !== lines.length - 1 || bytes.at(-1) === 10) throw error;
      await truncate(output, bytes.lastIndexOf(10) + 1);
      console.error("Recovered an incomplete final ledger record; that job will be retried.");
      break;
    }
    if (row.type !== "judgment" || typeof row.fingerprint !== "string") throw new Error("Invalid ledger record");
    if (row.status === "complete" && row.gatewayLogId) completed.set(row.fingerprint, row);
  }
  if (bytes.at(-1) !== 10) {
    const current = await readFile(output);
    if (current.at(-1) !== 10) await appendFile(output, "\n");
  }
  return completed;
}

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: "string" }, output: { type: "string" }, root: { type: "string" },
    resume: { type: "boolean", default: false }, help: { type: "boolean", default: false },
  } });
  if (values.help) {
    console.log("Usage: node classify.mjs --root PROJECT --input jobs.jsonl --output judgments.jsonl [--resume]\nProcesses every job through full Clef/Gateway; never ranks, truncates evidence, or filters answers.");
    return;
  }
  if (!values.root || !values.input || !values.output) throw new Error("--root, --input and --output are required");
  const root = await realpath(resolve(values.root));
  if (!(await stat(root)).isDirectory()) throw new Error("--root must be a directory");
  const input = await realpath(resolve(values.input));
  const output = resolve(values.output);
  const outputTarget = await realpath(output).catch(error => {
    if (error.code === "ENOENT") return output;
    throw error;
  });
  if (input === outputTarget) throw new Error("Input and output must be different files");
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const resolution = JSON.parse(execFileSync("python3", [
    resolve(scriptDir, "../../pi-extension-development/scripts/resolve_pi.py"), "--json",
  ], { encoding: "utf8" }));
  const { ModelRuntime, readStoredCredential } = await import(pathToFileURL(resolve(resolution.packageRoot, "dist/index.js")).href);
  // ponytail: Native in-memory auth is core-only; use a public export when Pi provides one.
  const { AuthStorage } = await import(pathToFileURL(resolve(resolution.packageRoot, "dist/core/auth-storage.js")).href);
  const credential = readStoredCredential(provider);
  const runtime = await ModelRuntime.create({
    credentials: AuthStorage.inMemory(credential ? { [provider]: credential } : {}),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const model = runtime.getModelOfType("classifier", provider, modelId);
  if (!model) throw new Error("The active Pi host does not provide full Clef");
  const auth = await runtime.getAuth(model);
  const gatewayId = new Headers(auth?.auth.headers).get("cf-aig-gateway-id");
  if (!gatewayId) throw new Error("Full Clef needs the configured cf-aig-gateway-id header; no direct/model fallback");
  const baseUrl = auth.auth.baseUrl ?? model.baseUrl;
  if (new URL(baseUrl).origin !== "https://api.cloudflare.com") {
    throw new Error("This helper requires Cloudflare's documented Workers AI + Gateway-header route");
  }
  const account = auth.env?.CLOUDFLARE_ACCOUNT_ID;
  if (!account) throw new Error("The native Cloudflare credentials did not resolve an account ID");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run`;
  const route = digest({ provider, model: modelId, endpoint, gatewayId });
  const completed = values.resume ? await readLedger(output, root) : new Map();
  const ledger = await open(output, values.resume ? "a" : "wx", 0o600);
  const counts = { processed: 0, reused: 0, failed: 0 };
  const seen = new Set();
  try {
    if (!values.resume) await ledger.writeFile(`${JSON.stringify({ format, root, provider, model: modelId })}\n`);
    const lines = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const job = JSON.parse(line);
      validateJob(job);
      if (seen.has(job.id)) throw new Error(`Duplicate job id: ${job.id}`);
      seen.add(job.id);
      const fingerprint = digest({ root, route, job });
      let row;
      let usage;
      try {
        await verifySources(root, job.sources);
        const previous = completed.get(fingerprint);
        if (previous) {
          validateAnswers(previous.answers, job.questions);
          counts.reused += 1;
          continue;
        }
        let gatewayLogId;
        const result = await runtime.classify(model, { state: job.state, questions: job.questions }, {
          maxRetries: 1,
          fetch: async (url, options) => {
            if (new URL(url).href !== endpoint ||
                new Headers(options.headers).get("cf-aig-gateway-id") !== gatewayId ||
                JSON.parse(options.body).model !== modelId) {
              throw new Error("Refusing a classifier request that does not match full Clef/Gateway");
            }
            return fetch(url, { ...options, redirect: "error" });
          },
          onResponse: response => { gatewayLogId = new Headers(response.headers).get("cf-aig-log-id"); },
        });
        usage = result.usage;
        if (result.stopReason !== "stop") throw new Error(result.errorMessage || result.stopReason);
        if (!gatewayLogId) throw new Error("The response has no Gateway log receipt; routing is unverified");
        if (result.model !== modelId) throw new Error("The response did not identify full Clef");
        validateAnswers(result.answers, job.questions);
        // The SDK exposes no Clef tokenizer. Callers partition complete evidence; this runner never slices state.
        if (result.usage?.input >= model.contextWindow) throw new Error("Model context exhausted; repartition this job");
        row = {
          status: "complete", gatewayLogId, answers: result.answers, usage: result.usage,
          inputCompleteness: "not_attested_by_provider",
        };
        counts.processed += 1;
      } catch (error) {
        row = { status: "error", error: error.message, usage };
        counts.failed += 1;
      }
      await ledger.writeFile(`${JSON.stringify({ type: "judgment", id: job.id, fingerprint, ...row })}\n`);
    }
  } finally {
    await ledger.close();
  }
  console.log(JSON.stringify({ ...counts, output }));
  if (counts.failed) process.exitCode = 1;
}

main().catch(error => {
  console.error(`classify.mjs: ${error.message}`);
  process.exitCode = 1;
});
