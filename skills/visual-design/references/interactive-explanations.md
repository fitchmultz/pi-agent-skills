# Interactive Visual Explanations

Read this reference when building interactive walkthroughs, visual proofs, data visualizations, simulators, shaders/Canvas motifs, or scrollytelling stages.

## Choose mechanics that earn their pixels

Every interactive element should make a real concept, tradeoff, or dataset click faster than prose alone. Pick 1–3 complementary patterns for a page or app rather than cramming every pattern onto one screen.

## 1. State-reactive hero and living ambient motifs

Instead of static wallpaper or unrelated floating blobs, tie the hero visual directly to a real state toggle or narrative axis (for example: `Storm` ↔ `Calm`, `Before` ↔ `After`, `Unindexed` ↔ `Indexed`, or active scroll chapter).

- **High-craft visual mediums:**
  - **WebGL2 fragment shader:** ideal for atmospheric flow fields, waveforms, thermal/load gradients, gravitational lenses, or signal interference. Apply smooth uniform interpolation (`lerp`) on toggle and filmic/ACES tone mapping so bright peaks never clip harshly.
  - **Procedural Canvas 2D:** ideal for crisp geometric networks, particle streams, radar/wave sweeps, or kinetic grids when WebGL is unnecessary.
  - **Layered reactive SVG:** ideal for light-mode editorial surfaces, crisp architectural silhouettes, and strict low-power environments.
- **Engineering guardrails:**
  - Cap DPR at `Math.min(window.devicePixelRatio || 1, 2)` to protect battery and frame rate.
  - Pause the `requestAnimationFrame` loop via `IntersectionObserver` when scrolled offscreen and via `visibilitychange` when the tab is hidden.
  - Always provide a crisp static CSS/SVG fallback if WebGL context creation fails or `@media (prefers-reduced-motion: reduce)` matches.
  - Keep a stable contrast scrim behind hero headlines and KPI cards regardless of animation state.

## 2. Playable system simulators ("feel the mechanism")

When explaining *why* a system broke, slowed down, or scaled cleanly, build a compact playable sandbox right inside the page:

- **Essential anatomy:**
  1. **Mode toggle** (`Before · Shared Bottleneck` ↔ `After · Isolated Lanes`).
  2. **Action trigger** (`Simulate Traffic Spike`, `Drop Primary Node`, `Invalidate Cache`) so the reader causes an event and watches the system react immediately.
  3. **Live animated topology** (Canvas 2D or SVG) showing requests/events moving through real stages — saturating queues and flashing drops in "Before", flowing smoothly or isolating blast radius in "After".
  4. **Reactive telemetry strip** directly below the canvas (`Load`, `Queue Depth`, `Error Rate`, `Latency`) using `tabular-nums`, clearly distinguishing simulated stress readouts from real production benchmarks.
- **Clarity rule:** Keep labels plain English first (`Shared Database`, `Edge Cache`, `Isolated Store A`) with optional technical tags (`ROUTES KV`, `503`), and include a crisp legend distinguishing live traffic from background noise.
- **Animation and physics guardrails:**
  - **Normalize to elapsed time (`dt`), never raw frame counts:** Compute `dt = Math.min(0.05, (now - lastTime) / 1000)` and drive movement, spawn accumulators, spike durations (in seconds), and fade decays (`Math.pow(factor, dt)`) from `dt`. Frame-counted `tick++` loops run 2×–4× fast on 120 Hz/144 Hz/240 Hz displays and inflate simulated counters.
  - **Roll stochastic outcomes once per stage boundary:** Stamp a one-time flag (`decided = true`) when an item enters a queue or bottleneck instead of rolling `Math.random() < p` every animation frame. Re-rolling per frame compounds across dozens of frames (`(1 - p)^N`), silently killing ~99.9% of items before they ever reach downstream nodes.
  - **Share exact path geometry between drawn wires and moving particles:** When links use `bezierCurveTo(...)`, evaluate the same cubic Bezier equation for particle positions (with minimal lane spread) rather than approximating with smoothstep/linear paths or wide jitter, so dots stay seated on their tracks.
  - **Keep node text unobstructed by draw order:** Render in `grid → wires → particles → node boxes & labels → border sparks/overlays` order, and emit drop/bounce sparks outward from the node's entry edge rather than over center labels so text stays legible under load.
  - **Preserve resting vs. stressed visual contrast:** Avoid pinning failure pills at 100% opacity during resting mode so clicking a stress trigger produces an unmistakable visual and numeric shift.

## 3. Countable unit visualizations and proportion fields

Summary percentages hide scale. When a real dataset contains tens to a couple thousand discrete records (pull requests, incidents, deploys, tests, customers), draw individual countable marks:

- **Item-level stacked dot columns:** Each column is a day/week and each dot is one real item ("Every dot is a merged PR — point or focus any dot to inspect it"). Pair with category filter pills (`All 1,250`, `Repo A 1,040`, `Repo B 210`) that highlight or filter matching dots with exact counts.
- **Proportion / reliability dot grids:** Visually compare failure rates or ratios side by side (for example, 29 dots with 1 glowing fault mark vs. 143 dots with 1 fault mark) — readers grasp a `5×` improvement instantaneously without mental arithmetic.
- **Performance and accessibility:** For >400 dots, draw on Canvas 2D with a lightweight spatial hit-test (grid bucket or column index) and expose keyboard navigation / summary text alongside hover inspection so screen readers and mobile taps can inspect records cleanly.

## 4. Synchronized timeline races and comparison scrubbers

When timing, durability, or recovery behavior is the core story, animate two scenarios on parallel aligned tracks triggered together:

- **Timeline race:** Show "Before" and "After" advancing across the same milestone stages (`Read issue → Edit code → Run tests → Open PR`), inject a real mid-run disruption (`Deploy lands`), and show the old track resetting to step 1 while the new track resumes from its saved checkpoint. Include a `Replay` button and clear state captions.
- **Draggable comparison scrubber:** For visual before/after layouts, latency waterfalls, or query-plan diffs, provide a pointer + keyboard-accessible range slider (`<input type="range">`) that scrubs smoothly between states.

## 5. Multi-view analytical charts with narrative tooltips

Avoid stacking six repetitive static charts down a page. Combine related time series into one high-craft interactive chart surface:

- **Tabbed analytical lenses:** Let readers switch perspectives on the same timeframe (`Refusals vs. Traffic`, `Overload Logs`, `Alert History`, `Latency & CPU Headroom`) via real `role="tablist"` / `role="tab"` buttons.
  - Keep tab labels compact enough that all tabs sit on one clean row at desktop width (`1440px`) rather than stranding a single orphan tab on a second row.
- **Context directly on the plot:**
  - Shade recurring context bands subtly (weekends, maintenance windows, rollout spans) and mention them in the subtitle.
  - Annotate inflection points and peaks directly on the canvas (`Nov 18 peak (3,309) · Sprint starts`) with short hairline leaders instead of burying explanations in footnotes.
  - Use dual axes sparingly and only when color-coded cleanly to match their series; otherwise prefer normalized views or stacked small multiples.
- **Narrative hover and keyboard tooltips:**
  - Trigger on pointer move, touch tap, and keyboard focus (`Left`/`Right` arrow stepping across data points).
  - Format tooltips cleanly with exact date + timezone (e.g., `UTC`), aligned `tabular-nums` values for every series, and a **one-sentence human explanation** of what happened on that day or milestone.
  - Clamp or flip tooltip horizontal/vertical positioning within the chart bounds so first and last points never clip off-screen.

## 6. Live "what-if" parameter explorers and calculators

When an artifact explains pricing, capacity, latency budgets, caching TTLs, or staffing/rollout tradeoffs, let users adjust the real levers:

- Supply 2–4 meaningful inputs (sliders, segmented choices, or toggles) plus **1-click real-world presets** (`Typical day`, `Peak burst`, `2× growth`) so readers get value before dragging anything.
- Recompute outputs from the real documented formula and update both summary figures and visual bars/curves synchronously with zero lag.
- Label assumptions transparently right beside the controls so users know what is modeled vs. measured.

## 7. Scroll-choreographed narrative stages (scrollytelling)

For multi-chapter briefs or product launches where one visual evolves across chapters:

- Pair a sticky visual stage (a shader camera angle, architectural diagram, or evolving chart) with crisp scrolling story beats driven by `IntersectionObserver` or scroll progress mapped to CSS custom properties.
- Add an unobtrusive top progress hairline and compact chapter indicator (`02 · THE ENGINE`), plus optional keyboard stepping (`J`/`K` or arrow controls when no input is focused).
- **Mandatory unwind rule:** On mobile widths (`<= 860px`) and under `@media (prefers-reduced-motion: reduce)`, disable sticky choreography and render clean sequential frames so content never traps scroll or leaves awkward blank screens.

## 8. Progressive-disclosure evidence drawers and provenance

Serve executives and technical skeptics on the same surface without drowning either:

- Keep the primary reading flow crisp and jargon-free.
- Place raw PR lists, SQL queries, alert logs, benchmark commands, and schema diffs inside clean `<details>` accordions or slide-over drawers with one-click `Copy` buttons (showing temporary `Copied` confirmation).
- End data-driven pages with a concise **Data & Provenance** strip stating the exact date window, timezone, sources, and any caveats (such as upstream outages excluded from internal failure counts).

## 9. Kinetic micro-craft and restraint

- **Rolling counters / odometers:** Animate only milestone KPIs once when scrolled into view; use `tabular-nums`, clean `overflow: hidden` digit tracks, and ensure the animation completes cleanly to a razor-sharp final state with zero residual blur. Under `prefers-reduced-motion: reduce`, render final digits immediately with no animation.
- **Stateful deep links:** Sync active tabs or major modes to URL hash or query parameters when shareable views help readers send teammates directly to a specific chart or chapter.
- **Purposeful easing:** Use smooth decelerating curves (`cubic-bezier(0.22, 1, 0.36, 1)`) for UI transitions (`150–320ms`); avoid bouncy springs or slow reveals that force readers to wait before reading.
