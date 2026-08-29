# SVG-Native Diagram Design

Read this reference when SVG is the canonical editable source, especially for modern, polished, editorial, cinematic, product-quality, presentation-ready, or visually striking work.

## Start from the story, not the starter

`../assets/modern-svg-starter.svg` contains a tested dark design system: canvas treatments, typography classes, glass surfaces, cards, chips, inline icons, connector markers, and purposeful depth. Copy or adapt its tokens when useful, but replace its composition with the diagram's actual visual grammar. Do not turn every request into three columns of cards.

## Composition patterns

### Signal sequence

Use for temporal interaction and order-sensitive behavior.

- Keep four or five participant columns at most on a standard landscape canvas.
- Give each participant a distinct role label and restrained accent.
- Separate long stories into phase bands such as ingest, execute, and deliver.
- Use compact event pills or numbers so labels do not sit directly on lifelines.
- Reserve one horizontal lane per event. Do not let return arrows cross event labels.
- Use solid colored strokes for horizontal arrows. Never rely on an object-bounding-box gradient on a zero-height path.

### Editorial storyboard

Use for lifecycle, migration, onboarding, and narrative explanation.

- Create an obvious numbered reading path with six or fewer stages per view when possible.
- Vary card scale or emphasis to establish a primary stage, transition, or outcome.
- Use generous whitespace and short supporting copy rather than dense edge labels.
- Light canvases, subtle paper grids, soft color fields, and small bespoke icons work well when clarity should feel editorial rather than cinematic.
- Connect stages only when order matters. Spatial proximity alone can carry grouping.

### Glass system map

Use for architecture, ownership boundaries, and systems with a clear core.

- Establish large restrained zone surfaces before placing components.
- Give the primary system visibly more scale and contrast than support modules.
- Draw external sources and outcomes in their own zones.
- Reserve ingress, egress, storage, and recovery lanes before placing labels.
- Use status chips and role labels to communicate current, optional, durable, external, or proposed state without depending only on color.

### State and topology

SVG-native can handle small state or topology views when bespoke composition matters. For dense graphs, D2 is usually the better structural authoring tool. Do not hand-place dozens of nodes merely to preserve the SVG look; split the view or use D2.

## Layer order

Use a predictable SVG layer stack:

1. Canvas base
2. Subtle bloom, grid, or texture
3. Zone and phase surfaces
4. Connectors and arrowheads
5. Cards, nodes, and lifeline heads
6. Icons, labels, and status chips
7. Sparse annotations and footer metadata

Drawing connectors before nodes lets cards cover harmless endpoint overlap and keeps lines away from text. Connector routes must still avoid unrelated cards and labels.

## Typography system

Use a restrained two-family system with portable fallbacks:

```svg
<style>
  .sans { font-family: Inter, ui-sans-serif, Arial, sans-serif; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
</style>
```

For a 1600-unit-wide viewBox targeting a 980px preview:

| Role | Typical source size | Notes |
|---|---:|---|
| Main title | 44 to 56 | Strong weight, slightly tight tracking |
| Section or phase | 11 to 14 mono | Uppercase, generous tracking, never carries the main story alone |
| Primary subject | 30 to 38 | Use once or sparingly |
| Card title | 20 to 26 | Clear hierarchy over body copy |
| Material body text | 16 to 18 | Keep critical labels at or above the destination-size floor |
| Status or micro-label | 10 to 12 mono | Secondary only; pair with shape or placement |

Inspect the exact-width preview. Increase type or reflow when material text becomes small, even if the native image looks crisp.

## Spacing and geometry

- Use an 8px base rhythm and deliberate multiples such as 16, 24, 32, 48, and 64.
- Use larger outside margins than internal card padding.
- Keep card padding consistent within a role, usually 24 to 36 source units.
- Use a radius hierarchy: large zone surfaces, medium primary cards, smaller chips. Do not give every object the same radius.
- Maintain a clear gap between connector lanes and text blocks.
- Prefer a few larger surfaces over heavy outlines around every item.
- Verify optical alignment. Mathematically centered labels can still look low or crowded beside icons.

## Color and depth

Choose two to four semantic accents and use each consistently. A useful dark foundation is:

| Role | Example |
|---|---:|
| Canvas | `#060A12` to `#0B1120` |
| Surface | `#0E1525` to `#172238` |
| Primary blue | `#60A5FA` |
| Cyan/data | `#22D3EE` |
| Violet/runtime | `#A78BFA` or `#C084FC` |
| Amber/attention | `#F59E0B` |
| Primary text | `#F8FAFC` |
| Secondary text | `#91A0B8` |

For light editorial work, use an off-white canvas, white cards, cool gray text, one strong blue or violet, and soft low-opacity color fields.

Depth should explain hierarchy:

- subtle shadow separates a focus card from its zone
- a low-opacity bloom creates a visual center
- a faint dot or line grid suggests a technical canvas
- a thin highlight can distinguish a primary surface
- soft glow may mark one active or signal element

Avoid neon on every edge, opaque glass everywhere, thick bright borders around every box, and effects that reduce text contrast.

## Icons and status

- Draw simple inline vector icons from the same geometric language.
- Keep icon boxes and stroke weights consistent.
- Use icons as recognition aids, not decorative filler.
- Do not use emoji or mismatched third-party icon styles.
- Pair color-coded status with text, a symbol, or both.
- Prefer micro-labels such as `ACTIVE`, `DURABLE`, `OPTIONAL`, `EXTERNAL`, or `PROPOSED` over ambiguous colored dots alone.

## Connector construction

- Draw connectors behind nodes.
- Use 2.5 to 4 source-unit stroke widths on a 1600-wide canvas.
- Use round caps and joins for clean curves.
- Keep arrowheads proportional and solid-filled.
- Reserve routes before finalizing cards. A connector is part of composition, not cleanup.
- Use curves only to clarify direction or avoid collisions. Do not add decorative waves.
- Use dashes for secondary, asynchronous, optional, or observational relationships only when the legend or labels make that meaning clear.
- Keep event labels in dedicated pills or whitespace rather than placing text on a busy stroke.

SVG gradients use `objectBoundingBox` unless `gradientUnits` is set. A horizontal or vertical path has a zero-area bounding box, so a gradient stroke may disappear while its arrowhead remains. For straight connectors, use a solid stroke or define a user-space gradient with explicit coordinates:

```svg
<linearGradient id="signal" gradientUnits="userSpaceOnUse" x1="220" y1="0" x2="600" y2="0">
  <stop stop-color="#60A5FA"/>
  <stop offset="1" stop-color="#A78BFA"/>
</linearGradient>
```

## Portable SVG rules

- Include explicit `width`, `height`, and `viewBox`.
- Add `<title>` and `<desc>` and connect them with `aria-labelledby`.
- Use SVG `<text>` and `<tspan>`, not `foreignObject`.
- Use portable font stacks. Do not fetch remote fonts.
- Use inline paths or embedded `data:` assets. Do not reference external files or URLs.
- Do not include scripts, event handlers, or active content.
- Keep IDs unique and semantic enough to maintain.
- Use XML comments to mark major layers and reusable component groups.
- Keep the SVG canonical and editable. Do not flatten it into a bitmap after approval.

## Visual QA passes

Run `scripts/render_svg.sh`, then actually open the complete PNG, every native crop, and the destination-width preview.

1. **Silhouette pass:** At preview size, confirm entry point, dominant subject, reading order, zone balance, and aspect ratio.
2. **Layout pass:** Confirm consistent gaps, deliberate alignment, reserved lanes, no dead space, and no false sequence from stacking.
3. **Typography pass:** On native crops, confirm all material text is legible, unclipped, optically aligned, and high contrast.
4. **Connector pass:** Trace every path. Confirm no line, arrowhead, or label crosses unrelated content and no required relationship vanished during reflow.
5. **Render-integrity pass:** Look for missing strokes, missing filters, cropped shadows, broken markers, fallback-font shifts, partial raster content, or transparent regions that should be opaque.
6. **Restraint pass:** Remove any effect, border, label, chip, or icon that does not improve hierarchy, meaning, or recognition.

The renderer's full-decode check catches corrupt or truncated PNGs, but only visual inspection catches a perfectly valid image with invisible connectors, poor hierarchy, or accidental collisions.

## Common anti-patterns

- equal rectangles with equal emphasis everywhere
- bright outline around every object
- a long single-row chain that becomes unreadable at embed width
- too many participants, phases, or panels on one canvas
- decorative connectors that compete with the story
- tiny body text justified by a high-resolution export
- random emoji or mixed icon families
- gradients and glows used as a substitute for hierarchy
- status communicated only through color
- copy-pasting the starter's layout when another grammar fits better
