# Diagram Layout and D2 Guide

Use this reference for shared composition, traceability, layout tuning, and D2-specific authoring. Styling guidance fills only choices the user leaves unspecified.

## Layout hygiene is the first gate

A beautiful surface cannot rescue a confused composition. Before art direction, require:

- one obvious entry point and reading direction
- a deliberate destination aspect ratio
- a clear dominant subject or primary path
- reserved connector lanes and convergence points
- readable labels at the destination width
- boundaries that match real ownership or trust
- no connector crossing any text, icon, chip, card, or boundary title
- no unexplained whitespace or extreme ribbon/tower dimensions

Only after those pass should gradients, shadows, glow, texture, icons, or decorative accents be tuned.

## Write a composition contract

Record these decisions before laying out nodes:

| Decision | What to specify |
|---|---|
| Visual question | The one relationship or story the image must make easy to see |
| Reader and destination | README, chat, document, presentation, wall display, or another context |
| Display width | Exact width when known; otherwise use the 980px review default |
| Reading order | Left to right, top to bottom, radial, or staged |
| Frame | Target aspect ratio and whether the view should split |
| Hierarchy | Primary subject, supporting modules, annotations, and status |
| Lanes | Entry, cross-boundary, convergence, success, failure, and publication routes |
| Typography floor | Smallest text that may carry material meaning at destination width |

If the contract cannot fit without shrinking meaningful text, reflow or split the view.

## Traceability and causal order

Before layout, list the paths and boundary relationships the reader must be able to trace. Include entry sources, durable state, identity or trust checks, external calls, terminal outcomes, and publication when they matter. For temporal diagrams, derive an ordering ledger from source material rather than from the conceptual pipeline.

- Every directed edge asserts causality, ordering, or dependency. Do not use one merely to indicate visual proximity.
- Preserve required connections through each reflow. A cleaner image is not an improvement if a source can no longer reach its handler or outcome.
- Distinguish association from order with containment, notes, or undirected relationships where appropriate.
- Show effect-specific retry identity accurately. Deterministic IDs, persisted external IDs, claims, dedupe keys, and reconciliation are different mechanisms.
- Treat layout as semantics. Vertical stacking can imply sequence, and a line through another branch can imply blocking even when no edge joins them.

## Composition and routing

- Let the request determine diagram type, reading order, panel count, and detail.
- Use containers only for real ownership, trust, process, or deployment boundaries. Keep external sources and shared resources outside boundaries that do not own them.
- Design connector routes with node placement. Prefer short local edges, aligned lanes, and one explicit convergence point over long fan-out lines into deep nested nodes.
- Use clearly labeled boundary ports for cross-container task, storage, identity, and publication traffic. A port is a visual interface, not a new runtime service.
- When multiple runtimes bind one external resource, keep each binding inside its owner and the resource outside all runtime boundaries. Use separate lanes so unrelated traffic does not pass through the resource label.
- Show independent post-gate work as separate outgoing paths with no branch-to-branch edge.
- Draw success and failure orders separately when their action order differs.
- Do not exceed four or five meaningful columns at ordinary documentation width. Stack phases before shrinking text.
- Treat layout directives as requests, not proof. Inspect every render after a structural change.

## Labels and semantics

- Prefer concise nouns for entities and short action phrases for relationships.
- Preserve conditions, failure semantics, and qualifiers needed for truth.
- Put explanation in notes or supporting copy rather than overloading edges.
- Add explicit line breaks to control width while keeping each line scannable.
- Use specific verbs such as `routes`, `persists`, `emits`, `transitions`, and `delivers`.
- Use semantic shapes only when they help recognition and leave enough space for the label.
- Show each concept once per view unless repetition is necessary for clarity.
- Distinguish current, proposed, disabled, legacy, optional, and failure behavior explicitly.

## D2 baseline

When D2 is selected and the user does not specify style:

- Theme: Dark Mauve `200`
- Layout: ELK
- Padding: `40`
- Labels: plain quoted text with explicit `\n` breaks where helpful
- Color: restrained semantic roles with status expressed by text or shape as well as color

These values are a structural baseline, not a visual-quality guarantee.

### D2 palette

| Role | Fill | Stroke/text accent |
|---|---:|---:|
| Primary subject | `#172554` | `#3b82f6` or `#60a5fa` |
| Secondary component | `#3f1d2e` | `#f472b6` |
| External actor/system | `#312e1b` | `#f59e0b` |
| Transport or data | `#164e63` | `#22d3ee` |
| Success or active state | `#052e16` or `#14532d` | `#22c55e` or `#86efac` |
| Policy or note | `#3f3f46` | `#a1a1aa` |
| Failure or risk | `#451a2b` | `#ef4444` or `#fca5a5` |
| Boundary or panel | `#0f172a` or `#111827` | `#475569` |

### Boundary ports

Terminate cross-boundary traffic at a labeled interface, then use local edges inside the boundary:

```d2
source -> service.task_port

service: "Runtime boundary" {
  task_port: "Task entry"
  runtime: "Session runtime"
  task_port -> runtime
}
```

Move a container title away from an ingress or egress lane and verify the render:

```d2
runtime: "Runtime boundary" {
  label.near: top-left
  entry: "Task entry"
}
```

### Independent and order-sensitive branches

```d2
gate -> effects.text
gate -> effects.files

effects: "Independent post-gate effects" {
  grid-columns: 2
  text: "Text path"
  files: "File path"
}

success.delivery -> success.terminal
failure.terminal -> failure.notification
```

### Sequence phases

D2 centers a sequence group label on the leftmost lifeline. If the line pierces that label, use an empty group label and name the phase with a note on an actor:

```d2
phase: "" {
  actor."Phase name and conditions"
  actor -> other: "message"
}
```

Wide notes can force very tall or wide renders. Keep them concise and place them on an actor with available space.

### Explicit panel order

D2 may place disconnected top-level objects unpredictably. Use a grid or invisible edges only when an explicit relationship is not being invented:

```d2
first -> second: { style.opacity: 0 }
second -> third: { style.opacity: 0 }
```

## D2 failure signatures

| Render symptom | Likely cause | Structural response |
|---|---|---|
| Ultra-wide ribbon | Nested cross-container edges or too many columns under ELK | Use local boundary ports, stack phases, reduce columns, or switch composition |
| Extremely tall sequence | Long notes, too many events, or group-label pressure | Shorten notes, split phases, reduce actors/events, or use SVG-native signal sequence |
| Fan-in edges cross several cards | Deep nested targets and one distant hub | Add aligned convergence nodes or local lanes |
| Outer label clipped | Container title on the canvas edge | Use an internal headline node or add measured margin |
| Unexpected panel order | Column-major grid fill or disconnected objects | Verify declaration order, use `grid-rows`, or add invisible ordering edges |
| Long label pinched | Semantic queue, database, or cylinder geometry | Shorten the label or use a rounded rectangle with a role label |
| Nested direction ignored | Root and child directions conflict under D2 0.7.1/ELK | Use explicit grid rows/columns, compatible root direction, or another engine |

## D2 renderer constraints

- Direct D2 PNG output can depend on Playwright. The bundled renderer emits SVG first, then rasterizes with librsvg.
- Remote resources are rejected. Use D2 shapes or embedded data URIs.
- Markdown D2 labels use SVG `foreignObject`, which librsvg drops. Use plain text.
- D2 0.7.1 does not support `shape: note`; use a document shape or plain node.
- Group and boundary titles are collision surfaces. A connector through one is a blocking defect.
- Deleting a connector may clean the render while making topology false. Re-run the traceability checklist after every reflow.

Useful overrides:

```bash
scripts/render_diagram.sh --theme 8 --layout elk input.d2 output-base
scripts/render_diagram.sh --theme 0 --layout dagre --pad 64 input.d2 output-base
scripts/render_diagram.sh --zoom 1.5 --preview-width 900 input.d2 output-base
```

## Visual review checklist

The renderer proves image integrity. The agent must still open the images.

Review the complete PNG, exact-width preview, and every overlapping native crop:

- Does the result answer the user's visual question without narration?
- Can a reader find the entry point and primary subject in a few seconds?
- Is the reading order obvious?
- Does the silhouette still work at the destination width?
- Are material labels legible, unclipped, and free of overlap?
- Does any connector cross text, an icon, chip, card, or boundary title?
- Can every required source be traced through handlers and state to an outcome?
- Are independent paths visibly independent without accidental sequence implications?
- Do success, failure, optional, and retry paths preserve the verified order?
- Are arrow direction and causality unambiguous?
- Does whitespace separate content without creating dead zones?
- Is status understandable without relying on color alone?
- Do dimensions and aspect ratio fit the destination?
- Are shadows, gradients, texture, and glow purposeful and restrained?
- Does any raster show missing strokes, truncation, partial content, or other renderer defects?

Remove the review directory and discarded candidates after the selected output passes.
