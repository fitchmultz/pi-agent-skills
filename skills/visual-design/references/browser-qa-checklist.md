# Browser Visual and Functional QA Checklist

Read this reference before completing visual work. Never claim a page, app, or document looks right or works cleanly without rendering it in a real browser and visually inspecting the captured PNG screenshots.

## 1. Serve over real HTTP

- **Web app:** Run the project's dev or preview server (`vite`, `next`, `astro`, etc.) and capture against `http://127.0.0.1:<port>`.
- **Standalone HTML or strict-CSP page:** Start a temporary local HTTP server on loopback (`127.0.0.1`) rather than opening `file://` directly, because `file://` changes CORS, ES module loading, font behavior, and CSP enforcement.
- **Emulate target CSP when shipping to a strict host:** Serve the standalone HTML with a small local Node HTTP server that attaches the destination host's exact `Content-Security-Policy` header so blocked scripts, styles, fonts, or `data:` favicons fail immediately during QA instead of after publish.

## 2. Choose an available browser runner

1. Inspect the active tool catalog first (and check deferred tools with `tool_search` if needed). When `agent_browser` is available, use it to open the page, click through states, check `console` and `errors`, resize viewports, and capture PNG screenshots.
2. Otherwise, drive headless Chromium via Playwright (`playwright`) or installed Chrome/Chromium from the shell.
3. Open **every** captured PNG with native image reading and visually inspect it — do not rely only on exit codes, DOM snapshots, or image dimensions.

## 3. Capture and inspect the required views

| Check | What to capture and inspect visually |
| --- | --- |
| **Desktop above-the-fold (`1440×900`, 2× DPR)** | Headline scale, contrast over hero visuals, clean nav alignment, primary KPIs/actions visible without awkward crowding, no clipped text. |
| **Primary interactive states** | Flip every state toggle (`Before` ↔ `After`, `Storm` ↔ `Calm`, light ↔ dark), press simulator triggers (`Simulate Spike`), switch every chart/data tab, open expandable drawers/modals, and test tooltips near both the **leftmost** and **rightmost** points to confirm edge clamping. |
| **App workflow states** (for web apps) | Verify real navigation, form submission/validation, loading state, empty state, and error recovery state — not just seeded happy-path fixtures. |
| **Scrolled chapters and anchor jumps** | Scroll through each major section and click nav anchor links. Check that sticky headers never overlap or slice section headings (`scroll-margin-top`), and that scroll-triggered reveals or rolling counters finish completely with zero stuck `opacity: 0` or mid-transition blur. |
| **Mobile layout (`390×844`)** | Readable font sizes, clean vertical rhythm, touch targets `>= 44×44px`, responsive charts/tables without crushed labels, and zero horizontal page overflow. |
| **Reduced motion (`prefers-reduced-motion: reduce`)** | Emulate reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`). Confirm ambient WebGL/Canvas loops pause or render static fallbacks, and counters/sections render immediately in their crisp final state. |
| **Print preview** (documents and briefs) | Emulate print media (`page.emulateMedia({ media: 'print' })`) when readers may print or save PDF. Confirm light background, dark legible text, no cut-off charts, and no invisible reveal blocks. |

## 4. Runtime assertions to verify alongside screenshots

Collect these signals in the same browser pass; all must pass before completion:

- **Zero console errors and zero uncaught page errors** (`console` type `error`, `pageerror`).
- **Zero failed network responses (`status >= 400` or request failed):** Specifically catches broken SRI hashes, CSP violations, missing web font files, broken images, and missing `/favicon.ico` 404s.
- **Favicon verified:** Confirm `document.querySelector('link[rel~="icon"]')` is present. For an external favicon file, confirm HTTP `200`; for `data:image/svg+xml`, confirm the URI decodes cleanly into valid `<svg ...>...</svg>` markup and loads into an `Image` element with non-zero dimensions (`naturalWidth > 0`).
- **Fonts actually loaded:** Await `document.fonts.ready` and verify the declared display/body/mono families report `status === "loaded"` (so typos or blocked CDNs cannot silently degrade to system serif/sans unnoticed).
- **Zero horizontal overflow:** Verify `document.documentElement.scrollWidth <= window.innerWidth` at both `1440px` and `390px`.
- **Keyboard focus sanity:** Tab through primary toggles, tabs, drawers, and controls to confirm logical order and visible `:focus-visible` styling.

## 5. Recurring visual defects to hunt for

Check every screenshot explicitly against these common real-world misses:

1. **Sticky header slicing a heading** after an anchor jump or mid-scroll capture → add `scroll-margin-top` and adequate top padding on sections.
2. **Half-settled animations in screenshots** (blurred rolling odometers, elements stuck at `opacity: 0.2`) → wait for transition completion in QA *and* ensure transitions are short, deterministic, and instant under `prefers-reduced-motion: reduce`.
3. **Tooltip clipping at chart edges** → compute tooltip `left`/`top` relative to container width and flip left/right near boundaries.
4. **Low contrast over glowing shaders or light photos** → add a subtle dark/light gradient scrim beneath text columns.
5. **Axis/label collisions on narrow viewports** → thin tick density on narrow widths, wrap or abbreviate dates cleanly, or switch wide charts to horizontal scroll with clear scroll affordance.
6. **Leftover starter favicon or `/favicon.ico` 404** → ensure the custom icon `<link rel="icon">` is active and no broken default favicon reference remains.

## 6. Fix, re-inspect, and clean up

When QA uncovers a defect, fix structural, layout, contrast, or runtime causes first, then re-capture and visually inspect every affected view to verify the fix. Stop temporary local servers and delete disposable screenshot directories before delivering, unless the user asked to retain capture artifacts.
