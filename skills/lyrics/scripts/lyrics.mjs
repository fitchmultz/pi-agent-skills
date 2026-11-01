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

// Try each candidate URL form in order (falling through on 404 or empty `[]`),
// and retry with backoff only when a URL returns a transient 5xx or 429 status.
async function firstSuccessful(urls) {
  const statuses = [];
  for (let pass = 0; pass < 3; pass++) {
    if (pass > 0) await sleep(pass === 1 ? 1000 : 2000);
    let sawTransient = false;
    for (const url of urls) {
      const { status, body } = await getJson(url);
      statuses.push(status);
      if (status >= 500 || status === 429) sawTransient = true;
      if (body === null) continue;
      if (Array.isArray(body) && body.length === 0) continue;
      return { body, statuses };
    }
    if (!sawTransient) break;
  }
  return { body: null, statuses };
}

// Keep all Unicode letters and numbers while collapsing punctuation/control chars.
function norm(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function extractTrack(trackName, artistName) {
  const rawTrack = norm(trackName);
  const gotArtist = norm(artistName);
  const withoutTags = String(trackName ?? "")
    .replace(/\s*(?:\([^)]*\)|\[[^\]]*\])\s*/g, " ")
    .replace(
      /\s+-\s+(?:(?:\d{4}\s+)?remaster(?:ed)?|live|acoustic|radio\s+edit|mono|stereo|single\s+version|album\s+version|explicit|clean|demo|deluxe|official(?:\s+(?:hd|music|lyric))?(?:\s+video|\s+audio)?)\b.*$/i,
      "",
    );
  let baseTrack = norm(withoutTags) || rawTrack;
  let stuffedArtist = false;
  if (gotArtist) {
    const parts = withoutTags.split(/\s+[-–—:]\s+/);
    if (parts.length >= 2) {
      if (norm(parts[0]) === gotArtist) {
        const rest = norm(parts.slice(1).join(" "));
        if (rest) {
          baseTrack = rest;
          stuffedArtist = true;
        }
      } else if (norm(parts.at(-1)) === gotArtist) {
        const rest = norm(parts.slice(0, -1).join(" "));
        if (rest) {
          baseTrack = rest;
          stuffedArtist = true;
        }
      }
    }
  }
  let spaceStrippedTrack = null;
  if (!stuffedArtist && gotArtist && baseTrack !== gotArtist) {
    if (baseTrack.startsWith(`${gotArtist} `)) {
      spaceStrippedTrack = baseTrack.slice(gotArtist.length).trim() || null;
    } else if (baseTrack.endsWith(` ${gotArtist}`)) {
      spaceStrippedTrack = baseTrack.slice(0, -gotArtist.length).trim() || null;
    }
  }
  return { rawTrack, baseTrack, spaceStrippedTrack, stuffedArtist };
}

function scoreArtist(gotArtist, wantArtist) {
  if (!wantArtist || !gotArtist) return 0;
  if (gotArtist === wantArtist) return 50;
  const wantWords = wantArtist.split(" ").filter(Boolean);
  const gotWords = gotArtist.split(" ").filter(Boolean);
  if (wantWords.length === 0 || gotWords.length === 0) return 0;
  const wantSet = new Set(wantWords);
  const gotSet = new Set(gotWords);
  if (wantWords.every((w) => gotSet.has(w)) || gotWords.every((w) => wantSet.has(w))) {
    return 25;
  }
  return 0;
}

function scoreCandidate(record, title, artist) {
  const wantTrack = norm(title);
  const { rawTrack, baseTrack, spaceStrippedTrack, stuffedArtist } = extractTrack(record.trackName, record.artistName);
  const gotArtist = norm(record.artistName);
  const wantArtist = artist ? norm(artist) : "";
  if (!wantTrack || !rawTrack) return { trackScore: 0, artistScore: 0, total: 0 };

  let trackScore = 0;
  if (rawTrack === wantTrack && !stuffedArtist) trackScore = 100;
  else if (rawTrack === wantTrack || baseTrack === wantTrack || spaceStrippedTrack === wantTrack) trackScore = 90;
  else {
    const wantWords = new Set(wantTrack.split(" ").filter(Boolean));
    const gotWords = baseTrack.split(" ").filter(Boolean);
    const hits = gotWords.filter((w) => wantWords.has(w)).length;
    if (hits > 0) {
      trackScore = Math.round((50 * hits) / Math.max(wantWords.size, gotWords.length, 1));
    }
  }

  const artistScore = scoreArtist(gotArtist, wantArtist);
  return { trackScore, artistScore, total: trackScore + artistScore };
}

function scoreQueryVariant(want, candidateTrack, isCanonical, gotArtist) {
  if (!candidateTrack) return null;
  const padded = ` ${want} `;
  const needle = ` ${candidateTrack} `;
  let best = null;
  for (let from = 0; ; ) {
    const idx = padded.indexOf(needle, from);
    if (idx === -1) break;
    from = idx + 1;
    const before = padded.slice(0, idx).trim();
    const after = padded.slice(idx + needle.length).trim();
    const rem = [before, before ? after : after.replace(/^by\s+/, "")]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!rem) {
      const trackScore = isCanonical ? 100 : 90;
      const candidate = { trackScore, artistScore: 0, total: trackScore };
      if (!best || candidate.total > best.total) best = candidate;
      continue;
    }

    const artistScore = scoreArtist(gotArtist, rem);
    if (artistScore === 0) continue;
    const trackScore = isCanonical ? 100 : 90;
    const candidate = { trackScore, artistScore, total: trackScore + artistScore };
    if (!best || candidate.total > best.total) best = candidate;
  }
  return best;
}

function scoreQueryCandidate(record, query) {
  const want = norm(query);
  const wantWords = [...new Set(want.split(" ").filter(Boolean))];
  const { rawTrack, baseTrack, spaceStrippedTrack, stuffedArtist } = extractTrack(record.trackName, record.artistName);
  const gotArtist = norm(record.artistName);
  if (!want || !rawTrack || wantWords.length === 0) return { trackScore: 0, artistScore: 0, total: 0 };

  const variants = [
    scoreQueryVariant(want, rawTrack, !stuffedArtist, gotArtist),
    baseTrack !== rawTrack ? scoreQueryVariant(want, baseTrack, false, gotArtist) : null,
    spaceStrippedTrack ? scoreQueryVariant(want, spaceStrippedTrack, false, gotArtist) : null,
  ].filter(Boolean);

  if (variants.length > 0) {
    variants.sort((a, b) => b.total - a.total);
    return variants[0];
  }

  const trackWords = baseTrack.split(" ").filter(Boolean);
  const artistWords = gotArtist ? gotArtist.split(" ").filter(Boolean) : [];
  const trackWordSet = new Set(trackWords);
  const artistWordSet = new Set(artistWords);
  const matchedTrackWords = trackWords.filter((w) => wantWords.includes(w));
  if (matchedTrackWords.length === 0) return { trackScore: 0, artistScore: 0, total: 0 };

  const coveredWords = wantWords.filter((w) => trackWordSet.has(w) || artistWordSet.has(w));
  const matchedArtistWords = artistWords.filter((w) => wantWords.includes(w));
  const trackScore = Math.round((50 * coveredWords.length) / Math.max(wantWords.length, trackWords.length, 1));
  const artistScore = matchedArtistWords.length > 0 ? 10 : 0;
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
  if ((!title && !q) || (title && q) || (artist && !title)) usage();

  const enc = encodeURIComponent;
  // Exact lookup when both artist and title are known; falls through to search forms on a miss.
  if (artist && title) {
    const { body } = await firstSuccessful([
      `${BASE}/get?artist_name=${enc(artist)}&track_name=${enc(title)}`,
    ]);
    if (body) {
      const exact = scoreCandidate(body, title, artist);
      if (exact.trackScore >= 60 && exact.artistScore > 0) {
        render(body, { lrc: flags.has("lrc"), json: flags.has("json") });
        return;
      }
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
    .map((record) => ({
      record,
      ...(q ? scoreQueryCandidate(record, q) : scoreCandidate(record, title, artist)),
    }))
    .sort((a, b) => b.total - a.total);

  const best = scored[0];
  if (!best || best.trackScore < 60 || (artist && best.artistScore === 0)) {
    listCandidates(scored.map((s) => s.record), q ?? `${artist ? `${artist} - ` : ""}${title}`);
    process.exit(1);
  }

  // Two different artists tied at the top is a genuine ambiguity for the caller to settle.
  // A rival only counts inside the top 3: one stray cover deeper in the list must not
  // overturn an artist that dominates the exact-title matches.
  if (!artist && best.artistScore === 0 && best.trackScore >= 90) {
    const rival = scored
      .slice(0, 3)
      .slice(1)
      .find(
        (s) =>
          s.trackScore === best.trackScore &&
          s.artistScore === 0 &&
          norm(s.record.artistName) !== norm(best.record.artistName),
      );
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
