# Open questions

Questions that block or affect what users see, with who has to answer them. Remove an entry once it's answered, and record the answer in `docs/decisions/` or `docs/domain-rules.md`.

## Waiting for the app

1. **Agreement on the rules marked (app: to confirm)** in `docs/domain-rules.md`: one-time copy, `builtin:`/`site:` namespaces, compatibility in both directions, rejecting a template without an item that isn't retired, field rules, text rules, and the size limit of 262,144 bytes. Needed before the app's first release; when confirmed, a docs pull request removes the markers and this entry.

   Observed in Task 7 (2026-11-07), with the app's test build: one-time copy holds. A kit created from `winter-car` version 2 kept its 4 items after version 3 was published, and a new kit got 5. A kit created from a template that was later deleted still works. This is a test result, not the app's agreement, so the marker stays.
