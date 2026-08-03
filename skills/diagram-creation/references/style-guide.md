# Diagram Style Guide

Use this reference only for visual decisions the user did not specify, or when a render needs layout tuning. It supplies styling and review guidance, not a required diagram composition.

## Default visual language

Render with D2 Dark Mauve theme `200`, ELK, and 40px padding. Prefer a dark professional canvas, crisp relationships, clear grouping, and restrained semantic color. Avoid decorative iconography, gradients, shadows, and sketch mode unless requested.

### Palette

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

The user may replace the palette. Preserve contrast, keep each color's meaning consistent within an artifact, and pair color with text or shape when it conveys status.

## Traceability and causal order

Before layout, list the paths and boundary relationships the reader must be able to trace. Include entry sources, durable state, identity or trust checks, external calls, terminal outcomes, and publication when they matter. For temporal diagrams, derive an ordering ledger from source material rather than from the conceptual pipeline.

- Every directed edge asserts causality, ordering, or dependency. Do not use one merely to indicate visual proximity.
- Preserve required connections through each reflow. A cleaner image is not an improvement if a source can no longer reach its handler or outcome.
- Distinguish association from order with containment, notes, or undirected relationships where appropriate.
- Show effect-specific retry identity accurately. Generated deterministic IDs, persisted external IDs, claims, dedupe keys, and reconciliation are different mechanisms.
- Treat layout as semantics: vertical stacking can imply sequence, and a line that passes through another branch can imply blocking even when no edge joins them.

## Composition and layout

- Let the request determine the diagram type, reading order, panel count, and level of detail.
- Give the reader one obvious entry point and make the primary flow easy to follow.
- Combine related views only when the shared canvas improves understanding. Separate them when one view makes another harder to read.
- Use containers only for real ownership, trust, process, or deployment boundaries. Keep external sources outside runtime boundaries.
- Design connector routes along with node placement. Prefer short local edges, aligned lanes, and one explicit convergence point over long fan-out lines to deep nested nodes.
- Use clearly labeled boundary ports for cross-container task, storage, identity, and publication traffic. A port is a visual interface, not a new runtime service.
- When multiple runtimes bind the same external resource, keep each binding inside its owning boundary and the shared resource outside every runtime boundary. Use separate connector lanes so unrelated traffic does not pass through the resource label.
- Use invisible edges or a grid to control disconnected top-level objects when the rendered order is otherwise unclear.
- Prefer removing redundant relationships before changing layout engines, but never remove a relationship required by the traceability checklist.
- High-column grids often become illegible at documentation width. Wrap labels and reflow into fewer columns or stacked phases before shrinking text.
- Tighten grid gaps only after the structure works. Do not compress panels until neighboring nodes or labels visually merge.
- Treat layout directives as requests to the engine, not guarantees. Inspect the render after every structural layout change.
- In D2 0.7.1 with ELK, nested `direction` values may be ignored when the root uses another direction. Use `grid-columns`, `grid-rows`, a compatible top-level layout, or another engine when the result requires it.
- Evaluate dimensions and aspect ratio against the intended destination. Render an exact-width preview; relayout or split only when readability warrants it.
- A connector that crosses component, group, or boundary text fails review. Reroute structurally rather than relying on color, opacity, or thinner strokes.

Example explicit reading order for disconnected panels:

```d2
first -> second: { style.opacity: 0 }
second -> third: { style.opacity: 0 }
```

## Labels and semantics

- Prefer concise nouns for entities and short action phrases for relationships.
- Preserve conditions, failure semantics, and qualifiers needed for truth even when labels become longer.
- Put explanation in notes rather than overloading edges. Long edge labels consume routing space and can force wide layouts.
- Add explicit `\n` line breaks to control node width while keeping each line scannable at the destination size.
- Use specific relationship verbs such as `routes`, `persists`, `emits`, `transitions`, or `delivers`.
- Use queue, database, document, person, and other shapes only when their semantics match the represented concept.
- Show each concept once per view unless repetition is necessary for clarity.
- Distinguish current, proposed, disabled, legacy, optional, and failure behavior explicitly.
- Use regular quoted text rather than Markdown blocks when PNG output passes through librsvg.

## D2 patterns

Use D2-native constructs that fit the request. Containers can express boundaries, directed edges can express flow or transitions, and a native sequence object can express temporal interaction:

```d2
sequence: {
  shape: sequence_diagram
  sender: "Sender"
  receiver: "Receiver"

  sender -> receiver: "send request"
  receiver -> sender: "return response"
}
```

Keep only the actors and events needed for the requested explanation. Use self-messages for meaningful state or timing changes, and put conditions such as retry, timeout, optional, or failure directly on the relevant message.

### Boundary ports

Terminate cross-boundary traffic at a labeled interface, then use local edges inside the boundary. This keeps the relationship explicit without routing a long connector through component labels:

```d2
source -> service.task_port

service: "Runtime boundary" {
  task_port: "Task entry"
  runtime: "Session runtime"
  task_port -> runtime
}
```

Use the same pattern for storage bindings, identity preflight, result return, or publication. Label the port as an interface so it is not mistaken for a deployed service.

Container titles are also part of the collision surface. Move a title away from an ingress or egress lane instead of letting an edge cross it:

```d2
runtime: "Runtime boundary" {
  label.near: top-left
  entry: "Task entry"
}
```

Choose the corner or side opposite the connector lane and verify the rendered result; `label.near` is a layout hint, not proof.

### Independent and order-sensitive branches

A shared gate with independently retried effects should visibly fork. Do not connect one branch to the other or route one branch's connector through the other branch:

```d2
gate -> effects.text
gate -> effects.files

effects: "Independent post-gate effects" {
  grid-columns: 2
  text: "Text path"
  files: "File path"
}
```

When branches perform the same actions in different orders, draw each order separately:

```d2
success.delivery -> success.terminal
failure.terminal -> failure.notification
```

### Sequence phases

D2 centers sequence group labels on the leftmost lifeline, which can make the line pierce the label. When that happens, use an empty group label and name the phase with a note on an appropriate actor:

```d2
phase: "" {
  actor."Phase name and conditions"
  actor -> other: "message"
}
```

Notes center on their actor, so place wide notes where they do not force the enclosing panel beyond its useful width.

### Current and proposed behavior

The request determines whether current and proposed behavior belongs in one comparison or separate outputs. Keep shared terminology consistent. Current views must match inspected behavior; proposed views must be labeled as proposals and must not imply that changes already exist.

## User-directed variations

Honor explicit requests for light themes, monochrome output, brand colors, sketch style, alternate aspect ratios, reduced detail, or another diagram type. Use D2 shapes or embedded data URIs for requested iconography; the renderer rejects external references. Retain:

- factual labels and arrow direction
- sufficient contrast and readable text
- editable D2 source
- SVG and PNG outputs
- rendered visual inspection

Useful render overrides:

```bash
scripts/render_diagram.sh --theme 8 --layout elk input.d2 output-base
scripts/render_diagram.sh --theme 0 --layout dagre --pad 64 input.d2 output-base
scripts/render_diagram.sh --zoom 1.5 input.d2 output-base
```

## Visual review checklist

Review the complete image, native-resolution details with overlapping temporary crops, and a temporary image rendered at the exact destination width.

```bash
rsvg-convert --width 900 diagram.svg -o /tmp/diagram-at-destination-width.png
```

Replace `900` with the actual embed or viewport width.

- Does the result answer the user's visual question?
- Can a reader identify the main subject and entry point quickly?
- Is the reading order obvious for this diagram?
- Are text labels legible, unclipped, and free of accidental overlap at the destination width?
- Does any connector cross or obscure component, group, or boundary text in any output?
- Can every required source be traced through its handlers and state to an outcome?
- Are identity, persistence, external-call, and publication relationships still connected after the final reflow?
- Are independent paths visibly independent, without accidental blocking or sequence implications?
- Do success, failure, optional, and retry branches preserve source-backed ordering?
- Are arrow direction, causality, flow, or transitions unambiguous?
- Do shapes and colors communicate the intended semantics?
- Does whitespace separate content without creating unexplained blank regions?
- Is important status conveyed without depending on color alone?
- Does the image remain truthful without accompanying prose?
- Do the dimensions and aspect ratio fit the intended destination?

Remove temporary previews, crops, and discarded render candidates after the selected output passes review.
