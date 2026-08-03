---
name: diagram-creation
description: "Create and render technical diagrams as editable D2 plus PNG/SVG: architecture, sequence, data-flow, dependency, lifecycle, and before/after visuals. Use when a user asks for a diagram or rendered system/process image. Do not use for statistical charts, slide decks, image editing, or product screenshots."
compatibility: Requires Bash, Node.js, standard Unix utilities, D2, and librsvg (`rsvg-convert`). Tested on macOS; use WSL or another POSIX shell on Windows.
metadata:
  version: "1.3.0"
  owner: "local"
  status: "active"
---

# Diagram Creation

## Goal

Turn the user's source material into the requested technical diagram, preserve editable D2 source, render SVG and PNG outputs, and visually verify the result. User requirements determine the diagram's content and composition; defaults fill only unspecified visual details.

## Success criteria

- The diagram answers the requested visual question and reflects inspected source material rather than assumptions.
- Its structure, abstraction level, layout, and number of outputs fit the request instead of a bundled template.
- Every primary path and material boundary relationship remains traceable from source to outcome.
- Parallel work, conditional branches, and state transitions are not accidentally presented as a single sequence.
- D2 validates, SVG and PNG render, and the PNG is inspected as a whole, through overlapping native-resolution crops, and at the intended display width (980px by default).
- No connector obscures component, group, or boundary text in any selected render.
- Final `.d2`, `.svg`, and `.png` paths are delivered, while discarded render candidates are removed.

## Use when

- Creating or updating architecture, sequence, flow, dependency, lifecycle, state, topology, or before/after technical diagrams.
- Turning source code, docs, logs, traces, or a design discussion into a rendered system/process image.
- A user asks for an editable diagram source plus image exports.

## Do not use when

- The requested artifact is a statistical/data chart, slide deck, freeform illustration, logo, screenshot, or browser-product recording.
- The user only wants a prose explanation and no visual artifact.
- A required proprietary design file must be edited in its native application.

## Setup

Check tools before authoring:

```bash
command -v d2
command -v rsvg-convert
```

On macOS, install missing tools with:

```bash
brew install d2 librsvg
```

Follow the environment's package-install policy elsewhere. Do not add diagram tooling to a project's dependency manifest unless requested.

## Workflow

1. Inspect the real source material and trace the relevant behavior end to end. Record exact ordering, ownership, conditions, terminal outcomes, and retry or idempotency mechanisms. Separate verified current behavior, proposals, unknowns, and conditions.
2. Identify the visual question, intended reader, destination, expected display width, and explicit constraints from the request. Ask only when ambiguity would materially change truth or deliverables.
3. Choose the diagram structure, abstraction level, layout, and number of outputs from the request and source material. Templates and examples are optional starting points, never required forms.
4. List the essential paths and boundary relationships the diagram must preserve. Use this traceability checklist after every structural reflow; never cure a crossing by silently deleting a required connection.
5. Author concise D2 labels and semantic relationships. Treat every directed edge as a causal or ordering claim. Fork independent work explicitly, split branches whose ordering differs, and use shapes and colors for meaning rather than decoration.
6. Render with `scripts/render_diagram.sh`. It creates the final SVG/PNG plus a temporary review directory containing a 980px preview and overlapping native-resolution crops. Pass `--preview-width` when the destination width is known. User-requested theme and layout choices override defaults.
7. For every output, inspect the complete PNG, the generated native crops, and the generated destination-width preview. Native resolution alone is not evidence that a diagram will be readable in documentation, a pull request, or chat.
8. Check hierarchy, contrast, clipped or overlapping text, connector paths, whitespace, semantic shape use, and whether every required story is traceable without narration. A connector crossing component, group, or boundary text is a blocking defect.
9. Fix layout structurally: wrap labels, shorten edge prose, reduce high-column grids, stack phases, or add clearly labeled boundary ports and convergence nodes. Preserve the traceability checklist and rerender after each structural change.
10. Remove failed prototypes and every printed review directory after inspection. Revalidate the selected source and rerender to a temporary location with `--no-review-images`. Require a byte match when the renderer is deterministic; otherwise replace the selected outputs with the fresh render and verify them again. Report only final artifact paths.

## Default visual style

Apply these only when the user leaves styling unspecified:

- Theme: D2 Dark Mauve `200`.
- Layout engine: `elk`; canvas padding: `40`.
- Canvas: dark, clean, non-sketch, with no decorative icons unless requested.
- Color: restrained semantic roles with sufficient contrast; do not encode status by color alone.
- Text: plain quoted D2 labels with explicit `\n` line breaks where useful.

A default style never determines diagram type, panel count, reading order, or content. Read `references/style-guide.md` when tuning a dense layout, comparison, or user-directed variation.

## Adaptation rules

- Use one output or several according to what communicates the request clearly. Do not combine or split views by default.
- Judge dimensions, density, and aspect ratio against the intended destination and the generated exact-width preview; use the built-in 980px default only when the destination is unspecified.
- Prefer concise noun labels for entities and short action phrases for relationships, while preserving conditions needed for correctness. Add explicit line breaks to control node width; move explanatory prose off crowded edges.
- Use containers for real ownership, trust, or process boundaries. Do not place external actors inside a runtime boundary merely to simplify layout.
- Use clearly labeled boundary ports or local relay nodes when a long cross-container connector would pass through interior components. Ports clarify ingress, storage, identity, and publication relationships without inventing a new service.
- Show independent post-gate work as separate outgoing paths with no branch-to-branch edge. When success and failure perform state changes and delivery in different orders, draw separate ordered branches.
- Preserve effect-specific retry identity. Do not collapse deterministic request IDs, persisted external IDs, dedupe keys, and reconciliation into one generic “idempotent” label when the distinction matters.
- Use queue, database, document, and other semantic shapes only when they describe the represented concept.
- Clearly distinguish current, proposed, disabled, legacy, optional, and failure behavior whenever those states matter.

## Gotchas

- D2's direct PNG path uses Playwright and can fail while downloading its driver. The bundled renderer deliberately emits SVG first and converts it with `rsvg-convert`.
- D2 asset bundling can fetch remote resources. The bundled renderer disables bundling and rejects external SVG references; use D2 shapes or embedded data URIs instead of remote assets.
- Markdown D2 labels use SVG `foreignObject`, which `rsvg-convert` drops. The renderer fails closed when it finds one; use plain text labels.
- D2 0.7.1 does not support `shape: note`. Use a `document` shape or a plainly labeled container/node for notes.
- Layout behavior depends on the D2 version and engine. In D2 0.7.1 with ELK, a nested `direction` may be ignored when the root has a different direction. Treat the rendered image as proof; use a grid, a compatible top-level layout, or another engine when needed.
- Disconnected top-level objects may produce surprising whitespace or reading order. Use a grid or invisible edges only when the render needs an explicit relationship.
- A wide native render can look excellent while becoming unreadable when embedded. Inspect an exact destination-width preview before accepting the composition.
- Long connectors commonly route through labels when they target deep nested nodes. Prefer short local connectors, aligned lanes, boundary ports, and explicit convergence nodes over cosmetic edge tweaks.
- Container and group titles count as labels. If a connector enters through a title, move the title with `label.near`, move the port, or split the traffic into aligned lanes.
- Deleting connectors can make a render cleaner while making the topology false or untraceable. Re-run every primary path and boundary relationship after a reflow.
- Vertical placement implies order even without an edge. Use explicit fork labels and spatial separation when work is concurrent or independently retried.
- In sequence diagrams, group labels draw on the leftmost lifeline and can collide with it. Use an empty group label plus a note on an appropriate actor when that renders more clearly.
- Delivery and state labels must include their conditions. Do not present state-dependent behavior as unconditional.
- The renderer caps review output at 100 crops. Increase `--crop-size` for unusually large diagrams rather than creating an unbounded review set.
- A valid render can still be misleading. Image inspection and factual review are required.

## Available scripts

- `scripts/render_diagram.sh [options] INPUT.d2 [OUTPUT_BASE]` validates and renders `.svg` and `.png` without mutating the source. By default it also prints a temporary review directory with `preview-980.png` and overlapping native-resolution crops. Use `--preview-width`, `--crop-size`, `--crop-overlap`, `--review-dir`, or `--no-review-images` as needed. Publication uses same-filesystem atomic links; an interrupted or contested publish fails closed and reports retained staging/backup directories for recovery.
- `references/style-guide.md` contains the default palette, layout guidance, D2 patterns, and visual review checklist.

## Validation

```bash
d2 validate path/to/diagram.d2
# Omit --preview-width to use the built-in 980px default.
/path/to/diagram-creation/scripts/render_diagram.sh --preview-width 900 \
  path/to/diagram.d2 path/to/output/diagram
file path/to/output/diagram.svg path/to/output/diagram.png

# Inspect every image in the review directory printed above, then remove it.
rm -rf <printed-review-directory>

# When the renderer is deterministic, prove selected renders match the source.
tmp_dir=$(mktemp -d)
/path/to/diagram-creation/scripts/render_diagram.sh --no-review-images \
  path/to/diagram.d2 "$tmp_dir/diagram"
cmp path/to/output/diagram.svg "$tmp_dir/diagram.svg"
cmp path/to/output/diagram.png "$tmp_dir/diagram.png"
rm -rf "$tmp_dir"
```

Inspect the destination-width preview, complete PNG, and native-resolution details. Trace every required path again after the final layout change. If the source claims current behavior, compare labels and arrows against the inspected code, docs, logs, or traces before delivery.

## Output contract

Return:

- PNG: rendered image for immediate viewing.
- SVG: scalable rendered image.
- D2: editable source.
- Validation: D2 validation, render result, dimensions, source/render alignment, and visual inspection at native and destination widths.
- Deviations: only user-requested variations or unresolved factual and visual limitations.
