# TUI Authoring Guide

Read for terminal UI, renderers, overlays, widgets, custom editors, shortcuts, autocomplete, or mode-specific UI behavior. For Mitch's packages and the fork, [house-conventions-ux.md](house-conventions-ux.md) owns how cards, messages, notices, status segments, commands, hints, words, colors, and symbols look and read; this guide keeps the API mechanics.

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

Pi defaults to fullscreen. Use the supplied host TUI, not a second terminal or private render loop. Test default fullscreen and regular mode, narrow/wide/CJK, resize, focus, keyboard/mouse, cancellation and disposal. Use `tui.queryTerminalColors()` (`TerminalColors`, `TerminalColorScheme`, `parseTerminalColorSchemeReport`) for palette queries; the old standalone color-scheme/background helpers are removed.

- `ctx.ui.custom()` takes a factory and returns a `Promise<T>`. Close by calling `done(value)`.
- For overlays, use `options.onHandle` to receive `OverlayHandle`. Non-overlay custom UI has no public handle.
- Every rendered line must fit the supplied width. Use `visibleWidth`, `truncateToWidth`, and `wrapTextWithAnsi`.
- Reapply ANSI styles per line; pi-tui resets styles at line end.
- Use the `theme` and `keybindings` supplied to callbacks.
- After input-driven or async state changes, invalidate affected cached content and call `tui.requestRender()`; scrolling can reuse a frame without calling `render()`, so keep rendering free of lifecycle effects.
- Treat every child's or `super.render()` result as read-only; copy before modifying it (for example `[...super.render(width)]`). Both hosts type `Component.render()` as `readonly string[]` and cache `Container` output for unchanged children/lines, with an array-identity fast path. Return a new array when output changes, not an in-place edit to a previously returned array. Cache by width and content/state version, and clear/rebuild theme-colored output in `invalidate()` on theme changes.
- `TUI.setSuspendSignalHandler()` registers the handler invoked on external `SIGTSTP` while the TUI owns the terminal (`start()` to `stop()`), restoring terminal modes on suspend and redrawing on `fg`; `stop()` removes the listener so child processes suspend normally. On shutdown, `pi config`, and startup pickers, both hosts wait up to 1 second via `flushStdout` so queued terminal-reset sequences finish before returning to the shell.
- Both hosts render unscoped syntax-highlighted text with the theme foreground, hide Kitty/iTerm2 images behind overlapping overlays and restore them on full redraws, accept Enter on absolute-path/slash-argument autocomplete instead of submitting, and keep the selected `SettingsList` entry when moving the search cursor.
- `ctx.ui.pasteToEditor()` and `ctx.ui.setEditorText()` request a redraw on both hosts, including after an `await` outside terminal input handling.
- Components with timers, streams, subprocesses, or animations need `dispose()` and async disposed guards.
- Components that need Kitty key-release events, such as games or smooth movement, opt in with `wantsKeyRelease = true`.
- Components with text cursors should implement `Focusable` and emit `CURSOR_MARKER`; containers with child `Input`/`Editor` must propagate focus.
- `showHardwareCursor`, `setShowHardwareCursor(true)`, or `PI_HARDWARE_CURSOR=1` can help terminals that need a visible cursor for IME candidate positioning.
- Place `CURSOR_MARKER` immediately before a cursor cell wrapped with public `renderFakeCursor(text)`, emitting the position marker only when focused. With hardware cursor off, the TUI resolves fake-cursor markers to reverse video. With it on, the focused marked fake cursor loses its reverse video while its text remains; unfocused fake cursors stay visible. Preserve markers through highlighting, clipping and composition (`compositeTuiLine`, `stripTerminalSequences`), and test native output with hardware cursor both on and off, including narrow/CJK/emoji cells and focus changes. Prefer native `Input`/`CustomEditor` so the host owns cursor behavior; the helper alone does not repair missing focus propagation or `CURSOR_MARKER` semantics.
- Use `PI_TUI_WRITE_LOG=/tmp/tui-ansi.log` for raw ANSI stream debugging.
- `PI_TUI_ESC_TIMEOUT` tunes lone-Escape detection on high-latency SSH links where split `Alt+Enter` misparses. `--use-theme <name[/name]>` overrides the per-run theme without saved settings for renderer validation. Built-in fullscreen transcript search (`Ctrl+Shift+F`), unbound half-page scroll actions, and unbound single-line scroll actions exist; keep custom shortcuts clear of them.

### Terminal focus and animation

Fullscreen rendering and native `Loader` animations continue at their normal rate when terminal focus is lost; neither host throttles background frames nor pauses its loader. Focus loss cancels active mouse gestures and hover state while keeping completed text selections. Neither official Pi nor the fork exposes a `TUI` terminal-focus query or listener API.

A `Loader` starts at construction and when its indicator changes. Call `stop()` from its owner's `dispose()` to release its timer; use `start()` to resume it. Keep the native loader or a bounded owned timer with normal render requests and disposal, not a raw focus parser, second render loop, or focus shim.

## Inline images and protocols

Both hosts default `terminal.showImages` to true and `terminal.imageWidthCells` to 60. `terminal.images` accepts `kitty`, `iterm2`, `auto` or false; the fork also accepts `sixel`. `PI_IMAGE_PROTOCOL` accepts the corresponding names, `none` or `auto`. An explicit setting wins over the environment; an unset/auto setting adds no override. These are display controls. `images.blockImages` independently filters provider-bound image blocks without removing the saved transcript content; `images.autoResize` is a separate input policy. Turning display on does not authorize model upload.

Both hosts use signed 32-bit-compatible Kitty image IDs so they render in Konsole. Regular-mode Kitty appends can scroll past the bottom without clearing existing scrollback. Keep native allocation and rendering instead of issuing a full clear for an appended image.

On the fork, native user messages preview attached images and recognized local references; assistant messages load references from text only after streaming finishes. Native resolution uses the session cwd, skips remote URLs and recognized fenced blocks, validates nonempty regular files by supported magic bytes, and deduplicates attachment tags, loaded filenames and identical image data. It reads current filesystem bytes, not a historical snapshot or file watcher, and is neither a sandbox nor a bounded-size loader. Previewing a local reference does not attach that file to model input. Reuse the native path, not private message-image helpers or a second attachment loader.

Keep the fallbacks distinct: display off removes native message images; without an image protocol, local references are not loaded and text stays unchanged. In that no-protocol case, attached images receive ordinary image fallbacks only when the message has no non-whitespace text. Unreadable or unrecognized-magic local files are omitted; a constructed `Image` that cannot decode/encode or lacks a usable protocol has its normal descriptive fallback. Compact/hybrid tool, custom, entry and summary cards use `[image]` in unexpanded previews; native user/assistant images are not subject to that two-row card cap.

Fork auto-detection includes Sixel terminals. Under tmux, the native probe requires a client `sixel` feature and support not disabled; a tmux version alone proves nothing. Fork fullscreen temporarily substitutes Sixel for detected iTerm2 graphics and restores capabilities on stop; official fullscreen disables iTerm2 graphics. Retain native `Image` components so the host owns reservation rows, six-pixel-band cropping, overlay restoration, cursor placement and redraw/stop cleanup. Stripping a control sequence is not raster cleanup. Do not emit raw protocol escapes, add a render loop, wrap native tmux graphics in passthrough, or silently switch the user's terminal mode.

Coding-agent owns the asynchronous Photon/Sixel loading and registers its synchronous encoder after renderer startup/replacement. Ordinary extensions should not register competing global encoders. The fork root-exports `setSixelEncoder`<!-- fork-only -->, `SixelImageEncoder`<!-- fork-only -->, `getExifOrientation`<!-- fork-only --> and additional placement/cropping/tmux helpers; reach optional APIs through a feature-tested loaded module, not portable module-load imports. `isImageLine` and `stripImageSequences` become root exports on the fork but already occur in official internal declarations; do not confuse declaration presence with a public root export or deep-import them on official Pi. Private coding-agent message-image and encoder-loading helpers are not SDK root exports. The narrow pi-tui EXIF subpath keeps workers out of the terminal graph; successful package/subpath resolution alone proves neither CommonJS execution nor native-addon loading.

**Complete official path:** retain normal text/path messages. Return model-visible image blocks in a tool result and let native tool rendering honor the display settings; do not draw those images again in a tool renderer. For display-only images, load/validate and, when needed, await shared `convertToPng()` outside synchronous rendering, then retain shared `Image`/`Container` components in a registered entry renderer or TUI-only custom UI. An owned custom-message renderer can also compose images; official's default custom-message renderer is text-only. Keep terminal-only guards, async disposal, invalidation/render requests and a text fallback. Official Pi supports Kitty in regular and fullscreen modes, and iTerm2 graphics in regular mode. It has no Sixel support and auto-detects no inline images under tmux; keep the text fallback there. Report a required Sixel-only rendering gap rather than pretending it rendered. No image control sequences belong in JSON/RPC output.

Sources: `src/modes/interactive/components/{message-images,user-message,assistant-message,activity,compact-preview}.ts`, `src/utils/image-convert.ts`, `src/core/{sdk,settings-schema}.ts`, and `packages/tui/src/{index,terminal-image,tui-alt-screen,tui-main-screen,layout}.ts`. Check actual terminal output, overlays, resize and stop restoration on each requested terminal/tmux/mode; source, recorded escape streams and offline host discovery do not prove live raster appearance.

## Transcript history and hydration

Large fork fullscreen transcripts initially instantiate a recent turn-aligned entry window, then prepend older chunks on upward scroll or backward prompt navigation; search, jump-to-start and switching to regular mode ensure full content. Full editor prompt history is available from the initial load. Rehydrate branch state independently of entry-renderer invocation. The initial window is not a fixed row/component cap; hydration grows the mounted transcript rather than maintaining a fixed-size rolling window. [Transcript and model context](lifecycle-checklist.md#transcript-and-model-context) separates this presentation from provider input and gives the complete official history path.

For an owned custom history surface on the fork, shared `ScrollView` offers synchronous `onBeforeScrollUp`<!-- fork-only --> and `onBeforeScrollToStart`<!-- fork-only --> hooks. A fullscreen host can provide `onHydrateOlderContent`<!-- fork-only --> (synchronous, true only after an actual prepend) and `onEnsureFullContent`<!-- fork-only --> (synchronous full materialization) to shared `TuiAltScreen`. Wrap a synchronous prepend with `prependScrollViewContent`<!-- fork-only --> to preserve native selection and row anchoring, then request rendering; the helper does not request it. Ordinary extensions should use the injected host's existing transcript, not replace it.

Official Pi lacks these members. Materialize an owned history component before ordinary shared `ScrollView` composition, search and navigation; retain native copy and keyboard behavior. Do not pass fork-only options on official Pi, patch private transcript state or construct a second TUI. Sources: `packages/tui/src/{tui,tui-alt-screen}.ts`, `packages/tui/src/components/{scroll-view,loader}.ts` and `src/modes/interactive/interactive-mode.ts`.

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
- Use the injected `keybindings.matches(data, namespacedId)` and `getKeys(id)` for configurable actions. In tool renderers, format hints with `context.keyHint(id, description)`/`context.keyText(id)` from the `ToolRenderContext` argument; message and entry renderers get the same functions on their `options` argument (`MessageRenderOptions`/`EntryRenderOptions` extend `KeybindingHints`); an imported `keyHint()` can resolve the extension's own `pi-coding-agent` copy and render without the user's keys. Elsewhere, `rawKeyHint(keybindings.getKeys(id).join("/"), description)` formats the injected bindings.
- Native `SettingsList` hints follow `tui.select.confirm` and `tui.select.cancel` on both hosts. Use the routed action's binding for owned hints: for example, the cancel hint while a `!` shell command runs follows `app.interrupt`.
- On both hosts, `ctx.ui.select()`, `ctx.ui.confirm()`, and `ctx.ui.input()` take a `blockedKind` option: `"question"`, `"permission"`, or `"auth"`. The terminal's OSC 7501 status message uses the first line of the title. Select and input default to `"question"`; confirm defaults to `"permission"`. See `docs/extensions.md#program-status-kind`.
- Inline `ctx.ui.custom(factory, { blocked: { kind, message } })`, with `kind` `"question"`, `"permission"` or `"auth"`, reports Pi as waiting for user input (OSC 7501 program status) while visible. Overlays report blocked status from when they are shown until `done()`, even while hidden with `setHidden()`. Hiding an overlay does not complete its question.
- A focused component that sets `capturesViewportInput` receives the fullscreen viewport keys (`tui.altScreen.*` scrolling and prompt jumps) instead of the transcript; `getSelectPageIndex()` computes a custom list's selection after `tui.select.pageUp` or `tui.select.pageDown`.
- Pi-tui `Markdown` reuses rendered blocks and highlighted code until `invalidate()`; call it on theme changes. Use `replaceControlCharacters()` before rendering untrusted titles or labels.
- Native hint helpers display Alt as Option on macOS. Keep canonical `alt` binding IDs, config, and behavior unchanged; format only owned key labels, never arbitrary user/agent text. Do not add a platform mapper or deep-import internal `formatKeyText`/`keyDisplayText`; those are not public root exports.
- Use the published `schemas/keybindings.schema.json` for canonical key spelling/case and `schemas/theme.schema.json` for strict theme fields/tokens. Custom action IDs remain allowed; validate the selected host's theme loader as well as JSON shape, not only file existence or a `--no-themes` CLI smoke. See `current-version-hazards.md` for the schema rules.
- Register `getArgumentCompletions(argumentPrefix)` with `pi.registerCommand()` on both hosts. Return completion items (or `null` when none match). For fuzzy matching, import `fuzzyFilter` from `@earendil-works/pi-tui` and match against the candidate text. Handle unambiguous typed arguments in the command handler whether or not the user picks a suggestion.
- On both hosts, `app.message.followUp` (Alt+Enter by default) applies the highlighted autocomplete item before queueing. A completed command name is queued; other completions are inserted without queueing. An owned `Editor` subclass can use protected `confirmAutocomplete()` to distinguish `"applied"` from `"submit"` and `"none"`. Preserve `CustomEditor` routing in ordinary extensions. Sources: `packages/tui/src/components/editor.ts` and `src/modes/interactive/components/custom-editor.ts`.
- The fork editor opens argument suggestions when Tab or a mouse click accepts a slash-command name in argument context, or when a space is typed in slash-command context. Enter on a highlighted command name still submits it. In official Pi, type an argument character or press Tab in argument context to request the same completions. Do not replace the editor to reproduce the fork's trigger behavior.
- Stack autocomplete with `ctx.ui.addAutocompleteProvider(factory)`, declare `triggerCharacters` for natural triggers such as `#` or `$`, and delegate to the current provider when your syntax does not match.
- Use `ctx.ui.onTerminalInput(handler)` only for advanced global interception. It runs before focused component routing; return `{ consume: true }` to swallow input or `{ data }` to rewrite it. It is no-op outside TUI.

### Terminal resume

Both hosts' `@earendil-works/pi-tui` exports `formatProgramResume()`, `formatProgramResumeClear()`, and `takeProgramResumeToken()` for OSC 7577. Interactive Pi owns these calls. Use them only in a terminal application that owns its own resume state, not an extension inside Pi. See [CLI profiles and terminal resume](runtime-authoring-guide.md#cli-profiles-and-terminal-resume).

## Actionable hints and mouse input

`@earendil-works/pi-tui` exports `MouseRegion`, `MouseRegionHandler`, `TuiMouseEvent`, and `TuiMouseEventResult` on both hosts. `dispatchMouseEvent` and `retargetMouseEvent` are internal, not root exports. Check the active package's exports before using a mouse API.

Fullscreen `TuiAltScreen` routes standard SGR 1006 reports on both hosts, including touch scrolling from clients such as PocketMux when they send wheel reports. Regular `TuiMainScreen` leaves mouse input and scrollback to the terminal. Keep the regular-mode keyboard path. Do not add raw mouse capture or patch Pi core.

### Wheel scrolling and row taps

- **Handle wheel input on every scrollable or selectable custom component.** Implement or forward `handleMouse` for `event.type === "wheel" && event.wheelDelta` in pickers, lists, dialogs, overlays, text viewports, and their render wrappers. Keep Up, Down, Page Up, and Page Down working.
- **Own the whole box.** Handle wheel over headers, search fields, spacers, borders, and empty filtered results. Return `{ handled: true, render: changed }` even at either limit so the transcript stays put. Outside the box, let the transcript scroll. Inside the box, return `undefined` when there is no active list in a picker mode (session rename or tree label edit), or when the view collapses to let the person read the transcript. Set `capturesViewportInput` to match so the keyboard scrolls the same surface.
- **Use the right scroll unit.** Move selection by one item per report with `Math.sign(event.wheelDelta)`, clamped at both ends, as `SelectList` and `SettingsList` do. For free text, move by `event.wheelDelta` lines, clamped from zero to the maximum scroll offset.
- **Tap the item that was pressed.** On left `press`, highlight and remember the item and return `{ handled: true, focus: true }`. Activate it once on left `click`, even if the press moved the visible list. Wrap row components in `MouseRegion` or record the exact rendered lines for each item so taps on wrapped lines work at narrow widths. Route non-wheel events to embedded `Input` and `Editor` children first so a tap can place the caret.
- **Test through fullscreen input.** Send SGR reports at rendered terminal coordinates: `\x1b[<65;x;yM` (down), `\x1b[<64;x;yM` (up), and `\x1b[<0;x;yM` plus `\x1b[<0;x;ym` (left press and release). Check rows, headers and search fields, empty results, and both limits without moving the transcript. Check that wheel outside the box or in a mode that yields scrolls the transcript. Tap a wrapped row and a text field; verify one activation and correct caret placement, respectively. Check regular-mode keyboard behavior separately.

Official Pi 1.7.0 has wheel and click in `SelectList` and `SettingsList`, but `ctx.ui.select()`, `ctx.ui.confirm()`, and custom built-in pickers such as `/model` and `/resume` are keyboard-only. For consistent fullscreen behavior on both hosts, use `ctx.ui.custom()` with your own `handleMouse` or an embedded `SelectList`. When embedding a list, handle wheel at the enclosing box too, including when the list is empty.

On the fork, [#598](https://github.com/fitchmultz/pi/pull/598) adds wheel scrolling for overflowing `Editor` drafts and full-box wheel handling for `SettingsList`. It also fixes `TuiAltScreen` so a nested `ScrollView` with `overscroll: "contain"` cannot pass leftover wheel movement to the transcript. Fitch Pi revisions that include the [selector update (#600)](https://github.com/fitchmultz/pi/pull/600) also support full-box wheel and row taps in `ctx.ui.select()`, `ctx.ui.confirm()`, `/model`, `/resume`, `/tree`, `/fork`, `/scoped-models`, `/settings` submenus, `/login`, `/trust`, and `/thinking`. Check your target revision before relying on these built-in behaviors.

### Clickable hints

- Displayed actionable keyboard hints in new or changed owned UI controls must be clickable through that native route. Cover all screens, focus modes, and compact states affected by the approved task or shared root cause; report unrelated existing omissions separately.
- Labels must describe the current action: Enter may open details in read focus but send in compose focus; Back follows the actual screen. Clicks and keys must share the underlying action and guards, preserving focus, drafts, and selection unless the action itself changes them.
- Reuse `MouseRegion`, `Container`, `Box`, and `Text` from `@earendil-works/pi-tui` and existing native controls. No new mouse parser, UI framework, or replacement editor/selector. Forward `handleMouse` through custom render wrappers so hints and child controls stay clickable.
- Base hit regions on actual rendered spans after platform formatting, wrapping, clipping, and padding. Reuse native coordinate handling; keep any necessary inline layout small and shared by rendering and hit testing. Hidden hints, separators, and unused padding must not activate actions.
- Activate once per left click, not on press, release, and click. Do not steal keyboard focus just to handle a hint.
- Validate by locating visible hints in rendered output and clicking those terminal cells through the native pointer route. Assert visible changes and consequential effects, including no duplicate sends. Cover normal/narrow widths, compact layouts, read/compose focus, Back, and state preservation where present; check non-action areas too. Direct handler calls or static-string assertions alone do not prove click routing. Verify the regular-mode keyboard fallback separately.

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
- `context` includes `args`, `toolCallId`, `invalidate()`, `lastComponent`, `state`, `cwd`, `executionStarted`, `argsComplete`, `isPartial`, `expanded`, `showImages`, `isError`, `durationMs`, `outputPad`, `keyText`, and `keyHint`.
- Use `context.state` for row-level shared state.
- Use `context.lastComponent` to update/reuse expensive components.
- An HTML export renders each call once; results have collapsed and expanded forms. Official Pi renders the call with `expanded: false`, `isPartial: true`, `executionStarted: true`, no saved error/duration and terminal key hints. Keep every argument in the first rendering (`lastComponent === undefined`) so the official page does not lose it; show live execution state only in the result part.
- On the fork, exports render calls with `expanded: true`; a saved result makes the call finished (`isPartial: false`) and supplies `isError` and `durationMs` to both renderers. A call without a result is partial. `keyText("app.tools.expand")` is `click`, and its injected hint says `click to expand`; imported helpers still name terminal keys. A tool with only `renderResult` gets an expanded fallback call header with its arguments. `executionStarted` and `argsComplete` stay true, `showImages` is false and `invalidate()` is inert. Keep the official first-rendering path and always use injected hints. Source: `src/core/export-html/{tool-renderer,index}.ts`.
- The result part honors `isPartial`, `expanded`, and `context.isError`. A thrown error arrives with `details: {}`. The call part shows no live state.

Missing or throwing renderer slots use native fallbacks; model-visible output still comes from tool result `content`, not the TUI renderer. On the fork, the call fallback shows argument `key=value` pairs cut to 100 characters; if cut, a separate row names the configured expand key. The result fallback keeps the first ten terminal rows after wrapping, followed by a hint counting hidden rows. Nothing hidden means no hint. This covers a tool with only one renderer, a throwing renderer and an unregistered saved tool; MCP call headers share the argument hint. Expansion retains all arguments/output. The ten-row limit is for the result preview, not the header, hint or shell.

Official Pi's defined-tool fallback clips ten logical text lines, which can wrap beyond ten terminal rows, and its cut argument header has no expand hint. An unregistered saved tool can display its full JSON arguments and output. For bounded cards and discoverable expansion on both hosts, implement the relevant renderer slots with shared `truncateToVisualLines` and injected `context.keyHint`, keeping the complete expanded form. Do not import the internal fallback helper or preview class. Sources: `src/modes/interactive/components/tool-execution.ts`, `src/core/tools/render-utils.ts` and `src/extensions/mcp/tools.ts`.

Add a custom renderer when a watched tool needs richer progress or summary UI. [Tool cards](house-conventions-ux.md#tool-cards) owns the rules for row 1, the collapsed preview, the hint row, and what an export keeps; [Colors and symbols](house-conventions-ux.md#colors-and-symbols) owns the theme tokens and the state symbols (`✓`, `✗`, `…`, `⊘`). The mechanics that stay here:

- Lead the collapsed result with a one-line headline that tells the story: a state symbol, the primary result or count, and the most useful 1-2 metrics. Make it scannable, not a raw dump.
- Color and emphasize with the supplied theme, for example `theme.fg("success", text)`, `theme.fg("error", text)`, or `theme.fg("muted", text)`. Never hardcode ANSI; use `theme.bold()` and other declared helpers when needed.
- Distinguish states in the result part: running (`renderResult` with `isPartial`), success, and `context.isError` each look different at a glance. Do not show the running state in `renderCall`: an export keeps that text.
- Stream progress so long tools feel alive instead of frozen: emit `onUpdate` partials and render `isPartial` as one row with a running summary (lines processed, current step) rather than a static "running…".
- Reserve heavy layout (tables, trees, diffs, side-by-side, sparklines) for the expanded view; keep the collapsed result a bounded preview that ends with the hint row.
- Use `renderShell: "self"` only when you intentionally own the whole frame; otherwise keep the built-in box for consistency with other tools.
- For durable, rich in-conversation UI beyond a single tool row, pair `pi.sendMessage({ customType, content, display: true, details })` with `registerMessageRenderer`. The model reads that message again with every later request, and an export shows `content`, not the renderer; when the model must not read it, use `appendEntry` with `registerEntryRenderer`.
- Do not over-decorate: every line must fit `width`, degrade gracefully in non-TUI modes, and never bury the actual result under ASCII art. Visually inspect the rendered collapsed and expanded states and an HTML export before claiming done.

Custom messages and entries:

- Use `pi.sendMessage({ customType, content, display: true, details })` plus `pi.registerMessageRenderer(customType, renderer)` when the content should participate in model context.
- Use `pi.appendEntry(customType, data)` plus `pi.registerEntryRenderer(customType, renderer)` for persisted display-only transcript state excluded from model context. Entry renderers are interactive-only and may return `undefined` to hide an entry.
- Message renderers receive `(message, { expanded, outputPad, keyText, keyHint }, theme)`; use `outputPad` for their root horizontal spacing so custom messages align with built-in output. Entry renderers receive `(entry, { expanded, keyText, keyHint }, theme)` and do not receive `outputPad`.
- On the fork, message renderers also receive optional `compactView`; absence on official Pi means normal view. Pi itself limits unexpanded tool cards, custom messages, custom entries and compaction/branch summaries to two non-blank terminal rows in compact/hybrid view, shortening to width and replacing images with `[image]`. Extensions need no density code; an optional message summary still gets that cap, and entry renderers receive no `compactView`. Official Pi uses the renderer's own normal collapsed form, so keep it bounded too. A click or the expand key reveals full content. `CompactionSummaryMessageComponent` and `BranchSummaryMessageComponent` render only their `Box` card on both hosts, and interactive mode adds the spacer above them.
- On the fork, a clicked thinking block keeps its label so another click expands it; with an empty hidden-thinking label a click does not collapse it. Native background-command cards show ten command rows and completion notices a summary plus the last five rows until expanded; their errors stay full. Unregistered saved tools use the no-renderer fallbacks described above, including the ten wrapped result rows and conditional expand hints.
- If constructing `CustomMessageComponent` directly, both hosts keep the first seven arguments as `message`, `customRenderer`, `markdownTheme`, `outputPad`, `markdownTransformers`, `messageId`, `timestamp`. The fork appends `compactView`, `showImages`, `imageWidthCells`. `CustomMessageComponent` is a root export; prefer renderer registration to manual transcript composition, and do not pass the fork-only tail on official Pi.
- Keep model-visible `content` useful as fallback and richer UI state in `details`. Use both surfaces for durable session UX, not transient controls.
- Which surface to choose, the collapsed form of a message card, and the click rule are in [Messages and entries in the transcript](house-conventions-ux.md#messages-and-entries-in-the-transcript).

Markdown transformers:

- By default a transformer runs on user, assistant and thinking Markdown. `registerMarkdownTransformer(transformer, { messageTypes })` can also select `custom`, `summary`, or `changelog`. The option selects the entire set, not additions to the default.
- The hook is display-only and synchronous. Return Markdown outside the owned construct unchanged rather than lexer/serializer round-tripping it. Preserve original session/model content, and keep work cheap during streaming and resize. Registering again replaces the extension's prior transformer.
- On the fork, native fullscreen uses source mapping to retain Markdown and real line breaks, including across ASCII-sliced overlay rows, HTML comment blocks, and display-only `Markdown` transforms (anchored in-line replacements such as status pills map atomically back to original source, while transforms that remove non-whitespace content with no replacement or replace a whole line/block with unrelated text fall back to displayed text). Do not assume owned custom clipping/composition preserves source mapping—prefer retained native components, not a private marker parser or host patch, and verify actual copied source when composing custom views. For an owned TUI surface requiring exact source copy, retain authoritative source and expose a user-triggered `copyToClipboard` action; catch/report failures and keep terminal clipboard output out of JSON/RPC streams. A resolved OSC 52 call does not prove client clipboard delivery. `Text` and `Markdown` attach private selection annotations only while `TuiAltScreen` renders a frame; standalone `render()`, `TuiMainScreen`, and HTML callers get plain lines. If a component creates a temporary `Text`/`Markdown` inside a fullscreen render without retaining it, strip that child's private annotations with the fork's `stripSelectionMetadata()`<!-- fork-only --> before its source registration expires; it preserves styles and hyperlinks. Reach the helper through the loaded module and use it only for that fork-only case. Official Pi needs no selection stripping; use native components and its normal copy behavior. `/copy` remains the whole-message command on both. Native drag release and styled-space wrapping fixes need no extension workaround.

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

If an action’s only authorization path is an interactive confirmation, define what happens without UI. For automation extensions, explicit non-interactive config/CLI/env policy is a valid design; do not add blanket blocking that defeats the requested workflow. The house rules for notices, permission questions, and reports without a UI are in [Without a UI](house-conventions-ux.md#without-a-ui).
