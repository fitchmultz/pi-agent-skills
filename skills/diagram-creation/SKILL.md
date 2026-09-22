---
name: diagram-creation
description: "Create rendered technical diagrams with editable SVG or D2 source and PNG/SVG exports: architecture, sequence, data flow, dependency, lifecycle, state, and before/after. Not statistical charts, slide decks, illustrations, image editing, or product screenshots."
metadata:
  version: "2.1.0"
  owner: "local"
  status: "active"
---

# Diagram Creation

Deliver a source-backed, editable diagram that answers the user's visual question and meets the requested visual bar. A successful render command proves neither truth nor visual quality.

## Prerequisites

Both modes need Node and `rsvg-convert` (librsvg). D2 also needs `d2` and Python 3 with POSIX `fcntl.flock` (macOS/Linux). Check only the selected mode's tools. On macOS, missing renderers can be installed with `brew install librsvg d2`, and Python with `brew install python`, subject to environment install policy. Do not add tooling to project dependencies unless requested.

Resolve all scripts, assets, and references below from this skill directory, not the caller's cwd. A proprietary native-design-file task needs its own application; do not substitute a diagram export.

## Choose before authoring

Decide in order: verified semantic model → composition → renderer → art direction → render and visual QA.

| Visual question | Useful grammar |
| --- | --- |
| Temporal interaction | Signal sequence, at most 4–5 participant columns; phase bands and compact events |
| Lifecycle/narrative | Numbered storyboard with varied emphasis and a clear reading path |
| Architecture/ownership | System map with real boundaries, dominant subject, and connector lanes |
| Dense dependency/topology/data flow | Graph layout, often D2 |
| State machine | Transitions first; no surrounding architecture unless requested |

These are choices, not fixed templates. Follow explicit user renderer/style choices.

- **SVG-native:** default for professional, modern, polished, editorial, cinematic, presentation-ready, or visually striking requests; also for precise hierarchy, icons, depth, and routing. Read `references/svg-native.md` before authoring. `assets/modern-svg-starter.svg` is an optional token/component starter, never a mandated composition.
- **D2:** use when explicitly requested, density benefits from automatic layout, or rapid graph editing matters more than bespoke art direction. Read `references/style-guide.md`, including publication and renderer constraints. A clean default render does not automatically meet a bespoke visual request; switch to SVG if D2's ceiling prevents it and D2 was not required.

## Workflow

1. Inspect the real source and trace ordering, ownership, conditions, concurrency, terminal outcomes, retry identity, and unknowns. Separate verified current behavior from proposals.
2. Establish reader, destination/display width, visual question, and explicit style constraints. Ask only if ambiguity changes truth or deliverables.
3. Write a composition contract: aspect ratio, reading order, zones/phases, dominant subject, connector lanes, and a readable typography floor at destination width.
4. List every essential path and boundary relationship. Each directed edge asserts causality/order/dependency. Distinguish association, conditions, success/failure, current/proposed state, and independent branches. Recheck this list after every reflow; never remove a required edge merely to remove a crossing.
5. Author concise labels and meaningful hierarchy, then render with the selected bundled script. Set `--preview-width` when destination width is known.
6. **Open and inspect the complete PNG, exact-width preview, and every overlapping native-resolution crop.** All must pass full decode verification. The preview checks composition/readability; full image and crops check text, connectors, and raster integrity. Headers/dimensions alone are insufficient.
7. Fix structure before decoration: wrap, resize, stack phases, reduce columns, reserve lanes, or use labeled boundary ports. Then tune typography, palette, icons, depth, and effects. Render and inspect again until every output passes.
8. Remove rejected candidates and review directories. Render the selected source again to a temporary path with `--no-review-images`. Require a byte match when deterministic; otherwise replace the export with the fresh render and inspect again.

## Visual bar

When style is unspecified, use modern product-documentation styling: generous spacing, crisp routes, strong hierarchy, two to four semantic accents, status text/shapes beyond color, and consistent inline vector icons without emoji. Prefer Inter/system sans and JetBrains Mono/system mono. Light editorial or dark glass/blueprint should follow content and destination; gradients, shadows, texture, and glow must reinforce hierarchy. Avoid equal bright-outlined rectangles everywhere.

D2's fallback is Dark Mauve theme `200`, ELK, 40px padding. Inspect the result; defaults are no quality guarantee.

Require one clear entry/reading order, real ownership boundaries, independent paths that do not imply false sequencing, and readable unclipped labels without dead space or extreme ribbon dimensions. No connector may obscure a label, icon, chip, card, or boundary title. Effects cannot hide layout defects. Read `references/style-guide.md` for difficult routing or reflow even in SVG mode.

## Render and validate

```bash
# SVG-native: input SVG stays canonical.
<skill-dir>/scripts/render_svg.sh --preview-width 900 diagram.svg diagram.png
# D2: produces SVG and PNG.
d2 validate diagram.d2
<skill-dir>/scripts/render_diagram.sh --preview-width 900 diagram.d2 diagram
```

Both scripts fully decode final/preview/crop PNGs, checking CRCs and IDAT data; `scripts/verify_png.mjs IMAGE.png [...]` exposes that check directly. Open every image in the printed review directory before removing it. Then prove final source/export alignment with the clean rerender above.

## Delivery

- SVG-native: editable `.svg` and rendered `.png`.
- D2: editable `.d2`, rendered `.svg` and `.png`.
- Report renderer result, dimensions, full-decode success, source/render alignment, and actual inspection of the complete image, destination-width preview, and every native crop.
- State only user-requested deviations or unresolved factual/visual limits. Do not call output polished while a layout or inspection gate is unmet.
