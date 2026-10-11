# pi-agent-skills

15 reusable workflows for [Pi](https://pi.dev), the coding agent that runs in your terminal. I keep the instructions and helper scripts here so I can ask Pi to review a PR or test a fix without spelling out the process each time.

![A task flows through Pi's skill selection, reading SKILL.md, and following the workflow with supporting files as needed.](.github/readme/skill-workflow.png)

*Describe your task or choose a skill explicitly; Pi loads the workflow's instructions when you need them.*

## Install and try it

You'll need Pi 1.0.0 or later and Node 24.21.0 or later installed:

```bash
pi install git:github.com/fitchmultz/pi-agent-skills
pi
```

In your Pi session, try:

```text
/skill:deslop clean up the noise in my current diff while preserving behavior
```

I distribute this bundle through Git; you can also install a local checkout. Take a look through the [skills below](#skills) before installing: they can tell Pi to run commands and change files.

## How to use the skills

You can also ask “Review this PR for usability problems” and let Pi choose a skill. Pi sees each skill's short description and can read the full instructions when a task matches. To choose a skill yourself, type `/skill:name`:

```text
/skill:tdd add a regression test first, then fix the bug
/skill:diagram-creation draw the request flow for this service
/skill:bro
```

`bro` rewrites Pi's last reply in plain language and only runs when you call it explicitly. Pi can select the other skills from your request.

Some skills need extra tools. Diagram creation needs a renderer; UI exploration needs browser access. Each skill's page explains what you'll need.

## Skills

| Skill | Use it for |
| --- | --- |
| [`ask-clarifying-questions`](skills/ask-clarifying-questions/SKILL.md) | Settle a decision that could change what gets built. |
| [`bro`](skills/bro/SKILL.md) | Restate the last response in plain language. |
| [`clef`](skills/clef/SKILL.md) | Evaluate text or JSON with Cloudflare's decision models. |
| [`deslop`](skills/deslop/SKILL.md) | Clean up AI-generated noise in your branch or PR. |
| [`diagram-creation`](skills/diagram-creation/SKILL.md) | Create rendered diagrams with editable SVG or D2 source. |
| [`dogfood`](skills/dogfood/SKILL.md) | Explore real browser flows and capture evidence of UI problems. |
| [`handoff`](skills/handoff/SKILL.md) | Write instructions for the next session or a delegated task. |
| [`pi-extension-development`](skills/pi-extension-development/SKILL.md) | Build, debug, review, or package Pi extensions. |
| [`propose-then-ship-pi`](skills/propose-then-ship-pi/SKILL.md) | Research improvements, get your direction, then deliver a verified PR. |
| [`ssh-unix-ops`](skills/ssh-unix-ops/SKILL.md) | Work on Linux, macOS, or WSL2 hosts over SSH. |
| [`tdd`](skills/tdd/SKILL.md) | Write a failing test, make it pass, then refactor. |
| [`test-audit`](skills/test-audit/SKILL.md) | Find brittle or redundant tests and check the value of new ones. |
| [`thermo-nuclear-code-quality-review`](skills/thermo-nuclear-code-quality-review/SKILL.md) | Review a branch or PR for deep maintainability problems. |
| [`ux-review`](skills/ux-review/SKILL.md) | Review user-facing changes for usability and complete workflows. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Check the evidence before claiming work is complete. |

## Compatibility

The skills cover official Pi and my [`fitchmultz/pi` fork](https://github.com/fitchmultz/pi). The two can have different extension APIs even with the same version number. If you're building an extension, check the [version hazards reference](skills/pi-extension-development/references/current-version-hazards.md) for the host you're using.

## Evaluate or contribute

Want to change a skill? Start with the [maintenance guide](docs/maintaining-skills.md) for the authoring conventions and checks.

The [evaluation guide](docs/evaluations.md) covers offline tests and optional model-backed comparisons. Normal tests need no model credentials. Live evaluations use your configured provider and may incur usage charges. The [0.7.0 results](docs/evaluation-results.md) record what an earlier comparison found, including its limitations.

See the [changelog](CHANGELOG.md) for the bundle's history.

## License

[MIT](LICENSE) © Mitch Fultz.
