---
name: visual-design
description: "Design and build visual pages, web apps, interactive briefs, and documents with art direction, data viz, and motion. Not SVG/D2 diagrams."
metadata:
  version: "1.0.0"
  owner: "local"
  status: "active"
---

# Visual Design

Design and build truthful, high-craft web pages, web apps, interactive briefs, and HTML documents that make complex ideas click immediately and feel authored for their exact subject. Visual craft amplifies comprehension; never fabricate data, fake UI states, or trade legibility for spectacle.

## Scope and boundaries

- Use this skill when designing, building, or visually elevating web pages, interactive web apps, dashboards, launch pages, interactive briefs/field reports, or visual HTML documents across any web stack (React, Next.js, Vite, Astro, Svelte, or vanilla HTML/CSS/JS).
- Do not use this skill for standalone static SVG/D2 technical diagrams (`diagram-creation`), read-only usability/recovery audits (`ux-review`), or exploratory bug-hunting QA (`dogfood`).
- Honor explicit user requirements, brand constraints, and existing project design systems. Make sensible defaults for unspecified visual choices; ask only when an unresolved choice would materially change the audience, scope, or deliverable.

## Core workflow

### 1. Ground in real facts and surface context

Inspect the real data, metrics, code, or product behavior before designing anything. Separate verified facts from estimates, projections, or simulated illustrations; never invent numbers, quotes, or activity to make a layout look fuller.

Establish four inputs up front:

1. **Audience and reading context:** executive skim, daily-driver operator, public announcement, or deep technical walkthrough.
2. **Surface class:** interactive web app, narrative page/brief, or printable visual document.
3. **System baseline:** an existing codebase with tokens/components to respect, or a greenfield surface.
4. **Delivery constraints:** standard app build, standalone single-file HTML, strict-CSP static host, or print/PDF export.

### 2. Write a short Art Direction Contract before building

Commit to four explicit design choices before writing layout code (read [references/art-direction-and-systems.md](references/art-direction-and-systems.md) for palettes, pairings, surface ergonomics, and favicon craft):

- **Subject-derived color scheme (no default house palette):** Choose light, dark, or adaptive (`color-scheme`, `light-dark()`, or explicit toggle) to fit the subject and reading duration — warm editorial paper for long-form docs, crisp daylight for daily-driver web apps, atmospheric dark telemetry for incident retrospectives or developer showcases, or a bold studio/brand palette when the subject calls for warmth or energy. Maintain real WCAG AA contrast (at least 4.5:1 for body copy, 3:1 for large display text and UI controls) across default, hover, focus, disabled, and translucent overlay states.
- **Deliberate typography:** Choose a restrained 2–3 family pairing with real structural contrast (for example, an expressive display serif + crisp sans + monospace for narrative pages, or disciplined sans + tabular monospace for dense apps). Use fluid `clamp()` display sizing, tighter tracking on monumental headlines, a comfortable body measure (`58–70ch`), and `font-variant-numeric: tabular-nums` on every KPI, counter, table, timestamp, and chart axis.
- **Rhythm over uniform card grids:** Alternate scale, density, and open space — monumental opening thesis, hairline-divided spreads, focused interactive stages, and compact scannable rows. Avoid wrapping every paragraph or metric in identical bordered cards.
- **Signature visual anchor and mandatory favicon:** Give the artifact one coherent motif tied to its subject, and **always ship a bespoke favicon** derived from that motif and palette. Never leave a blank browser globe, leftover starter framework logo, or `/favicon.ico` 404. Use a clean inline `data:image/svg+xml` `<link rel="icon">` for standalone/strict-CSP HTML pages, or `favicon.svg` plus standard fallbacks (`favicon.ico`, `apple-touch-icon`) for multi-file web apps.

### 3. Turn complex ideas into interactive visual explanations

When the artifact explains a system, story, tradeoff, or dataset, lead with plain-English takeaways and interactive visual proof. Tuck raw queries, commit/PR tables, logs, JSON receipts, and methodology into collapsible progressive-disclosure drawers (`<details>` or inspector panels) with copy buttons so executives and engineers both succeed on one surface.

Choose 1–3 high-leverage interactive mechanisms that directly clarify the subject instead of piling on gimmicks (read [references/interactive-explanations.md](references/interactive-explanations.md) for patterns and engineering guardrails):

- **State-reactive hero or living motif:** WebGL, Canvas 2D, or reactive SVG whose lighting, geometry, or motion shifts with a real state switch (Before/After, Storm/Calm, Scenario A/B) or scroll chapter.
- **Playable system simulator:** Cause-and-effect sandbox with a concrete trigger (`Simulate Traffic Spike`, `Drop Node`, `Toggle Cache`) and live reactive counters so readers feel why an architecture or policy works.
- **Countable unit visualizations and proportion fields:** Dot-strips, waffle ratios (such as `1 in 29` vs. `1 in 143`), or item-level stacked dot columns where one mark equals one real record, paired with filter pills and inspect-on-hover/click.
- **Synchronized timeline race or comparison scrubber:** Parallel animated tracks or a draggable Before/After split that makes recovery, latency, or duration differences unmistakable without paragraphs of explanation.
- **Multi-view analytical charts:** Tabbed lenses over one dataset, subtle context bands (weekends, release windows, incident spans), direct peak callouts, and hover + keyboard-focusable tooltips pairing exact values with a one-sentence narrative note.
- **Live "what-if" parameter explorer:** Sliders, presets, or toggleable assumptions that recompute real models and redraw visuals immediately.
- **Scroll-choreographed stage and chapter rail:** Sticky visual frame plus minimal progress rail for multi-chapter briefs, unwinding cleanly into stacked frames on narrow screens and reduced motion.

### 4. Engineer cleanly for the real surface

- **Match the surface's real obligations:** In web apps, build complete navigation, keyboard operation, and truthful loading, empty, error, and confirmation states — never deliver a brittle showcase facade. In existing codebases, extend existing design tokens and component primitives rather than fighting them. In documents and briefs, add `@media print` rules so printed or PDF exports stay readable without clipped charts or blank reveal blocks.
- **Motion and reduced-motion discipline:** Animate `transform`, `opacity`, or Canvas/WebGL cleanly, pause offscreen/hidden loops, and ensure counters/odometers settle crisply. Always implement `@media (prefers-reduced-motion: reduce)` so ambient motion pauses and every counter or revealed section renders immediately in its clean final state.
- **Structural polish that prevents recurring bugs:** Set `scroll-margin-top` on anchored sections under sticky headers; prevent horizontal overflow across desktop and mobile widths; use real `<button>` elements, ARIA roles/states, and `:focus-visible` outlines for tabs, tooltips, and drawers; draw consistent inline vector icons instead of relying on emoji for UI chrome.
- **Packaging, fonts, and CSP:** Read [references/delivery-and-packaging.md](references/delivery-and-packaging.md) when packaging standalone HTML, strict-CSP hosted pages (exact version pins + verified `sha384` SRI hashes or self-contained bundles), multi-file web app icon/manifest sets, or print-ready documents.

### 5. Verify visually and functionally in a real browser

Never claim visual work is finished or polished from source code alone. Serve the artifact over real HTTP (the app's dev/preview server or a temporary local HTTP server — never rely on `file://` alone when fonts, modules, CSP, or fetch calls matter) and inspect actual rendered PNG screenshots with native image reading.

Check active browser tools (`agent_browser`, using `tool_search` first if deferred) or run headless Chromium/Playwright from the shell. Follow [references/browser-qa-checklist.md](references/browser-qa-checklist.md) to verify:

- desktop (`1440×900`) and mobile (`390×844`) layouts with zero horizontal overflow,
- every primary interactive state (toggles, tabs, simulator trigger, tooltips at both chart edges, drawers, and app loading/empty/error states),
- scrolled sections and nav anchor jumps (catching sticky-header clipping and mid-animation freezes),
- `prefers-reduced-motion: reduce` settled rendering,
- loaded web fonts, valid favicon with zero `/favicon.ico` 404s, and zero console, page, network, or CSP errors.

Fix structural, legibility, and runtime issues before visual micro-tweaks, then re-capture and visually re-inspect every changed view. Remove temporary capture directories and stop temporary local servers when finished unless the user asked to keep them.

## References

Read a reference only when the task reaches its scope:

| Reference | Read when |
| --- | --- |
| [references/art-direction-and-systems.md](references/art-direction-and-systems.md) | Choosing a color system (light/dark/adaptive), typographic pairing, layout rhythm, app/page/document ergonomics, or designing a favicon. |
| [references/interactive-explanations.md](references/interactive-explanations.md) | Designing state-reactive heroes, simulators, countable unit plots, timeline races, narrative-tooltip charts, what-if calculators, scrollytelling stages, or evidence drawers. |
| [references/delivery-and-packaging.md](references/delivery-and-packaging.md) | Shipping standalone HTML, strict-CSP hosted pages (SRI hashes, inline assets), multi-file web apps, font loading, favicon sets, or print-ready documents. |
| [references/browser-qa-checklist.md](references/browser-qa-checklist.md) | Running headless browser capture, runtime/CSP/favicon/font assertions, reduced-motion checks, and visual screenshot inspection. |

## Failure modes to reject

- **Boilerplate defaults:** forcing one house dark theme or generic purple gradient regardless of subject, or turning every section into identical 3-column bordered cards.
- **Missing tab identity:** shipping without a custom favicon, leaving default Vite/Next icons, or ignoring `/favicon.ico` 404 console noise.
- **Decorative bloat:** burning GPU on ambient effects unrelated to the data/state, or trapping key numbers inside hover-only charts inaccessible to touch and keyboard users.
- **Uninspected or frozen output:** claiming polish without opening screenshots, shipping sticky headers that slice section titles, or leaving counters frozen mid-blur or hidden at `opacity: 0`.
- **Unverified external assets or invented data:** guessing SRI hashes, breaking under strict CSP, or inventing placeholder metrics to fill empty slots.

## Delivery

Report concisely:

1. What was built and its delivery format (web app, standalone HTML, strict-CSP page, or printable document).
2. Key art direction and interactive choices (including the color scheme rationale and favicon).
3. Real browser verification evidence: viewports, interactive states, reduced-motion check, favicon/font load, and console/network/CSP status.
4. Any real remaining limit (for example, if headless browser execution was unavailable in the current environment, state that honestly instead of claiming visual verification).
