---
name: lyrics
description: "Fetch real lyrics for a requested song and return one copy-pasteable block of phonetically rewritten lyrics for Suno-style vocal synthesis, or rewrite pasted lyrics without fetching. Use when the user asks for lyrics for a song or artist, wants lyrics rewritten for Suno/TTS singing, or invokes /skill:lyrics. Do not use for song identification, writing original lyrics, or translating lyrics."
disable-model-invocation: true
compatibility: "Song fetching runs the bundled Node script against lrclib.net; browser fallback needs the separately installed browser tool group."
---

# Lyrics

## Goal

Return exactly one copyable fenced `text` block of rewritten lyrics: same meaning, pronunciation, order, structure, and explicit content as the real lyrics, respelled in the casual phonetic style that vocal-synthesis models sing naturally.

## Output contract

- One fenced `text` code block containing only the rewritten lyrics with `[...]` section headers.
- No explanation before or after the block, and no title or artist line inside it, unless the user asks.
- Allowed exceptions above the block: one line naming the chosen artist when the request omitted the artist and the match was not obvious, or one line naming the version when only a live, acoustic, demo, or cover version exists.

## Input modes

1. **Song request** — a title, with or without an artist. Fetch first, then rewrite.
2. **Paste** — lyrics pasted with no song request. Do not fetch; rewrite the pasted text.

Never rewrite lyrics from memory. If every source fails, report which sources were tried and stop.

## Song request flow

1. Run this skill's script, resolving the relative path against this skill's directory:

   `node scripts/lyrics.mjs --title "<title>" --artist "<artist>"`

   It queries lrclib.net, scores candidates, derives plain lyrics from synced lyrics when needed, and prints track metadata followed by the lyrics. Exit 0 found, 1 not found or ambiguous (candidates on stderr), 2 usage or network error. `--lrc` returns timestamped lyrics, `--json` the raw record.

2. With an artist, an exit-0 exact-get result is authoritative. Without an artist, run with only `--title`; when the script exits 1 as ambiguous, ask the user which song is meant (for example "Hurt" — Nine Inch Nails or Johnny Cash).
3. If the script finds nothing, try the browser with `agent_browser` (Genius, then AZLyrics), and say so if that tool is unavailable. Before rewriting, strip site junk: embed counters, "Submit Corrections", ticket and merch lines, contributor credits, "You might also like", navigation, and ads. Keep any source section markers.
4. Prefer the standard studio version. Report an instrumental track instead of writing lyrics for it.

## Rewrite step

Before the first rewrite in a session, read `references/phonetic-rewriting.md` in full and follow it exactly. It owns the complete system: shorthand substitutions, phonetic respellings, complex-word and proper-noun restraint, numbers and letters, sustained vowels, the trailing-E and single-letter-stutter rules, profanity and ad-lib handling, singer relabeling, section inference, style targets, and prohibitions.

Non-negotiables the reference enforces:

- Preserve meaning, pronunciation, lyric order, repeated lines, ad-libs, singer changes, verse/chorus/bridge structure, and approximate syllable count. Change only spelling, punctuation, and section organization.
- Replace named performers in section headers with Singer A / Singer B / Singer C by first appearance; never real artist names in headers. Artist names sung inside lyric lines stay.
- Essentially zero punctuation in lyric lines; section brackets are allowed; line breaks carry phrasing.
- `of` stays `of`, never `uv`. No invented trailing E's. No IPA. No hyphen syllabification.
- Keep every unique lyric line; never summarize, censor, or replace with original material.
- The result must look substantially phonetic at a glance, matching the reference's style targets, not like lightly edited standard English.

When fetched lyrics have no section markers (lrclib plain lyrics), infer them per the reference's section-inference rules; do not over-segment.

## Variants

- **Original lyrics**: when the user asks for the plain or unrewritten lyrics, return them cleaned — stanzas separated by one blank line, source markers preserved, junk stripped — in one `text` block, without rewriting.
- **Synced lyrics**: when asked for timestamped or LRC lyrics, run the script with `--lrc` and return the output in one block, unrewritten unless asked.
- **Saving to a file**: write the block's contents, without the fence, to the requested path.
- **Multiple songs**: one fetch and one block per song.
