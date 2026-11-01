import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const script = fileURLToPath(new URL("../skills/lyrics/scripts/lyrics.mjs", import.meta.url));
const tmp = mkdtempSync(path.join(os.tmpdir(), "lyrics-test-"));
const preloadFile = path.join(tmp, "preload.mjs");

after(() => rmSync(tmp, { recursive: true, force: true }));

writeFileSync(
  preloadFile,
  `const routes = JSON.parse(process.env.LYRICS_TEST_ROUTES ?? "{}");
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const key = url.pathname + url.search;
  const match = routes[key] ?? routes[url.pathname] ?? { status: 404, body: null };
  return {
    ok: match.status >= 200 && match.status < 300,
    status: match.status,
    async json() {
      return match.body;
    },
  };
};
`,
);

function runLyrics(args, routes) {
  return spawnSync(process.execPath, ["--import", pathToFileURL(preloadFile).href, script, ...args], {
    encoding: "utf8",
    env: { ...process.env, LYRICS_TEST_ROUTES: JSON.stringify(routes) },
  });
}

test("lyrics CLI enforces artist matching, Unicode titles, free-text queries, and fallback contracts", () => {
  // 1. Artist-specified fallback must not return a different artist's song when /get misses.
  const wrongArtist = runLyrics(["--title", "Hurt", "--artist", "Johnny Cash"], {
    "/api/get": { status: 404, body: null },
    "/api/search": {
      status: 200,
      body: [
        {
          id: 1,
          trackName: "Hurt",
          artistName: "Nine Inch Nails",
          albumName: "The Downward Spiral",
          duration: 373,
          instrumental: false,
          plainLyrics: "I hurt myself today",
        },
      ],
    },
  });
  assert.equal(wrongArtist.status, 1, wrongArtist.stdout);
  assert.match(wrongArtist.stderr, /no confident match/);

  // 2. Non-Latin titles must retain Unicode letters and reject different-title superstrings.
  const cyrillicSuperstring = runLyrics(["--title", "Жизнь"], {
    "/api/search": {
      status: 200,
      body: [
        {
          id: 2,
          trackName: "Жизнь в цвете",
          artistName: "Артист",
          albumName: "Альбом",
          duration: 200,
          instrumental: false,
          plainLyrics: "Другая песня",
        },
      ],
    },
  });
  assert.equal(cyrillicSuperstring.status, 1, cyrillicSuperstring.stdout);

  const cyrillicExact = runLyrics(["--title", "Жизнь"], {
    "/api/search": {
      status: 200,
      body: [
        {
          id: 3,
          trackName: "Жизнь",
          artistName: "Кино",
          albumName: "Альбом",
          duration: 210,
          instrumental: false,
          plainLyrics: "Строка песни",
        },
      ],
    },
  });
  assert.equal(cyrillicExact.status, 0, cyrillicExact.stderr);
  assert.match(cyrillicExact.stdout, /Title: Жизнь\nArtist: Кино/);

  // 3. --q matches across track and artist, and ranks canonical records above artist-stuffed titles.
  const qMultiWord = runLyrics(["--q", "hurt nine inch nails"], {
    "/api/search": {
      status: 200,
      body: [
        {
          id: 10,
          trackName: "Hurt",
          artistName: "Johnny Cash",
          albumName: "American IV",
          duration: 216,
          instrumental: false,
          plainLyrics: "Cash version",
        },
        {
          id: 11,
          trackName: "Hurt",
          artistName: "Nine Inch Nails",
          albumName: "The Downward Spiral",
          duration: 373,
          instrumental: false,
          plainLyrics: "NIN version",
        },
      ],
    },
  });
  assert.equal(qMultiWord.status, 0, qMultiWord.stderr);
  assert.match(qMultiWord.stdout, /Artist: Nine Inch Nails[\s\S]*NIN version/);

  const qStuffed = runLyrics(["--q", "hello adele"], {
    "/api/search": {
      status: 200,
      body: [
        {
          id: 99,
          trackName: "adele - hello",
          artistName: "adele",
          albumName: "junk",
          duration: 295,
          instrumental: false,
          plainLyrics: "stuffed copy",
        },
        {
          id: 1,
          trackName: "Hello",
          artistName: "Adele",
          albumName: "25",
          duration: 295,
          instrumental: false,
          plainLyrics: "Hello, it's me",
        },
      ],
    },
  });
  assert.equal(qStuffed.status, 0, qStuffed.stderr);
  assert.match(qStuffed.stdout, /Title: Hello\nArtist: Adele\nAlbum: 25/);

  // Titles that legitimately begin with the artist name (without an "Artist - Title" delimiter) remain exact matches.
  const titleStartsWithArtist = runLyrics(["--title", "Heart of the Storm", "--artist", "Heart"], {
    "/api/get": { status: 404, body: null },
    "/api/search": {
      status: 200,
      body: [
        {
          id: 50,
          trackName: "Heart of the Storm",
          artistName: "Heart",
          albumName: "Brigade",
          duration: 240,
          instrumental: false,
          plainLyrics: "Storm lyrics",
        },
      ],
    },
  });
  assert.equal(titleStartsWithArtist.status, 0, titleStartsWithArtist.stderr);
  assert.match(titleStartsWithArtist.stdout, /Title: Heart of the Storm\nArtist: Heart/);

  // Empty 200 on the first search form falls through to the second URL form in a single pass.
  const emptyFirstSearchForm = runLyrics(["--title", "Everlong"], {
    "/api/search?track_name=Everlong": { status: 200, body: [] },
    "/api/search?q=Everlong": {
      status: 200,
      body: [
        {
          id: 341098,
          trackName: "Everlong",
          artistName: "Foo Fighters",
          albumName: "The Colour and the Shape",
          duration: 251,
          instrumental: false,
          plainLyrics: "Hello",
        },
      ],
    },
  });
  assert.equal(emptyFirstSearchForm.status, 0, emptyFirstSearchForm.stderr);
  assert.match(emptyFirstSearchForm.stdout, /Title: Everlong\nArtist: Foo Fighters/);

  // 4. Bare-title ambiguity and synced-lyrics derivation.
  const ambiguous = runLyrics(["--title", "Hurt"], {
    "/api/search": {
      status: 200,
      body: [
        { id: 10, trackName: "Hurt", artistName: "Nine Inch Nails", albumName: "The Downward Spiral", plainLyrics: "a" },
        { id: 11, trackName: "Hurt", artistName: "Johnny Cash", albumName: "American IV", plainLyrics: "b" },
      ],
    },
  });
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /Nine Inch Nails — Hurt/);
  assert.match(ambiguous.stderr, /Johnny Cash — Hurt/);

  const syncedFallback = runLyrics(["--title", "Everlong", "--artist", "Foo Fighters"], {
    "/api/get": {
      status: 200,
      body: {
        id: 341098,
        trackName: "Everlong",
        artistName: "Foo Fighters",
        albumName: "The Colour and the Shape",
        duration: 251,
        instrumental: false,
        plainLyrics: null,
        syncedLyrics: "[00:31.73]Hello\n[00:34.43]I've waited here for you",
      },
    },
  });
  assert.equal(syncedFallback.status, 0, syncedFallback.stderr);
  assert.match(syncedFallback.stdout, /Hello\nI've waited here for you/);
});
