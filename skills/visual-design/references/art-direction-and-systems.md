# Art Direction and Visual Systems

Read this reference when setting color direction, typography, layout rhythm, surface ergonomics (web apps, pages, documents), or designing favicons.

## Derive the color system from the subject

Never default blindly to one palette. Choose light, dark, or adaptive themes from the subject, environment, and reading duration:

| Direction | Best fit | Surface and ink structure |
| --- | --- | --- |
| **Daylight editorial paper** | Long-form briefs, field notes, executive memos, printable HTML documents | Warm alabaster/ivory canvas (`#FAF8F4`–`#F5F2EB`), crisp white elevated sheets, deep charcoal ink (`#141518`), muted stone secondary text, 1 editorial accent (deep ink blue, vermilion, or forest) plus semantic status tones |
| **Crisp daylight product** | Daily-driver web apps, dashboards, operational tools, docs | Cool neutral canvas (`#F8FAFC`–`#FFFFFF`), subtle 1px hairline borders, high-contrast slate ink (`#0F172A`), disciplined primary action hue, restrained semantic tints for badges and charts |
| **Atmospheric dark telemetry** | Incident turnarounds, infrastructure/runtime stories, developer showcases, live status cinema | Deep obsidian/ink canvas (`#06090F`–`#0B101B`), layered elevated panels (`+4–8%` lightness steps), warm bone or crisp off-white primary text (`#F4F6F8` / `#EFE9DD`), luminous semantic accents (emerald/cyan for calm, coral/amber for fault/load) |
| **Warm tactile studio** | Creative tools, consumer launches, personal projects, portfolios | Tactile warm neutral or tinted paper base, bold ink contrast, deliberate warmth (ochre, terracotta, cobalt, or pine) with generous whitespace |
| **Adaptive (`light-dark()`)** | General-purpose apps and docs used across bright offices and dark terminals | Declare `<meta name="color-scheme" content="light dark">`, define semantic CSS tokens (`--bg`, `--surface`, `--ink`, `--ink-muted`, `--border`, `--accent`), and test **both** schemes for contrast and elevation rather than blindly inverting colors |

When editing an existing product or repository, inspect its existing CSS tokens, Tailwind config, or component theme first and build inside that language unless the user asks for a new visual direction.

### Contrast and surface discipline

- Enforce WCAG AA everywhere: at least **4.5:1** for normal text and **3:1** for large display text (`>=24px` or `>=18.66px` bold), icons, and interactive borders/focus rings.
- **Text over shaders, gradients, or imagery:** Add a subtle radial or linear scrim behind text columns so readability never depends on the brightest frame of an animation.
- **Semantic color never works alone:** Pair red/amber/green or Before/After color shifts with explicit text labels, icons, position, or stroke patterns (`solid` vs. `dashed`) so color-vision differences and grayscale prints preserve meaning.
- **Limit accents:** Pick one primary narrative accent and at most two or three semantic accents. Reserve high saturation for focal data points, active states, and primary actions.

## Typography architecture

Strong typography carries 70% of perceived craft before a single animation runs.

### Pairing archetypes

- **Editorial narrative (briefs, launch pages, field reports):** High-contrast display serif (such as `Instrument Serif`, `Newsreader`, `Fraunces`, or `Playfair Display`) for H1/H2 and monumental numerals + clean geometric/humanist sans (`Inter`, `Plus Jakarta Sans`, `Geist`, or system UI) for prose + tabular monospace (`JetBrains Mono`, `IBM Plex Mono`, or `Geist Mono`) for eyebrows, timestamps, PR IDs, and axis ticks.
- **Precision web app (dashboards, workspaces, developer tools):** Disciplined sans-serif across UI hierarchy + crisp monospace for metrics, code, keys, and tables. Reserve serif display accents only if they match the product's voice.
- **Long-form document (specs, reports, proposals):** Readable serif or humanist sans body (`16–18px`, `1.6–1.7` line-height, `60–68ch` measure) paired with clean sans headings and monospace data/code blocks.

### Mechanical typography rules

- **Fluid display sizing:** Use `clamp()` so headlines scale effortlessly from mobile to ultrawide without awkward breakpoint jumps (for example, `font-size: clamp(2.4rem, 6.2vw, 5.5rem)` for a hero title).
- **Optical display tightening:** Large headlines need tight line-height (`0.96–1.08`) and slightly negative letter-spacing (`-0.025em` to `-0.04em`). Uppercase monospace eyebrows (`11–12px`) need the opposite: positive tracking (`0.08em–0.14em`).
- **Tabular figures everywhere numbers move or align:** Apply `font-variant-numeric: tabular-nums` to KPI tiles, counters, live simulators, tables, chart axes, tooltips, and timestamps so values never jitter horizontally.
- **Real font weights only:** Load the exact weights and italic styles you reference (or a variable font) so the browser never synthesizes blurry faux-bold or slanted faux-italic glyphs.

## Composition and layout rhythm

Uniform 3-column grids of identical bordered cards make work feel templated. Build pacing instead:

1. **Opening thesis in one viewport:** Eyebrow/context pill, crisp headline (italic or accent-colored key figure when it sharpens meaning), 2–4 line plain-English summary, and either a primary action or 3–4 anchor KPIs visible without scrolling.
2. **Alternate density and openness:** Follow a dense interactive simulator or multi-view chart with an open hairline-divided numeral spread or an asymmetric 2-column narrative + visual callout.
3. **Reserve containers for interactive work:** Let headings, prose, and big milestone figures sit directly on the canvas separated by spacing and subtle `1px` hairlines; save elevated cards and distinct borders for interactive canvases, charts, controls, and grouped records.
4. **Spacing and radius hierarchy:** Use an 8px rhythm (`8, 16, 24, 32, 48, 64, 96`) where outer section margins always exceed internal panel padding. Step border radii intentionally (outer frame > inner control > badge/pill) rather than slapping one radius onto every element.
5. **Vector icons, not emoji chrome:** Draw clean inline SVG icons with consistent `viewBox="0 0 24 24"`, uniform stroke width (`1.5–2px`), and `currentColor` inheritance. Keep emoji out of navigation, badges, and status indicators unless the user explicitly wants emoji.

## Surface-specific ergonomics

### Web apps and dashboards

- **Real workflows first:** Prioritize clear navigation, visible current state, fast scanning, keyboard accessibility, and unambiguous primary/secondary actions.
- **Complete state coverage:** Design real empty states (with helpful next action), non-janky loading skeletons/spinners, inline validation, truthful error recovery, and destructive confirmation boundaries — never ship only the populated happy path.
- **Density calibration:** Daily operational tools tolerate higher density and tighter chrome than marketing pages; keep controls aligned, tables scannable, and sticky headers compact.

### Narrative pages and interactive briefs

- **Executive top, engineer depth:** Tell the complete story in plain English across headlines, captions, and interactive visuals; move raw data tables, PRs, SQL, or logs into expandable drawers.
- **Deep-linkable chapters:** Give major sections stable `id`s, `scroll-margin-top` matching any fixed top bar plus breathing room, and compact section navigation.

### Visual HTML documents

- **Print-ready by default:** Keep reading width bounded, use clear figure captions and provenance notes, and pair any screen-only interactive control with a sensible static/printed representation under `@media print`.

## Favicons and tab identity

Every web page, app, interactive brief, and HTML document needs a bespoke favicon. Missing favicons produce ugly default browser globes, leftover Vite/Next icons, and noisy `/favicon.ico` 404s in DevTools.

### Favicon craft rules

- **Distill the piece's visual motif:** Reuse the core geometry and 2–3 colors from the artifact itself (for example, an accretion ring for a cosmic report, a calm waveform/status glyph for a stability brief, or a crisp monogram/mark for an app).
- **Design for `16×16` legibility on a `32×32` `viewBox`:** Use 2–4 bold geometric primitives with strokes `>= 1.5` units wide. Never put tiny text or intricate details that turn to mud in a browser tab.
- **Survive light AND dark browser tabs:** Either sit the mark inside a rounded container badge (`<rect width="32" height="32" rx="7" .../>`) with reliable internal contrast, or embed a tiny `<style>@media (prefers-color-scheme: dark) { ... }</style>` inside the SVG icon so the glyph adapts to the browser chrome.

### Implementation patterns

**Standalone HTML page — or strict-CSP host whose `img-src` allows `data:` (single inline request-free `<link>`):**

```html
<link
  rel="icon"
  type="image/svg+xml"
  href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b1220'/%3E%3Cpath d='M6 21l6-10 5 7 4-5 5 8' fill='none' stroke='%2334d399' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
/>
```

Encode `#` as `%23` and `<` / `>` as `%3C` / `%3E` inside the data URI so every browser parses it cleanly. If a strict-CSP host disallows `data:` in `img-src` (for example `img-src 'self'`), serve a same-origin file instead (`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`) — see [delivery-and-packaging.md](delivery-and-packaging.md) for CSP rules.

**Multi-file web app or same-origin-only CSP host:**

- Ship `public/favicon.svg` as the crisp scalable primary icon (`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`).
- Provide a fallback `/favicon.ico` (or `32×32` PNG) and `apple-touch-icon` (`180×180` PNG) plus `<meta name="theme-color" content="...">` when the app may be pinned to mobile home screens or bookmarked across browsers.
- Delete or replace any default framework icon files (`vite.svg`, `favicon.ico`, Next/Astro placeholder icons) so the starter logo never leaks into production.
