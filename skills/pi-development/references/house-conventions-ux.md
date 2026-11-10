# House conventions: what the person sees and does

Read this before you add or change anything a person sees or types in one of Mitch's Pi packages or in a built-in extension of the `fitchmultz/pi` fork: a tool card, a message or entry renderer, a notice, a status segment, a widget, a command, a shortcut, a dialog, a setting, or user-facing wording.

- These rules are binding there. Every rule works on official Pi and on the fork.
- A sentence that starts with `On the fork,` describes fork-only behavior. Official Pi does not have it. The inventory is [Fork-only capabilities](current-version-hazards.md#fork-only-capabilities).
- The naming rules are for new things. Do not rename a shipped command, status key, custom type, flag, or settings file.
- Related owners: what the model reads is in [house-conventions-tool-contract.md](house-conventions-tool-contract.md). Documents and releases are in [house-conventions-delivery.md](house-conventions-delivery.md). Component and API mechanics are in [tui-authoring-guide.md](tui-authoring-guide.md).

## Tool cards

A card has a call part (`renderCall`) and a result part (`renderResult`). Pi draws the frame, the background, the blank row above the card, and the images of the result.

- Add renderers only when Pi's fallback card hides what the person needs. No renderer is a valid choice.
- Do not draw a frame, a background, a blank first or last row, or the image blocks of `result.content`. Do not use `renderShell: "self"`.
- Remove control characters from text that you did not write (tool output, server names, file content) before you draw it.

An HTML export renders each call part one time and keeps only that rendering. The exported page cannot expand a call. Official Pi renders that call collapsed, with `isPartial: true` and `executionStarted: true`. Result parts are exported collapsed and expanded.

### Call part

- Row 1 is the tool title in `toolTitle` bold, then the target (path, id, action) in `accent`. Row 1 is the same in every state.
- Show no live state. Do not read `context.isPartial`, `context.executionStarted`, or `context.isError` in `renderCall`. A call part that says "running" says it in every export.
- Most calls need only row 1. Show the arguments that identify the call, and return the same text collapsed and expanded.
- When the arguments are what the person reads (a script, JSON, a message body), give the call part two forms. Collapsed: row 1, at most 10 wrapped rows of arguments, then the hint row. Expanded: every argument.
- A call part with two forms returns the expanded form when `context.lastComponent` is `undefined`. That is the one rendering an export keeps. The terminal renders a card a second time before it shows it.
- Hold the previous rule with a test that calls Pi's real `exportToHtml` and finds every argument in the page.
- On the fork, exports render the call part expanded and use the saved result's error state and duration when present. Keep the first-rendering rule because official Pi exports the collapsed form. Injected expand hints say `click` in a fork export and use the configured terminal key in the terminal.

### Result part

- Check `context.isError` first. On an error, draw the text of `result.content` in `error` and do not read `details`.
- Treat `details` as unknown data. A thrown error, a failed validation, and a blocked call arrive with `details: {}`. A saved session can hold an older shape. When the shape is not the one you expect, draw the text content. Never throw.
- The first non-blank row states the outcome in one line: a symbol, what happened, the count that matters.
- Collapsed: at most 10 rows of output, counted after wrapping. Use `truncateToVisualLines`.
- While `options.isPartial` is true: one row in `warning` that says what is running. Progress is in the result part, never in the call part.
- Expanded: everything.
- On the fork, compact view shows an unexpanded card as two rows: the first non-blank row of the card and the first non-blank row of the result. Row 1 of the call and the outcome row must carry the meaning alone.

### Hint row

This row applies to a call part with two forms, to a result part, and to a message card.

- Draw the hint only when the expanded form shows more.
- Put it on its own row, in `muted`: `... (N more lines, <key> to expand)`.
- A preview that keeps the end of the output puts the hint first: `... (N earlier lines, <key> to expand)`.
- When a line count does not apply, such as a diff view, the row is `(<key> to expand)`.
- The hint can follow the text on the same line only when the collapsed part is one short, fixed status line.
- Build `<key> to expand` with `context.keyHint("app.tools.expand", "to expand")`. A message or entry renderer uses `options.keyHint`.

## Messages and entries in the transcript

Choose the surface by who must read the text:

| Who reads it | Use |
| --- | --- |
| The person, now. It can scroll away. | `ctx.ui.notify` |
| The person, later too. The model must not read it. | `pi.appendEntry` with `pi.registerEntryRenderer` |
| The model too | `pi.sendMessage`. The model reads it again with every later request. |

- `content` must read well alone. The model reads it, the default card shows it, and an export shows it. An export does not call your renderer.
- The default card and every export show `customType` as `[customType]`. The naming rule is in [State](house-conventions-tool-contract.md#state).
- Register a message renderer when a visible message can be longer than about 10 rows.
- A message renderer returns one `Box` with `options.outputPad` as horizontal padding and `customMessageBg` as background. The heading is `customMessageLabel` bold. Collapsed: at most 5 rows and the hint row. Expanded: everything. Do not add a blank row above the box.
- A click on a card toggles that card only. Do not call `ctx.ui.setToolsExpanded` from a click.
- On the fork, Pi can toggle a message card itself when the renderer leaves a left click unhandled, and passes the state as `options.expanded`. Draw from `options.expanded` and do not handle that click a second time.
- `display: false` hides a message in the terminal only. The model still reads it, and an export shows it with the label "Hidden in terminal".

## Notices

Pi draws an `info` notice as one `dim` line and replaces the previous `info` notice when nothing came between them. Pi appends every `warning` and `error` notice, in color, with the prefix `Warning: ` or `Error: `.

- `error`: the package tried something and it failed, or state is broken.
- `warning`: the request was not done because of how or where it was asked (wrong arguments, wrong mode, nothing to do, busy), or it was done with a caveat.
- `info`: the result, or a confirmation.
- Do not start the text with `Error:`, `Warning:`, or the package name as a severity label.
- Write one clause in sentence case with no period at the end. Use a period after each sentence when there are two or more.
- Report state as `Name: value`: `Grill-me mode: on`.
- A notice that arrives without a command from the person (startup, background work) starts with the name of the feature.
- Speak one time for each problem. Stay silent until the state recovers or changes. Do not notify on each retry, turn, or start.
- Stay silent when the package works as configured. Send no "loaded" or "ready" notice.
- Keep the notice short and name where the details are: `Use /pstack-status for details`.
- Pi does not save a notice and the model never reads it. Text that the model must act on is a message.

## Without a UI

`ctx.hasUI` is false in print mode, in JSON mode, and in an SDK session without a UI, such as a child. There, `notify`, `setStatus`, and `setWidget` do nothing, `confirm` returns `false`, and `select`, `input`, `editor`, and `custom` return `undefined`. In RPC mode `ctx.hasUI` is true and `custom` returns `undefined`. The complete mode table is in [tui-authoring-guide.md](tui-authoring-guide.md#mode-behavior).

- Check `ctx.hasUI` before a dialog or a notice. Check `ctx.mode === "tui"` before `ctx.ui.custom`, a component widget, or raw terminal input.
- Never call `notify` inside `if (!ctx.hasUI)`. Nobody sees it.
- Without a UI, write a problem that the person must know to stderr one time, and write the report of a command to stdout. Print nothing else.
- Without a UI, the answer to a permission question is "no". Never continue as if the person agreed.
- A tool that must ask stops with an error that tells the model what to do instead: `Ask in your reply instead.`
- Unattended work needs a setting, a flag, or an allow-list that the person set before the run. A missing dialog is not permission.
- Do not offer the model a tool whose only purpose is a dialog when no UI exists. The mechanism is in [Exposure](house-conventions-tool-contract.md#exposure).
- A view built with `ctx.ui.custom` needs a `select` or `confirm` path for RPC, or a clear refusal.
- The wording for "cannot do this here" is `/<name> requires interactive mode`, as a `warning`.
- A confirm title is a short question that names the action and the object: `Clear all stashes?` The message says what is lost or sent.

## Status line and widgets

Pi puts all status segments on one line, sorted by key and joined by one space, and cuts the line at the terminal width.

- Use one segment for each package. The key is the short name of the package in kebab-case.
- The text is `name: value` in lower case: `oracle: 2 running`, `cwd: ~/x`. Use one name and one value.
- The segment is `dim`. Use `warning` or `error` only while the person must act. Do not use `accent` or `success` for a normal state.
- Use no emoji and no icon in a segment.
- Clear the segment with `setStatus(key, undefined)` when the feature is off or idle.
- Use a widget only for something the person watches while it changes. Remove it with `setWidget(key, undefined)` when the work ends.
- A string-array widget shows at most 10 rows. Cut your own list before that and end it with `… N more`.
- Do not replace the footer in a package that other people install. A footer replacement draws the statuses of the other packages from `footerData.getExtensionStatuses()`.

## Commands

- A name is lower-case kebab-case. The main command of a feature is `<topic>`. More commands are `<topic>-<verb>` or `<topic>-<noun>`. The status command is `<topic>-status`. `<topic>` is the short name of the package.
- Do not use the name of a built-in command.
- The description starts with a verb, is one clause, and has no period at the end.
- An extension command has no argument hint. Name fixed argument words at the end of the description, after a colon: `Set Cursor runtime for this session: local or cloud`.
- A command with fixed argument words registers `getArgumentCompletions`.
- A two-state switch accepts `on`, `off`, and `status`. `status` reports and changes nothing. The answer is one `info` notice: `Name: on` or `Name: off`.
- A new switch toggles when it has no argument. Do not change what a shipped command does without an argument unless the owner decides it.
- Wrong or missing arguments: one `warning` notice, `Usage: /name <required> [optional] [a|b|c]`, and no other effect. Do not throw for a mistake of the person: Pi shows a thrown error as `Extension "command:<name>" error: …`.
- A command answers with one notice. Do not print raw JSON. A report of more than about 10 rows opens a view with `ctx.ui.custom` in the terminal.
- A command that only reports also works without a UI.

## Keys, hints, and mouse

- When Pi has a binding id for the action (`tui.select.up`, `tui.select.confirm`, `tui.select.cancel`, `app.tools.expand`), match with `keybindings.matches(data, id)`. Do not compare with a literal key.
- Name a key with the function that Pi gives you: `context.keyHint` and `context.keyText` in a tool renderer, `options.keyHint` and `options.keyText` in a message or entry renderer, `keybindings.getKeys(id)` in a custom view. Do not import `keyHint` from the Pi package.
- A key that only your view has: match the literal and show it with `rawKeyHint("ctrl+d", "delete")`.
- A hint is `<key> <what it does>` in lower case: `enter select`, `esc cancel`. Join the hints of one row with ` · `. The row is `muted` or `dim`.
- Each global shortcut has a command for the same action, is configurable, and can be turned off. Do not take a key that Pi reserves.
- Each action that a click starts also has a key. The rules for clickable hints are in [Actionable hints and mouse input](tui-authoring-guide.md#actionable-hints-and-mouse-input).

## Settings

- First find out whether a Pi setting already says it. Read Pi's settings with `pi.getSettings()`. Do not add a second setting for the same thing.
- A new package keeps its settings in one JSON file: `<agent dir>/<package short name>.json`. Build the path with `getAgentDir()`.
- An optional project file is `<cwd>/<CONFIG_DIR_NAME>/<package short name>.json`.
- Never write `~/.pi/agent` or `.pi` as a literal path.
- Keys are camelCase. Group related keys in one object. No key repeats the package name.
- Each key has a default, and the package works with no file.
- For a filter, an allow-list, or a limit, an unset key means everything that the person's real permissions allow.
- A flag is `--<package>-<setting>`. An environment variable is `PI_<PACKAGE>_<SETTING>`.
- An invalid file: one `warning` notice that names the file and the key, then run with the defaults. Do not throw while the extension loads, because Pi then does not load the extension.
- Document each key in the settings table that [Documents](house-conventions-delivery.md#documents) describes.

## Words

Use one word for one thing in notices, cards, command descriptions, tool descriptions, and documents.

| Say | For | Do not say |
| --- | --- | --- |
| `session` | A Pi conversation and its saved file | `conversation`, `thread`, except as the term of another product |
| `context window` | What the model reads in one request | |
| `compaction` | Pi replaces older messages with a summary | `rollover` |
| `rollover` | Posthorse starts a new context window and keeps the recent messages, with no summary | `compaction` |
| `child` | A session that another session started | `subagent` |
| `agent run` | One saved execution of a child | `subagent run`, `job` |
| `run` | One execution of a workflow or a script | `job` for a new feature |
| `interactive mode` | Pi in the terminal with its full UI (`ctx.mode === "tui"`) | `TUI mode`, `interactive TUI`, `terminal UI`, `interactive UI` |
| `cancelled` | Stopped before the end | `canceled` |
| `to expand`, `to collapse` | The two card hints | `show details`, `for more` |
| `on`, `off` | The state of a switch | `enabled`, `disabled`, `ON`, `OFF`, `shown`, `hidden` |

`job` stays where it ships: `pi-oracle` and the fork's background commands. `pi-subagents` stays the name of the package.

## Colors and symbols

- Take every color and style from the `theme` that Pi gives you: `theme.fg`, `theme.bg`, `theme.bold`, `theme.italic`, `theme.inverse`. Never write an escape code for a color or a style.
- Use no emoji: not in a card, not in the status line, and not in text that the model reads.

| Token | Use it for |
| --- | --- |
| `toolTitle` with bold | The name of the tool on a card |
| `accent` | The target of a call; the selected row in a list |
| `toolOutput` | Output text in a result |
| `muted` | Secondary text: arguments, counts, the hint row |
| `dim` | The least important text: status segments, separators, metadata |
| `success` | `✓` and the word for a finished state |
| `warning` | A running state; a caveat |
| `error` | `✗` and error text |
| `customMessageLabel` with bold, `customMessageBg`, `customMessageText` | The heading, the background, and the text of a message card |

| Symbol | Meaning | Color |
| --- | --- | --- |
| `✓` | Done | `success` |
| `✗` | Failed | `error` |
| `…` | Running; or text was cut | `warning` when it is a state |
| `⊘` | Cancelled | `muted` |
| `▸`, `▾` | Collapsed heading, expanded heading | The color of the heading |
| `○`, `◉` | Not selected, selected | `muted`, `accent` |
| ` · ` | Separator in one row | `dim` or `muted` |

Use no other marker for these meanings.

## Before you report the work as done

- Look at each new or changed card collapsed, expanded, and in an HTML export (`/export`).
- On the fork, also look at the card in compact view.
- Run each new or changed command one time in the terminal and one time with `pi -p`.
