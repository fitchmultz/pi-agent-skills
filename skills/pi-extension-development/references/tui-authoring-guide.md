# TUI Authoring Guide

Read for terminal UI, renderers, overlays, widgets, custom editors, shortcuts, autocomplete, or mode-specific UI behavior.

## TUI capability ladder

Pick the smallest good UI surface:

| Need | Best API |
|---|---|
| Simple choice/confirm/text | `ctx.ui.select/confirm/input/editor` |
| Cancellable async task | `BorderedLoader` |
| Pick list/settings | `SelectList`, `SettingsList`, `DynamicBorder` |
| Ambient state | `setStatus`, `setWidget`, `setFooter`, `setHeader`, `setWorkingMessage`, `setWorkingVisible`, `setWorkingIndicator`, `setHiddenThinkingLabel`, `setToolsExpanded` |
| Transient modal/side panel | `ctx.ui.custom(..., { overlay: true })` |
| Passive HUD/timer | non-capturing overlay or component widget |
| Full flow/game/multi-panel UI | custom `Component` with `handleInput`, caching, `dispose` |
| Editor replacement | `setEditorComponent()` with `CustomEditor` |
| Slash command UX | `registerCommand` + `getArgumentCompletions` |
| Tool-row or model-visible session display | `renderCall`/`renderResult` for TUI rows; `registerMessageRenderer` plus custom-message `content` for model-visible session messages |
| Persisted display-only session entry | `appendEntry` + `registerEntryRenderer` |

## TUI component rules

- `ctx.ui.custom()` takes a factory and returns a `Promise<T>`. Close by calling `done(value)`.
- For overlays, use `options.onHandle` to receive `OverlayHandle`. Non-overlay custom UI has no public handle.
- Every rendered line must fit the supplied width. Use `visibleWidth`, `truncateToWidth`, and `wrapTextWithAnsi`.
- Reapply ANSI styles per line; pi-tui resets styles at line end.
- Use the `theme` and `keybindings` supplied to callbacks.
- Call `tui.requestRender()` after input-driven or async state changes.
- Implement `invalidate()` and clear/rebuild theme-colored cached content on theme changes.
- Cache by width and content/state version; bump version when state changes.
- Components with timers, streams, subprocesses, or animations need `dispose()` and async disposed guards.
- Components that need Kitty key-release events, such as games or smooth movement, opt in with `wantsKeyRelease = true`.
- Components with text cursors should implement `Focusable` and emit `CURSOR_MARKER`; containers with child `Input`/`Editor` must propagate focus.
- `showHardwareCursor`, `setShowHardwareCursor(true)`, or `PI_HARDWARE_CURSOR=1` can help terminals that need a visible cursor for IME candidate positioning.
- Use `PI_TUI_WRITE_LOG=/tmp/tui-ansi.log` for raw ANSI stream debugging.

## Overlay rules

Overlay options support anchors, percentages, min/max sizes, margins, offsets, responsive `visible(termWidth, termHeight)`, and `nonCapturing: true`.

`OverlayHandle` supports:

- `hide()`
- `setHidden(boolean)` / `isHidden()`
- `focus()` / `unfocus()` / `unfocus({ target })` / `isFocused()`

Behavior:

- TUI tracks topmost visible capturing overlays by focus order.
- Hidden or responsive-invisible overlays lose focus; focus falls back to the next visible capturing overlay or prior focus.
- Overlay components are disposed on close. Never reuse old instances; create a fresh one.
- `ctx.ui.custom(..., { overlay: true })` closes through its `done(...)` callback. Raw `tui.hideOverlay()` hides the current topmost overlay; for stacked overlays that may close out of order, manage individual handles with `onHandle` or use raw `tui.showOverlay()` inside a parent custom component.

## Editor, shortcuts, autocomplete, and raw input

- Extend `CustomEditor`, not raw `Editor`, unless intentionally bypassing app actions.
- `CustomEditor` constructor is `(tui, theme, keybindings, options?)`; call `super.handleInput(data)` for unhandled keys.
- `CustomEditor.handleInput()` gives extension shortcuts and app-level actions a chance before normal editor text handling.
- Use `pi.registerShortcut()` for extension hotkeys.
- Use the injected `keybindings.matches(data, namespacedId)` and `getKeys(id)` for configurable actions; render hints with `keyHint()`/`keyText()` so user `keybindings.json` overrides remain authoritative.
- Stack autocomplete with `ctx.ui.addAutocompleteProvider(factory)`, declare `triggerCharacters` for natural triggers such as `#` or `$`, and delegate to the current provider when your syntax does not match.
- Use `ctx.ui.onTerminalInput(handler)` only for advanced global interception. It runs before focused component routing; return `{ consume: true }` to swallow input or `{ data }` to rewrite it. It is no-op outside TUI.

## Widgets, footer, header, status, and working UI

- String-array widgets are capped to 10 lines plus a truncation notice. Use component-factory widgets for richer/larger HUDs.
- `setWidget(key, undefined)` clears a widget. Setting a key removes any existing widget with the same key from both above/below placements.
- `setFooter(factory)` replaces the built-in footer and receives `footerData` for git branch and extension statuses.
- `setHeader(factory)` can no-op during early init if the header is not ready; prefer `session_start` or later.
- `setWorkingMessage()` changes the loader text and no argument restores the default; `setWorkingVisible(false)` hides the built-in working row.
- `setWorkingIndicator({ frames: [] })` hides the spinner; custom frames are verbatim, so add colors yourself.
- `setHiddenThinkingLabel()` changes the collapsed hidden-thinking label and no argument restores the default.
- Use `getToolsExpanded()` / `setToolsExpanded()` sparingly to support a workflow, then restore prior state when appropriate.

## Tool and message rendering

Tool renderer facts:

- `renderCall(args, theme, context)` renders call/pending view.
- `renderResult(result, { expanded, isPartial }, theme, context)` renders result/partial view.
- `renderShell: "self"` skips the default box shell.
- `context` includes `args`, `toolCallId`, `invalidate()`, `lastComponent`, `state`, `cwd`, `executionStarted`, `argsComplete`, `isPartial`, `expanded`, `showImages`, and `isError`.
- Use `context.state` for row-level shared state.
- Use `context.lastComponent` to update/reuse expensive components.
- Honor `isPartial`, `expanded`, and `context.isError`.
- Collapsed rendering should be a compact summary; expanded rendering can show details.

A registered tool with no custom renderer gets Pi's basic title/text fallback; model-visible output still comes from tool result `content`, not the TUI renderer. Add a custom renderer when a watched tool needs richer progress or summary UI:

- Lead the collapsed view with a one-line headline that tells the story: a status glyph (✓/✗/●/spinner), the primary result or count, and the most useful 1-2 metrics. The collapsed line is what the user sees 90% of the time, so make it scannable, not a raw dump.
- Color and emphasize with the supplied theme, for example `theme.fg("success", text)`, `theme.fg("error", text)`, or `theme.fg("muted", text)`. Never hardcode ANSI; use `theme.bold()` and other declared helpers when needed.
- Distinguish states visibly: pending/running (`renderCall` + `isPartial`), success, and `context.isError` should each look different at a glance.
- Stream progress so long tools feel alive instead of frozen: emit `onUpdate` partials and render `isPartial` with a running summary (lines processed, current step) rather than a static "running…".
- Reserve heavy layout (tables, trees, diffs, side-by-side, sparklines) for the expanded view; keep collapsed cheap and one-to-three lines.
- Use `renderShell: "self"` only when you intentionally own the whole frame; otherwise keep the built-in box for consistency with other tools.
- For durable, rich in-conversation UI beyond a single tool row, pair `pi.sendMessage({ customType, content, display: true, details })` with `registerMessageRenderer`.
- Do not over-decorate: every line must fit `width`, degrade gracefully in non-TUI modes, and never bury the actual result under ASCII art. Visually inspect the rendered collapsed and expanded states before claiming done.

Custom messages and entries:

- Use `pi.sendMessage({ customType, content, display: true, details })` plus `pi.registerMessageRenderer(customType, renderer)` when the content should participate in model context.
- Use `pi.appendEntry(customType, data)` plus `pi.registerEntryRenderer(customType, renderer)` for persisted display-only transcript state excluded from model context. Entry renderers are interactive-only and may return `undefined` to hide an entry.
- Message renderers receive `(message, { expanded, outputPad }, theme)`; use `outputPad` for their root horizontal spacing so custom messages align with built-in output. Entry renderers receive `(entry, { expanded }, theme)` and do not receive `outputPad`.
- Keep model-visible `content` useful as fallback and richer UI state in `details`. Use both surfaces for durable session UX, not transient controls.

## Mode behavior

| API | TUI | RPC | print/json/no UI |
|---|---:|---:|---:|
| `select/confirm/input/editor` | yes | yes via extension UI protocol | no-op fallback |
| `notify`, `setStatus`, `setTitle`, `setEditorText` | yes | fire-and-forget request | no-op |
| `setWidget` string array | yes | fire-and-forget request | no-op |
| `setWidget` component factory | yes | ignored | no-op |
| `custom()` / overlays | yes | unsupported, returns `undefined` | returns `undefined` |
| `pasteToEditor` / `getEditorText` | native paste / current text | paste replaces editor via `setEditorText`; getter returns `""` | no-op / `""` |
| footer/header/editor replacement/autocomplete/raw input/tools-expanded UI | yes | unsupported/no-op/fallback | no-op/fallback |
| theme access/mutation | full | current process theme; theme listing/lookup empty and mutation fails | fallback/no-op |

Use `ctx.hasUI` for dialog-capable flows that can work through RPC. Use `ctx.mode === "tui"` for terminal-only custom components, overlays, editor replacement, autocomplete, raw terminal input, component widgets, editor-state reads/paste semantics, and theme mutation.

If an action’s only authorization path is an interactive confirmation, define what happens without UI. For automation extensions, explicit non-interactive config/CLI/env policy is a valid design; do not add blanket blocking that defeats the requested workflow.
