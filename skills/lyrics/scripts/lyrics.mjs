#!/usr/bin/env node
// Fetches lyrics for one song from lrclib.net for the lyrics skill.
// Usage:
//   lyrics.mjs --title <title> [--artist <artist>]
//   lyrics.mjs --q "<free text query>"
//   lyrics.mjs --title <title> --lrc | --json
// Exit codes: 0 found, 1 not found or ambiguous (candidates on stderr), 2 usage or network error.

const BASE = "https://lrclib.net/api";
const UA = "pi-agent-skills-lyrics/1.0 (+https://github.com/fitchmultz/pi-agent-skills)";

function usage(code = 2) {
  process.stderr.write(
    [
      "usage: lyrics.mjs --title <title> [--artist <artist>] [--q <query>] [--lrc] [--json]",
      "",
      "  --title, -t   track title (required unless --q is given)",
      "  --artist, -a  artist name; enables the exact /api/get lookup",
      "  --q           free-text search query instead of title/artist",
      "  --lrc         print synced (timestamped) lyrics instead of plain",
      "  --json        print the raw matched record as JSON",
      "",
    ].join("\n"),
  );
  process.exit(code);
}

function parseArgs(argv) {
  const out = { flags: new Set(), values: {} };
  const named = { "--title": "title", "-t": "title", "--artist": "artist", "-a": "artist", "--q": "q" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") usage(0);
    if (arg === "--lrc" || arg === "--json") {
      out.flags.add(arg.slice(2));
      continue;
    }
    const key = named[arg];
    if (!key) usage();
    const value = argv[++i];
    if (value === undefined) usage();
    out.values[key] = value;
  }
  return out;
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new Error(`network error fetching ${url}: ${err.message}`);
  }
  if (!res.ok) return { status: res.status, body: null };
  const body = await res.json();
  return { status: res.status, body };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// lrclib intermittently answers 503 "ServerOverloaded" (and misses on /get) for
// individual parameter forms — sometimes with an empty result set — so try each
// form once, then retry with backoff. Returns the first body that carries data,
// plus the statuses seen, so callers can tell "unavailable" from "no results".
async function firstSuccessful(urls) {
  const statuses = [];
  for (let pass = 0; pass < 3; pass++) {
    if (pass > 0) await sleep(pass === 1 ? 1000 : 2000);
    for (const url of urls) {
      const { status, body } = await getJson(url);
      statuses.push(status);
      if (body === null) continue;
      if (Array.isArray(body) && body.length === 0) continue;
      return { body, statuses };
    }
  }
  return { body: null, statuses };
}

// Lowercase and strip punctuation so "Hurt\u001fHurt" and "foo fighters - everlong" compare sanely.
function norm(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(record, title, artist) {
  const wantTrack = norm(title);
  const gotTrack = norm(record.trackName);
  const gotArtist = norm(record.artistName);
  const wantArtist = artist ? norm(artist) : "";

  let trackScore = 0;
  if (gotTrack === wantTrack) trackScore = 100;
  else if (gotTrack.includes(wantTrack)) trackScore = 60;
  else {
    const wantWords = new Set(wantTrack.split(" ").filter(Boolean));
    const gotWords = gotTrack.split(" ").filter(Boolean);
    const hits = gotWords.filter((w) => wantWords.has(w)).length;
    if (hits > 0) trackScore = Math.round((60 * hits) / Math.max(wantWords.size, 1));
  }

  let artistScore = 0;
  if (wantArtist) {
    if (gotArtist === wantArtist) artistScore = 50;
    else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) artistScore = 25;
  }
  return { trackScore, artistScore, total: trackScore + artistScore };
}

function plainFromSynced(synced) {
  return String(synced ?? "")
    .split("\n")
    .map((line) => line.replace(/^(\[[^\]]*\])+/, "").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDuration(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "unknown";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function render(record, { lrc, json }) {
  if (json) {
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return;
  }
  if (lrc) {
    if (!record.syncedLyrics) {
      process.stderr.write("no synced lyrics for this track\n");
      process.exit(1);
    }
    process.stdout.write(`${record.syncedLyrics}\n`);
    return;
  }
  const lines = [
    `Title: ${record.trackName}`,
    `Artist: ${record.artistName}`,
    `Album: ${record.albumName ?? "unknown"}`,
    `Duration: ${formatDuration(record.duration)}`,
    `Source: https://lrclib.net (record ${record.id})`,
    `Instrumental: ${record.instrumental ? "yes" : "no"}`,
    "",
  ];
  const body = record.plainLyrics ?? (record.syncedLyrics ? plainFromSynced(record.syncedLyrics) : "");
  lines.push(record.instrumental ? "(instrumental)" : body || "(no plain lyrics available)");
  process.stdout.write(`${lines.join("\n")}\n`);
}

function listCandidates(records, title) {
  process.stderr.write(`no confident match for ${JSON.stringify(title)}; candidates:\n`);
  for (const r of records.slice(0, 5)) {
    process.stderr.write(`  ${r.artistName} — ${r.trackName} (${r.albumName ?? "unknown album"})\n`);
  }
}

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const { title, artist, q } = values;
  if (!title && !q) usage();

  const enc = encodeURIComponent;
  // Exact lookup when both artist and title are known; falls through to search forms on a miss.
  if (artist && title) {
    const { body } = await firstSuccessful([
      `${BASE}/get?artist_name=${enc(artist)}&track_name=${enc(title)}`,
    ]);
    if (body && (norm(body.trackName) === norm(title) || norm(body.trackName).includes(norm(title)))) {
      render(body, { lrc: flags.has("lrc"), json: flags.has("json") });
      return;
    }
  }

  const searchUrls = q
    ? [`${BASE}/search?q=${enc(q)}`]
    : artist && title
      ? [
          `${BASE}/search?artist_name=${enc(artist)}&track_name=${enc(title)}`,
          `${BASE}/search?q=${enc(`${artist} ${title}`)}`,
        ]
      : [`${BASE}/search?track_name=${enc(title)}`, `${BASE}/search?q=${enc(title)}`];
  const { body: results, statuses } = await firstSuccessful(searchUrls);
  if (results === null) {
    const query = q ?? `${artist ? `${artist} - ` : ""}${title}`;
    if (statuses.every((s) => s !== 200)) {
      process.stderr.write(`lrclib unavailable for ${JSON.stringify(query)} (statuses: ${[...new Set(statuses)].join(", ")})\n`);
      process.exit(2);
    }
    process.stderr.write(`no results for ${JSON.stringify(query)}\n`);
    process.exit(1);
  }
  const records = Array.isArray(results) ? results : [];

  const scored = records
    .map((record) => ({ record, ...scoreCandidate(record, q ?? title, artist) }))
    .sort((a, b) => b.total - a.total);

  const best = scored[0];
  if (best.trackScore < 60) {
    listCandidates(scored.map((s) => s.record), q ?? title);
    process.exit(1);
  }

  // Two different artists tied at the top is a genuine ambiguity for the caller to settle.
  // A rival only counts inside the top 3: one stray cover deeper in the list must not
  // overturn an artist that dominates the exact-title matches.
  if (!artist && best.trackScore === 100) {
    const rival = scored
      .slice(0, 3)
      .slice(1)
      .find((s) => s.trackScore === 100 && norm(s.record.artistName) !== norm(best.record.artistName));
    if (rival) {
      listCandidates(scored.map((s) => s.record), q ?? title);
      process.exit(1);
    }
  }

  render(best.record, { lrc: flags.has("lrc"), json: flags.has("json") });
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(2);
});
