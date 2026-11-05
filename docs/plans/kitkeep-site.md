# Plan: KitKeep site

Build `kitkeep-site`: the website of the KitKeep app and the source of the kit templates the app downloads. Every rule this plan implements is in `docs/domain-rules.md`; the plan says what to build and in what order, not the rules themselves. Reasons are in `docs/decisions/2026-11-04-site-requirements-review.md`. Unanswered questions are in `docs/open-questions.md`.

- The site is built before the app's download feature, so the data contract (domain rules, section 2) has to be right before the app's first release; after that it can't change in `v1/`.
- Tasks 9 and 10 depend on answers in `docs/open-questions.md`. If they're still open, this plan stays in `docs/plans/` after Task 8.
- The build tool, page templates and styling are chosen inside the tasks below (plain styling is enough to start). Each choice that isn't obvious is recorded in `docs/decisions/`.

## Validation Commands
- `npm ci`
- `npm test`
- `npm run check`
- `npm run build`

The scripts are created in Task 1; until a later task fills them in, each one succeeds without doing anything.

### Task 1: Project setup
- [ ] Choose the toolchain: Node.js (current LTS) with npm, Node's built-in test runner, and a page build approach that needs few or no dependencies (domain rules, 3, pipeline security). Record the choice in `docs/decisions/`.
- [ ] Add `package.json` with the `test`, `check` and `build` scripts, the lockfile, a Node version file, and `.gitignore` (the build output and `node_modules`).
- [ ] Add the licenses: `LICENSE` (MIT) for the code, and `templates/LICENSE` (CC0 1.0) for template content.
- [ ] Add a short `README.md`: what the repo is, the commands, and where the rules are.
- [ ] Done when: every Validation Command succeeds on a fresh clone.

### Task 2: Template validator
- [ ] Parse template files with a reader that sees the raw JSON, so it can reject a byte-order mark, repeated keys, `null`, and a `version` written with a decimal point or exponent (domain rules, 2.1, 2.3, 2.4). Standard `JSON.parse` hides all of these.
- [ ] Check every rule in domain rules 2.1 (size, encoding), 2.3 (fields, `id` equal to the file name, items, item count, at least one item that isn't retired), 2.5 (ids) and 2.6 (languages, lengths, whitespace, NFC, forbidden characters, `{{`, `}}`, `$t(`).
- [ ] Report every problem in a file with the file name and the JSON path (for example `items[2].name.pl`), not just the first one.
- [ ] `npm run check` validates every file in `templates/v1/`.
- [ ] Tests: one passing and one failing fixture for each rule, including the edge cases named in the rules (U+00A0 at an edge, U+2028, a lone surrogate, `3.0`, a repeated key, a 61-unit name, an emoji counted as 2 units, every item retired). The domain-rules example passes.
- [ ] Done when: `npm test` and `npm run check` pass, and a broken fixture copied into `templates/v1/` makes `npm run check` fail with a readable message.

### Task 3: Checks against `main`
- [ ] `npm run check` also compares `templates/v1/` with a base ref (default `origin/main`, settable on the command line). It fails when:
  - a template file on the base is missing;
  - an item id on the base is missing from its template;
  - a file's parsed JSON differs from the base without a higher `version`, or a `version` is lower than on the base;
  - an item or template that is retired on the base is no longer retired

  (domain rules, 2.7 and 3).
- [ ] Reformatting a file without changing its parsed JSON doesn't need a new version.
- [ ] A template that's new in the pull request is checked only against section 2.
- [ ] Tests: a fixture pair (base, changed) for each failure above, and for each case that must pass (reformatting only, a new template, a correctly bumped edit).
- [ ] Done when: `npm test` and `npm run check` pass.

### Task 4: Catalog generator
- [ ] `npm run build` writes `templates/v1/<id>.json` unchanged and generates `templates/v1/catalog.json` into the build output (domain rules, 2.2 and 3). The catalog is never committed.
- [ ] The catalog lists templates that aren't retired, sorted by `id` in code-point order, with `version`, `name` and `description` copied from the file (including extra languages) and `itemCount` counting items that aren't retired.
- [ ] The build fails if the generated catalog breaks a rule in 2.1 or 2.2 (for example, it's over 256 KB).
- [ ] Tests: empty catalog, a retired template left out, a retired item not counted, sort order, extra languages copied, an oversized catalog failing the build.
- [ ] Done when: `npm test` and `npm run build` pass, and the built catalog for the test fixtures matches the expected file exactly.

### Task 5: Site pages
- [ ] Build `/`, `/gallery/` and `/gallery/<id>/` as described in domain rules, section 4:
  - the gallery list (English, sorted by English name, with item count);
  - template pages: items grouped as Essential then Optional, file order within each group, retired items hidden, no version, and the "New kit → More templates → <name>" instructions;
  - pages for retired templates, with their notice and not listed in the gallery.
- [ ] Language switching on template pages: the four app languages, English first; extra languages not shown. Record how it works in `docs/decisions/`.
- [ ] Footer on every page, store buttons driven by the site configuration (hidden when unset), and every link working under `/kitkeep-site/`.
- [ ] No third-party resources: no analytics, cookies, or fonts, scripts or images from other hosts.
- [ ] Tests on the build output: the gallery list and order, retired templates and items, grouping, store buttons with neither link, one link and both links set, the footer on every page, and no `http(s)://` resource URL pointing to another host.
- [ ] Done when: `npm test` and `npm run build` pass, and the built site, served locally under `/kitkeep-site/`, shows the example template correctly in all four languages.

### Task 6: Pull request checks and publishing
- [ ] A workflow runs the Validation Commands on every pull request, on `pull_request` (not `pull_request_target`), with a read-only token, and with enough git history for the comparison with `main` (Task 3).
- [ ] A workflow builds and publishes the site to GitHub Pages only from `main`, through the `github-pages` environment restricted to `main`.
- [ ] Every third-party action is pinned to a commit SHA; no secrets anywhere (domain rules, 3, pipeline security).
- [ ] Done when: a pull request shows the checks passing; a pull request with a broken template shows them failing; and after merge, `https://weberlance.github.io/kitkeep-site/templates/v1/catalog.json` is served over HTTPS.

### Task 7: Repository settings and contribution files
- [ ] Add `CODEOWNERS` covering `templates/`.
- [ ] Add a pull request template that asks how each language was written (native speaker, fluent speaker, machine translation) and states that contributions are released under CC0.
- [ ] Settings (done by the maintainer on GitHub): `main` takes changes only through pull requests with the checks passing; no force pushes; `main` can't be deleted; no required review for now; the `github-pages` environment allows only `main`; no custom domain on the repo or the `weberlance.github.io` user site.
- [ ] Account (done by the maintainer): two-factor authentication with a passkey or security key, and recovery codes stored safely.
- [ ] Done when: a direct push to `main` is refused, and a pull request with failing checks can't be merged.

### Task 8: First real template
- [ ] Write a real template (the domain-rules example can be the starting point), with quantities based on an official preparedness guide, and link the source in the pull request.
- [ ] Translations in all four languages, with the pull request template filled in. The maintainer checks the languages they know and spot-checks the others.
- [ ] Done when: the template is merged with every check passing, and it appears in the published catalog and on its gallery page.

### Task 9: Privacy and support pages
Needs the support address from `docs/open-questions.md`.
- [ ] Create the support mailbox (domain rules, section 6), protected like the GitHub account, and record its address in the site configuration.
- [ ] Write `/privacy/` with everything domain rules, section 5 requires, including the backups and camera texts (with ML Kit's technical data on Android), and a "Last updated" date.
- [ ] Write `/support/` with the support address and the FAQ (moving kits to a new phone).
- [ ] Tests on the build output: both pages exist, link from the footer or the home page, and show the support address.
- [ ] Done when: both pages are published and match domain rules, sections 5 and 6.

### Task 10: Ready for the app's first release
Needs the app's confirmation of every rule marked **(app: to confirm)** in `docs/domain-rules.md`.
- [ ] The app has confirmed each of those rules. Remove the markers, and the entry in `docs/open-questions.md`.
- [ ] The Google Play Data safety form matches the privacy policy, including ML Kit's technical data on Android (likely "App info and performance" and "Device or other IDs"; check the form's guidance).
- [ ] The store listings link to `/privacy/` and `/support/`. Store links in the site configuration can come later; the buttons stay hidden until then.
- [ ] Done when: at least one real template is published and passes every check, the privacy and support pages are live, the support mailbox works, and `docs/open-questions.md` has no entry that blocks the release.
