# Greptile Advisory

Greptile reviews and comments automatically after changes and is never a merge gate. The required four-agent panel determines code sign-off; required CI and repository protections remain separate gates.

Never:

- wait for or poll Greptile
- trigger or re-trigger a review
- require a current-head review, summary footer, check run, confidence score, acknowledgment, resolved thread, or re-review
- let Greptile absence, failure, latency, score, or reviewed head delay or block merging
- reset a cleared panel because Greptile reviewed a different head

When checking the PR, read any Greptile comments that already exist. Give each actionable comment a verdict from `SKILL.md`: **Fix**, **Rebut**, **Defer**, **File**, or **Block**. Validate every suggestion against the code before acting; change code because an issue is independently real, not to satisfy a score.

After actioning the comments already present, proceed without waiting for Greptile to acknowledge, resolve, or re-review. A resulting diff still follows the normal exact-head panel and CI rules.
