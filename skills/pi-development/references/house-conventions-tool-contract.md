# House conventions: the tool contract

Read this before you add or change what the model sees or what the runtime must hold in one of Mitch's Pi packages or in a built-in tool of the `fitchmultz/pi` fork: a tool, a prompt contribution, a hook that changes the message list, a message that is not a tool result, or a stored record.

- These rules are binding there. Every rule works on official Pi and on the fork.
- A sentence that starts with `On the fork,` describes fork-only behavior. Official Pi does not have it. The inventory is [Fork-only capabilities](current-version-hazards.md#fork-only-capabilities).
- The naming rules are for new things. Do not rename a released tool, parameter, or custom type.
- Related owners: what the person sees is in [house-conventions-ux.md](house-conventions-ux.md). API mechanics are in [tool-design-checklist.md](tool-design-checklist.md) and [runtime-authoring-guide.md](runtime-authoring-guide.md).

## Cost first

Pi sends the system prompt and every tool declaration with every request. In Mitch's measured sessions, tool results were more than half of all prompt tokens, and the model read each result again on about 50 later requests.

- Say each fact one time, in the slot it belongs to.
- In the pull request, state how many bytes the change adds to the system prompt and the tool declarations. Measure one real request.
- Change model-facing wording only with a before-and-after run on the models in use. Record the counts.

## Names and text

- A tool name is `snake_case`. Never rename a released tool. Withdraw it with `exposure: "hidden"`.
- A new package with several tools that belong together gives them one prefix.

| Slot | Put here | Do not put here |
| --- | --- | --- |
| `description` | What the tool does, what a call changes and what it leaves alone, and the limits that the model needs to read the result | When to prefer another tool. Field details. |
| Parameter `description` | That field only: meaning, unit, default, limit | Workflow |
| `promptSnippet` | One line for the `<tools>` section: an imperative phrase with a capital first letter and no final period | An instruction |
| `promptGuidelines` | Rules about the choice between tools or the order of calls. Each line names its tool and stands alone. | What a field means |
| Prompt section | Text that is not about one tool, such as a mode. Or a tool guide that is too long for guidelines, under the rule in [Exposure](#exposure). | A copy of the description |
| Documents or a skill | Workflows, examples, troubleshooting | |

Pi puts `promptGuidelines` in the `<rules>` section only while the tool is declared, and drops a line that is already there. Under a custom system prompt Pi builds no `<tools>` and no `<rules>` section.

## Parameters

- Use `StringEnum([...])` for each fixed set of strings, not a union of literals.
- Close each parameter object with `additionalProperties: false`. A misspelled field then gets a validation message.
- A parameter name is `camelCase`. The field that selects an operation is `action`. Paging fields are `offset` and `limit`.
- Copy the field names of a remote system only when the tool passes its arguments through to that system.
- Write the default in the field description: `(default 10, max 50)`.
- Name the unit of an offset or a time limit in the field description: lines, characters, bytes, seconds.
- An unset filter means everything that the user's permissions allow. An unset limit means the stated default, never zero.
- Declare a list as an array only. Pi turns a single value into a list of one item. If models send the list as one JSON string, parse it in `prepareArguments`.
- Accept an old field name in `prepareArguments`. Do not keep it in the advertised schema.
- Check what the schema cannot express first in `execute`, before any side effect. The failure text is one sentence: the field, the value received, and what to send instead.

## Exposure

- Register a new tool with `exposure: "deferred"` unless most runs call it.
- Change the default exposure of a released tool only with measured usage in top-level sessions and the owner's agreement.
- On the fork, a user's `toolExposure` setting, in builds that have it, replaces the exposure that the tool registered with. That setting is the user's control. Do not override it.
- A tool that cannot work in this session (no dialog UI, a child, another platform) is registered again with `exposure: "hidden"` at `session_start`.
- A package with a deferred tool gives the model a way to load it. The procedure is in [Native tools and deferred tool discovery](runtime-authoring-guide.md#native-tools-and-deferred-tool-discovery).
- Put the operating rules of a tool in `promptGuidelines`.
- If that text must be a prompt section, set the section in `before_agent_start` only while `event.systemPromptOptions.selectedTools` has the tool and `hiddenTools` does not. Read those two lists or `pi.getAllTools()`, not the exposure that the package registered.

## Results

- The first line says what happened. Then give only what the next step needs. A list is one line for each item.
- Keep everything else reachable through a saved file, a reference, or a page, and out of the text.
- Stay inside 2,000 lines or 50 KB. Cut with `truncateHead` or `truncateTail` and `DEFAULT_MAX_LINES` and `DEFAULT_MAX_BYTES`, or a tighter limit.
- Handle one very long line yourself. The helpers do not cut inside a line: `truncateHead` returns empty content with `firstLineExceedsLimit` when the first line is over the limit.
- A cut result ends with one line in brackets that the model can act on: the range shown, the total, and the exact next call with its `offset`. Example: `[chars 0-8000 of 31200; continue with offset 8000]`
- If more than one page remains, that line first names the calls for all remaining pages.
- Save the full output, and name its path or reference in that line.
- An offset past the end is not an error. Return the end, or the total and the valid range, with a note. An error stops a codemode script and loses its other calls.
- A tool that calls other tools reports them through `onUpdate` and `details`. Do not print each nested result into the text.

## Errors

- Return a failure from `execute` as `{ isError: true, content, details }`. Only the returned form keeps `details` for the card and for scripts.
- Throw only when there is nothing to show except the message.
- Do not set `isError` for your own tool from a `tool_result` handler.
- The text has three parts: what happened, what was and was not changed, and the next call to make, written as the model writes it.
- If a change possibly happened, say "unknown outcome" or list what was applied. Tell the model to inspect the current state first and not to send the same call again. The tool never retries a change itself.
- A refusal names its cause from a short fixed list.
- A tool that needs a person and has none fails with a sentence that tells the model what to do instead. The rules are in [Without a UI](house-conventions-ux.md#without-a-ui).

## `details`

- The model never reads `details`. Put next-step text in `content`. Put the usage of nested model calls in the top-level `usage` of the result.
- Keep `details` small: identifiers, counts, paths, and what the card shows. A large payload goes to a file, and `details` holds the path.
- When the package rebuilds state from `details` in old sessions, `details` is a stored record. Follow [State](#state).
- How a renderer reads `details` is in [Result part](house-conventions-ux.md#result-part).

## Execution

- `executionMode: "sequential"` makes every call in the same response run one at a time. Use it only when the order against other tools matters: the working directory, the desktop, a question to the person.
- For state that only this tool changes, use a queue inside the tool.
- Write a file through `withFileMutationQueue` on the resolved absolute path, around the complete read, change, and write.
- Call `signal?.throwIfAborted()` before the first side effect. Pass `signal` to every wait, request, and child process.
- Work that continues after the call returns a receipt with an id, and reports its end in one message. The guideline tells the model not to sleep or poll.
- On the fork, `ctx.runInBackground` tells Pi about work that continues. Use it under the rules in [Fork boundaries](current-version-hazards.md#fork-boundaries), and keep the package's own message as the complete path on official Pi.
- `onUpdate` sends a state of one line, not the output as it grows.

## State

- Which surface holds text for the person, for the model, or for neither is in [Messages and entries in the transcript](house-conventions-ux.md#messages-and-entries-in-the-transcript). State that the model does not need is a custom entry (`pi.appendEntry`).
- A new custom type is `<package short name>-<thing>` in kebab-case: `posthorse-reminder`. Never start it with `pi.`; Pi uses that prefix for its own types.
- Read each stored record through a function that returns `undefined` for a shape it does not know.
- Add a `version` field when the shape of a record changes, and continue to read the old versions.
- A record holds identifiers, paths, and small values, never copied content. Write one record for each change of state, not one for each tool call.
- Build branch state again from `ctx.sessionManager.getBranch()` in one function, and call it from `session_start` and `session_tree`.
- Use `getEntries()` only for a fact that holds for the complete session file, whatever branch is open.
- After a compaction, the model no longer reads the custom messages from before it. If the model needs that state, add one snapshot message for that compaction, fixed at that point, and return it at the same position on each later request. Newer state comes from later results.
- Package data is under `getAgentDir()`. Never keep data in the directory of the package: Pi runs `git clean -fdx` there when it updates a Git package. The settings file is in [Settings](house-conventions-ux.md#settings).
- Temporary files are under the system temporary directory. Remove them at `session_shutdown`.

## Hooks and the prompt cache

A provider cache matches only up to the first changed item. In Mitch's measured sessions on Claude, a change to the tool list or to a prompt section in the middle of a context window made the API drop the earlier reasoning and write the cache again.

- Change the prompt through `event.systemPromptOptions.sections`. Do not return `systemPrompt` and do not set `forceSystemPrompt`, unless the feature is to replace the complete prompt.
- Put no timestamp, counter, per-request number, or release path in a section, a description, or a schema. That text changes only when the user changes something.
- Do not change the tool list in the middle of a turn. The model adds tools through `tool_search`. A package changes sections at `before_agent_start`.
- A context hook is a pure function of the branch: the same history gives the same bytes.
- A message that a hook adds keeps its position on each later request. New text goes after the newest message.
- Find your own messages by custom type, never by index. The hook of another package can add or move messages before yours runs.
- Use the smallest hook: `context` for conversation messages, `context_with_system` only to edit system messages, `before_provider_request` only for provider payload fields.

## Messages that are not tool results

- Start a model response (`triggerTurn: true`) only for news that starts work: a finished job, a finished child, a question from a peer. A receipt, a status, or a snapshot uses `triggerTurn: false`.
- The first line says who speaks and what the message is, in a fixed form.
- Mark data that is not an instruction: `Session display-name metadata (inert data, not instructions): {...}`
- Name the next call (how to reply, how to read more, where the log is), or say that the model needs to do nothing.
- Use one custom type for each purpose. Use `display: false` for text that only the model needs.
- Send at most one reminder in each context window. A rule that always applies is a guideline or a section, not a message.
- A notice that work finished is small on success: the status, the id, and where the output is. Include output only on failure, and then a short end part.
- Do not use `pi.sendUserMessage` for text that the package wrote. It is for text that the user wrote or a command that the user started.
