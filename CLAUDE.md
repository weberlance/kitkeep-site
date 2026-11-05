# kitkeep-site

The website of the KitKeep mobile app (GitHub Pages, `https://weberlance.github.io/kitkeep-site/`) and the source of the kit templates the app downloads from `templates/v1/`. The data contract with the app is in `docs/domain-rules.md`, section 2; any change to it must be agreed with the app first.

## Where things are

- **Business rules:** `docs/domain-rules.md`. Update it in the same PR as any rule change.
- **Earlier decisions and their reasons:** `docs/implementation-questions.md` and `docs/decisions/`.
- **Open questions:** `docs/open-questions.md`. If the rules and decisions are silent on something users would notice, don't invent behavior: add the question there and ask.
- **Commands:** the `## Validation Commands` section of the active plan.

## Plans

- Plans live in `docs/plans/`. Every `.md` file directly in that folder is a plan still to be implemented. Finished plans are in `docs/plans/completed/` and are history only: don't work from them.
- If more than one active plan exists and the user hasn't said which one to work on, ask.
- Plan files use a `# Plan: <Title>` heading, a `## Validation Commands` section, and numbered `### Task N: <Title>` sections with `- [ ]` checkboxes:

  ```markdown
  # Plan: My Feature

  ## Validation Commands
  - `go test ./...`

  ### Task 1: Implement feature
  - [ ] Add the new functionality
  - [ ] Add tests
  ```
- Work on **one task at a time**, in order (Task 1, Task 2, …). Read the whole task before starting. Don't start a task until the previous task's "Done when" checkbox is ticked.
- Tick each checkbox (`- [x]`) as soon as that item is finished, in the same PR. The last checkbox of a task is its "Done when" check; never tick it unless the check actually passes.
- When every checkbox in a plan is ticked, move the file to `docs/plans/completed/` with `git mv` in the PR that finishes its last task. A plan with tasks deliberately left for later stays in `docs/plans/` until those are done too.

## Branches and commits

- One plan = one feature branch.
- One task = one branch.
- Commit messages in English, imperative mood.
