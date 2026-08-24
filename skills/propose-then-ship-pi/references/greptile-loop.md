# Greptile Advisory

Greptile reviews and comments automatically after changes and is never a merge gate. Required remote checks and repository merge protections determine readiness; an explicitly requested local panel is an additional gate.

Never:

- wait for or poll Greptile
- trigger or re-trigger a review
- require a current-head review, check run, confidence score, acknowledgment, resolved thread, or re-review
- let Greptile absence, failure, latency, score, or reviewed head delay or block merging
- reset a cleared opted-in review panel because Greptile reviewed a different head

When checking the PR, read any Greptile comments that already exist. Give each actionable comment the normal **Fix** or **Rebut** verdict and record it. Validate every suggestion against the code before acting; change code because an issue is independently real, not to satisfy a score.

After fixing or rebutting the comments already present, proceed without waiting for Greptile to acknowledge, resolve, or re-review. A resulting diff still follows required CI and, when local review was enabled, its exact-head panel rules.
