---
name: diagram-creation
description: "Create and render polished technical diagrams as editable SVG or D2 plus PNG/SVG: architecture, sequence, data-flow, dependency, lifecycle, and before/after visuals. Use when a user asks for a diagram or rendered system/process image. Do not use for statistical charts, slide decks, image editing, or product screenshots."
metadata:
  version: "2.0.0"
  owner: "local"
  status: "active"
---

# Diagram Creation

## Goal

Turn source material into a truthful, editable, visually polished technical diagram. Choose composition and renderer from the visual question instead of forcing every request through one layout engine. Layout hygiene is the first quality gate; art direction raises a structurally sound diagram to the requested visual bar.

## Success criteria

- The diagram answers the requested visual question and reflects inspected source material rather than assumptions.
- Diagram grammar, abstraction, composition, renderer, and number of outputs fit the request instead of a bundled template.
- Every primary path and material boundary relationship remains traceable from source to outcome.
- Parallel work, conditions, and state transitions are not accidentally presented as one sequence.
- Hierarchy, typography, spacing, routing, contrast, and depth feel intentional at the destination size. A request for professional, modern, polished, presentation-ready, or visually striking work must not receive a default box-and-arrow render.
- Every final PNG, destination-width preview, and overlapping native-resolution crop passes full decode verification and is actually opened and visually inspected. File headers, dimensions, or a successful render command are not visual inspection.
- No connector obscures component, group, or boundary text in any selected render.
- Final editable source and raster/vector exports are delivered; temporary review images and rejected candidates are removed.

## Use when

- Creating or updating architecture, sequence, flow, dependency, lifecycle, state, topology, or before/after technical diagrams.
- Turning source code, docs, logs, traces, or a design discussion into a rendered system/process image.
- A user asks for an editable technical diagram plus image exports.

## Do not use when

- The requested artifact is a statistical/data chart, slide deck, freeform illustration, logo, screenshot, or browser-product recording.
- The user only wants prose and no visual artifact.
- A required proprietary design file must be edited in its native application.

## Setup

Check only the tools required by the selected mode:

```bash
command -v rsvg-convert
command -v node
command -v d2 # D2 mode only
command -v python3 # D2 publication locking only
```

On macOS, install missing renderers with `brew install librsvg d2`; install Python 3 with `brew install python` if D2 mode needs it. Follow the environment's package-install policy elsewhere. Do not add diagram tooling to a project's dependency manifest unless requested.

D2 publication uses Python 3's standard-library `fcntl.flock` on macOS and Linux. A competing publisher for the same output base fails before changing either final artifact; retry after the active renderer finishes. Different output bases remain independent. The hidden `.<output-base>.diagram.lock` sidecar stays beside the outputs: do not delete or replace it while renderers may be running. The operating system releases the lock after the renderer and its publication children exit, even after SIGKILL; there is no stale PID lock to clear. SIGKILL cannot run rollback, so interrupted `.diagram-backup.*` and `.diagram-publish.*` directories retain recovery artifacts.

## Decision sequence

Decide in this order:

1. **Semantic model:** verified entities, order, ownership, conditions, terminal states, concurrency, and required relationships.
2. **Composition contract:** reading direction, aspect ratio, zones or phases, primary subject, connector lanes, and destination size.
3. **Renderer:** SVG-native or D2, based on the control the composition and visual bar require.
4. **Art direction:** light or dark, typography, palette, depth, icon language, and emphasis.
5. **Render integrity and visual QA:** full decode, actual image inspection, correction, and deterministic final render.

Do not choose colors or effects before the semantic model and composition work.

## Choose the visual grammar

- **Temporal interaction:** use a signal sequence with no more than four or five participant columns horizontally. Use phase bands and compact event labels when they clarify the story.
- **Lifecycle or narrative:** use an editorial storyboard with numbered stages, varied card emphasis, and an obvious reading path.
- **Architecture or ownership zones:** use a system map with restrained surfaces, clear boundaries, a dominant subject, and dedicated connector lanes.
- **Dense dependency, topology, or data flow:** prefer D2 when automatic graph layout materially improves structure or continued graph editing is the priority.
- **State machine:** let transitions dominate. Avoid surrounding architecture unless requested.

These are routing patterns, not fixed templates. All can be light, dark, compact, expansive, formal, or expressive according to the request.

## Choose the renderer

### SVG-native

Use editable SVG as the canonical source when any of these are true:

- The user asks for professional, modern, polished, visually striking, editorial, cinematic, product-quality, or presentation-ready output.
- Precise hierarchy, bespoke composition, visual rhythm, iconography, layered depth, or tightly controlled routing matters more than automatic layout.
- The view is a storyboard, signal sequence, or zone-based system map that benefits from explicit coordinates.

Read `references/svg-native.md` before authoring. `assets/modern-svg-starter.svg` is an optional design-token and component starter, never a required composition. Render with `scripts/render_svg.sh`.

### D2

Use D2 when the user explicitly requests D2, the graph is dense or topology-led, automatic layout is a material advantage, or rapid structural editing matters more than bespoke art direction. Read the D2 sections of `references/style-guide.md`. Render with `scripts/render_diagram.sh`.

D2's default render can be clean and professional, but do not claim it meets a bespoke visual-art-direction request unless the actual result does. If a requested visual bar exposes a D2 ceiling and the user did not require D2, switch to SVG-native.

## Workflow

1. Inspect the real source material and trace relevant behavior end to end. Record exact ordering, ownership, conditions, terminal outcomes, retry identity, and unknowns. Separate verified current behavior from proposals.
2. Identify the visual question, reader, destination, expected display width, and explicit style constraints. Ask only when ambiguity would materially change truth or deliverables.
3. Choose the visual grammar and write a composition contract before authoring. Include aspect ratio, reading order, zones or phases, dominant subject, connector lanes, and a typography floor at destination width.
4. List essential paths and boundary relationships. Re-run this traceability checklist after every structural reflow; never cure a crossing by deleting a required connection.
5. Select SVG-native or D2 using the criteria above. Explicit user choices override defaults.
6. Author concise labels and semantic relationships. Treat each directed edge as a causal or ordering claim. Fork independent work explicitly and distinguish conditions, current/proposed state, and success/failure behavior.
7. Render with the mode's bundled script. Pass `--preview-width` when the destination width is known. Both renderers create a destination-width preview and overlapping native crops, and fully decode every PNG before reporting success.
8. Actually open the complete PNG, every native crop, and the exact-width preview. The preview is the composition and hierarchy gate; the full image and crops are the typography, connector, and rendering-integrity gate.
9. Fix layout defects structurally before adding polish. Reflow, wrap, resize, reduce columns, stack phases, reserve connector lanes, or use labeled boundary ports. Then tune typography, color, depth, icons, and effects.
10. Repeat render and image inspection until every output passes. Do not stop at syntactically valid source or a successful command.
11. Remove failed prototypes and review directories. Re-render the selected source to a temporary location without review images. Require a byte match when deterministic; otherwise replace the selected output with the fresh render and inspect it again.

## Default visual direction

Apply only when the user leaves styling unspecified:

- Use a modern product-documentation aesthetic with strong hierarchy, restrained color, generous spacing, and crisp routing.
- Choose light editorial styling for narrative clarity or dark glass/blueprint styling for system depth, based on the content and destination.
- Prefer Inter or a system sans for display/body text and JetBrains Mono or a system mono for eyebrows, phases, statuses, and micro-labels.
- Use two to four semantic accents consistently. Use status labels or shapes in addition to color.
- Use subtle gradients, grid texture, bloom, shadow, and glow only when they reinforce hierarchy or grouping.
- Use simple inline vector icons with a consistent stroke/fill language. Do not use emoji as technical iconography.
- Vary scale and emphasis. Avoid a canvas where every item is an equal rounded rectangle with a bright outline.

In D2 mode with no style direction, use Dark Mauve theme `200`, ELK, and 40px padding as a reliable structural baseline. Inspect the result rather than treating these values as proof of quality.

## Non-negotiable layout hygiene

- One obvious entry point and reading order.
- No connector through any label, icon, status chip, card, or boundary title.
- Connectors are designed with node placement, not routed as an afterthought.
- Independent paths remain visibly independent; spatial stacking must not imply false order.
- External actors and shared resources stay outside boundaries that do not own them.
- No unexplained dead space, accidental ribbon aspect ratio, clipped outer labels, or text below the destination-size readability floor.
- No art effect may mask a structural defect.

Read `references/style-guide.md` when source-backed traceability, dense routing, D2 authoring, or a difficult structural reflow needs more detail.

## Important rendering gotchas

- A PNG can have a readable header and still be truncated. The bundled renderers fully validate chunk CRCs and inflate image data for the final PNG, preview, and every crop.
- SVG gradients default to `objectBoundingBox`. A horizontal or vertical zero-area path can lose its gradient stroke. Use a solid stroke or `gradientUnits="userSpaceOnUse"` with explicit coordinates for such connectors.
- Draw connectors behind nodes in SVG so lines and arrowheads cannot obscure text. Keep arrow markers solid even when nearby fills use gradients.
- D2 with ELK can turn nested cross-container edges into extreme width or height. Use local edges, aligned lanes, labeled boundary ports, explicit grids, or another composition.
- D2 grid placement can be column-major under `grid-columns`; verify declaration order or use explicit `grid-rows` when reading order matters.
- D2 semantic queue or cylinder shapes can pinch long labels. Use them only for short labels; a rounded rectangle with a role label is often clearer.
- Outer container labels and sequence group labels can collide with edges or lifelines. Use internal headline nodes, move labels, or change composition.
- D2 Markdown labels create SVG `foreignObject`, which librsvg drops. Use plain text labels.
- A wide native image may look good while becoming unreadable when embedded. The exact-width preview decides whether the composition passes.

## Available resources

- `scripts/render_svg.sh [options] INPUT.svg [OUTPUT.png]` validates portable SVG, renders PNG, fully decodes all rasters, and creates temporary review images. The input SVG remains canonical editable source.
- `scripts/render_diagram.sh [options] INPUT.d2 [OUTPUT_BASE]` validates D2, renders SVG/PNG, fully decodes all rasters, and creates temporary review images.
- `scripts/verify_png.mjs IMAGE.png [...]` verifies PNG structure, chunk CRCs, complete IDAT inflation, scanline sizes, and dimensions.
- `references/style-guide.md` contains shared layout, traceability, D2 patterns, and visual review guidance.
- `references/svg-native.md` contains the modern SVG design system, composition patterns, and renderer-specific invariants.
- `assets/modern-svg-starter.svg` provides optional reusable tokens and components for SVG-native work.

## Validation

SVG-native:

```bash
/path/to/diagram-creation/scripts/render_svg.sh --preview-width 900 \
  path/to/diagram.svg path/to/diagram.png
```

D2:

```bash
d2 validate path/to/diagram.d2
/path/to/diagram-creation/scripts/render_diagram.sh --preview-width 900 \
  path/to/diagram.d2 path/to/diagram
```

For either mode, open the final PNG and every file in the printed review directory. After inspection, remove the review directory. Then prove source/output alignment with a clean `--no-review-images` render to a temporary path and compare bytes when deterministic.

## Output contract

Return:

- **SVG-native:** editable `.svg` source and rendered `.png`.
- **D2:** editable `.d2` source plus rendered `.svg` and `.png`.
- **Validation:** renderer result, dimensions, full-decode success, source/render alignment, and confirmation that the complete image, exact-width preview, and every native crop were visually inspected.
- **Deviations:** only user-requested variations or unresolved factual and visual limitations.
