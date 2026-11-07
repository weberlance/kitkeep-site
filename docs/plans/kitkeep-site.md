# Plan: KitKeep site

Build `kitkeep-site`: the website of the KitKeep app and the source of the kit templates the app downloads. Every rule this plan implements is in `docs/domain-rules.md`; the plan says what to build and in what order, not the rules themselves. Reasons are in `docs/decisions/2026-11-04-site-requirements-review.md` and `docs/decisions/2026-11-05-plan-review.md`. Unanswered questions are in `docs/open-questions.md`.

- The site is built before the app's download feature, so the data contract (domain rules, section 2) has to be right before the app's first release; after that it can't change in `v1/`.
- Until Task 9, `templates/v1/` holds test data: templates may be changed or deleted freely, to test GitHub Pages and the app's integration (domain rules, section 3, before the first release). Task 9 must be merged before the app's first release.
- The app's confirmation of the rules marked **(app: to confirm)** (open question 1) isn't a task here: when the app confirms, a docs pull request removes the markers and the entry. Release readiness is tracked in the app project.

## Validation Commands
- `npm ci`
- `npm test`
- `npm run check`
- `npm run build`

The scripts are created in Task 1; until a later task fills them in, each one succeeds without doing anything.

## Branches and pull requests
- **Structure:** the plan's feature branch is `feature/kitkeep-site`. Each task has its own branch off it, `feature/kitkeep-site-task-<N>`, which merges into the feature branch. The feature branch merges into `main`.
- **Pull requests:** the maintainer opens and merges them. Claude doesn't.
- **Reaching `main`:** Tasks 1–4 stay on the feature branch. From Task 5 on, the feature branch merges into `main` as soon as a task is ready, because publishing and the settings in Task 6 only act on `main`. Where a task says "merged" or "after merge", it means merged into `main`.
- **Merge method:** the feature branch merges into `main` with a merge commit, not a squash, because it keeps living after each merge and a squash would make it diverge.
- **Done checks that need `main`:** the Done when of Tasks 5, 6, 8, 9 and 10 can only be observed after the merge, so it can't be ticked in the task's own pull request. Tick it in a small follow-up pull request. The next task starts only after that. For Task 10, the same follow-up moves the plan to `docs/plans/completed/`.

## Technical choices
These apply to every task.
- **Toolchain:** Node.js 26 (LTS) with npm, pinned in `.nvmrc` and `engines`. No runtime or dev dependencies: tests use Node's built-in test runner (`node --test`), and the build is a plain Node script.
- **Layout:**
  - `scripts/` holds the validator, the build and the local server;
  - `src/layout.js` holds the shared page layout (head, header, footer);
  - `src/pages/privacy.html` and `src/pages/support.html` hold the hand-written content of those pages;
  - `src/assets/` holds the stylesheet and the store badges;
  - `site.config.json` holds the site configuration;
  - `test/` holds the tests and `test/fixtures/` the fixture templates;
  - `dist/` is the build output (not committed).
- **Site configuration** (`site.config.json`): `appStoreUrl` and `googlePlayUrl` (each a URL or `null`; `null` hides that button) and `supportEmail` (an address, or `null` until Task 10). The build fails if a page uses `{{supportEmail}}` while it's `null`.
- **Command-line options:** `--templates <dir>` (default `templates/v1`) for `check` and `build`; `--out <dir>` (default `dist`) and `--config <file>` (default `site.config.json`) for `build`; `--base <ref>` (default `origin/main`) for `check` from Task 9. Passed as `npm run build -- --templates test/fixtures/site`.
- **Size limit:** 262,144 bytes per file (domain rules, 2.1), for templates and the catalog.
- **Templates folder:** a missing `--templates` folder is an error, for both `check` and `build`, so a mistyped path can't publish an empty catalog. An existing empty folder is valid, but git can't store one, so tests create it when they run.
- **HTML:** every template text is inserted through one `escapeHtml()` helper. Pages are written as `<path>/index.html`, so URLs end in `/`. All links are built from the base path `/kitkeep-site/`.

### Task 1: Project setup
- [x] Add `package.json` with the `test`, `check`, `build` and `serve` scripts and `engines.node`, the lockfile, `.nvmrc` (`26`), and `.gitignore` (`dist/`, `node_modules/`).
- [x] Add the licenses: `LICENSE` (MIT) for the code, and `templates/LICENSE` (CC0 1.0) for template content.
- [x] Add a short `README.md`: what the repo is, the commands, the site configuration, and where the rules are.
- [x] Done when: every Validation Command succeeds on a fresh clone.

### Task 2: Template validator
- [x] Parse template files with a hand-written JSON reader that sees the raw text, so it can reject invalid UTF-8, a byte-order mark, repeated keys, `null`, and a `version` written with a decimal point or exponent (domain rules, 2.1, 2.3, 2.4). Standard `JSON.parse` hides these.
- [x] Check every rule in domain rules 2.1 (size, encoding), 2.3 (fields, `id` equal to the file name, items, item count, at least one item that isn't retired), 2.4, 2.5 (ids) and 2.6 (languages, lengths, whitespace, NFC, forbidden characters, `{{`, `}}`, `$t(`).
- [x] Reject fields not listed in domain rules 2.3, at every level. Inside `name`, `description` and `recommendation`, keys are language codes: the four required ones plus lowercase BCP 47 tags (domain rules, 2.6), checked with `Intl.getCanonicalLocales` and a lowercase test (domain rules, 3, checks).
- [x] `templates/v1/` may contain only `<id>.json` files, with `<id>` following 2.5. Anything else (including a `catalog.json`, subfolders or other files) is an error.
- [x] Report every problem in every file as `<file>: <JSON path>: <message>` (for example `winter-car.json: items[2].name.pl: ...`), not just the first one, and exit with a non-zero code if there is any.
- [x] `npm run check` validates every file in the templates folder.
- [x] Add the test template `templates/v1/winter-car.json`: the domain-rules example at `version: 1`, with its three items that aren't retired and without `hand-warmers`. It's test data (domain rules, section 3, before the first release). It's added here because git doesn't keep an empty folder, and `templates/v1/` can't hold a placeholder file, so `npm run check` would otherwise fail on a fresh clone.
- [x] Tests: one passing and one failing fixture for each rule, including the edge cases named in the rules (U+00A0 at an edge, U+2028, a lone surrogate, `3.0`, a repeated key, a 61-unit name, an emoji counted as 2 units, every item retired, an unknown field such as `recomendation`). The domain-rules example passes.
- [x] Done when: `npm test` and `npm run check` pass, and a broken fixture copied into `templates/v1/` makes `npm run check` fail with a readable message.

### Task 3: Catalog generator
- [x] `npm run build` first validates the templates folder as in Task 2 and fails if any file is invalid.
- [x] It copies every `<id>.json` byte for byte to `dist/templates/v1/`, retired templates included, and generates `dist/templates/v1/catalog.json` (domain rules, 2.2 and 3). The catalog is never committed.
- [x] The catalog lists templates that aren't retired, sorted by `id` in code-point order, with `version`, `name` and `description` copied from the file (including extra languages, in the file's key order) and `itemCount` counting items that aren't retired.
- [x] Output format: `JSON.stringify(catalog, null, 2)` plus a trailing newline, with keys in this order: `format`, `templates`; in each entry `id`, `version`, `itemCount`, `name`, `description`.
- [x] The build fails if the generated catalog breaks a rule in 2.1 or 2.2 (for example, it's over 256 KB).
- [x] Tests: empty catalog, a retired template left out, a retired item not counted, sort order, extra languages copied, an oversized catalog failing the build (generated in the test), and each copied template byte-identical to its source.
- [x] Done when: `npm test` and `npm run build` pass, and the built catalog for the test fixtures matches the expected file exactly.

### Task 4: Site pages and the test template
- [x] Build `/`, `/gallery/` and `/gallery/<id>/` as described in domain rules, section 4:
  - the home page: what KitKeep is and a link to the gallery (text drafted by Claude, reviewed in the pull request);
  - the gallery list (English, sorted by English name with `Intl.Collator('en')`, ties by `id`, with item count);
  - template pages: items grouped as Essential then Optional, file order within each group, retired items hidden, and no version;
  - pages for retired templates, with their notice and not listed in the gallery.
- [x] Language switching on template pages: the page contains one block per app language (`<section lang="en">`, `ru`, `pl`, `uk`) and four buttons (`English`, `Русский`, `Polski`, `Українська`). A small inline script shows English on load and the chosen block on click; the choice isn't remembered or put in the URL. Without JavaScript all four blocks are shown, English first, and the buttons stay hidden because they would do nothing (they're `hidden` in the HTML and the script reveals them). Extra languages aren't shown. Each block holds the template's name, description, items and recommendations; the site's own text, such as "Essential" and "Optional", stays in English (domain rules, section 4).
- [x] Shared layout: footer on every page, and links working under `/kitkeep-site/`.
- [x] Store buttons: the official App Store and Google Play badges, stored in `src/assets/badges/` (downloaded once from Apple's and Google's marketing pages and used under their guidelines), each shown only when its link is set in `site.config.json`. Add `site.config.json` here, with both links and `supportEmail` set to `null`. The README notes that the badges belong to Apple and Google and aren't under the repo's licenses.
- [x] No third-party resources: no analytics, cookies, or fonts, scripts or images from other hosts. Plain CSS in `src/assets/`.
- [x] `npm run serve` serves `dist/` under `/kitkeep-site/` with Node's `http` module, for previewing.
- [x] Tests on the build output (built from fixtures): the gallery list and order, retired templates and items, grouping, the language blocks, an HTML special character in a template text escaped, store buttons with neither link, one link and both links set (each through `--config`), the footer on every page, and no resource URL (`src`, `<link href>`, CSS `url()`) pointing to another host. Ordinary `<a href>` links may point anywhere.
- [x] Done when: `npm test` and `npm run build` pass, and the built site, served with `npm run serve`, shows winter-car correctly in all four languages.

### Task 5: Pull request checks and publishing
- [x] Before the first merge into `main`, the maintainer sets the Pages source to "GitHub Actions" on GitHub. Pages is currently off for the repo, and the workflow's token can't turn it on, so the deployment fails without this.
- [x] `.github/workflows/checks.yml` runs the Validation Commands on every pull request, on `pull_request` (not `pull_request_target`), with `permissions: contents: read`, using the Node version from `.nvmrc`.
- [x] `.github/workflows/publish.yml` runs on pushes to `main` (and manually): it runs the Validation Commands, then uploads `dist/` and deploys it to GitHub Pages through the `github-pages` environment, with only the permissions the deployment needs (`contents: read`, `pages: write`, `id-token: write`) and one deployment at a time.
- [x] Every action, GitHub's own `actions/*` included, is pinned to a full commit SHA, with the version in a comment. No secrets anywhere (domain rules, 3, pipeline security).
- [x] Done when: a pull request shows the checks passing; a pull request with a broken template shows them failing; and after merge, `https://weberlance.github.io/kitkeep-site/templates/v1/catalog.json` and `.../templates/v1/winter-car.json` are served over HTTPS and match the build.

### Task 6: Repository settings and contribution files
- [x] Add `.github/CODEOWNERS` covering `templates/` with `@weberlance`.
- [x] Add `.github/pull_request_template.md` that asks how each language was written (native speaker, fluent speaker, machine translation), asks for a source for the quantities if there is one (for example an official preparedness guide; recommended, not required), and states that contributions are released under CC0.
- [x] Settings (done by the maintainer on GitHub):
  - a ruleset on `main`: changes only through pull requests, the `checks.yml` job required to pass, no force pushes, no deletion, no required review, and no bypass for anyone, admins included;
  - the `github-pages` environment allows deployments only from `main`;
  - no custom domain on the repo or the `weberlance.github.io` user site.
- [ ] Account (done by the maintainer): two-factor authentication with a passkey or security key, and recovery codes stored safely.
- [x] Done when: a direct push to `main` is refused, and a pull request with failing checks can't be merged.

**Remaining (2026-11-07):** the settings are in place and the Done when passed: a direct push to `main` was refused, and PR #7, with a failing `checks` job, couldn't be merged. The account item stays unticked until the maintainer confirms it, and it must be ticked before Task 8 starts.

### Task 7: Integration test with the app
Done together with the app project; the app side is judged there.
- [x] The app's test build fetches `catalog.json` and `winter-car.json` from GitHub Pages and creates a kit from it.
- [x] Through pull requests on this repo, change winter-car (with a higher `version`), add a second test template, then delete one; after each publish the app shows the new catalog correctly.
- [x] Record anything learned that affects the data contract in `docs/open-questions.md` (for agreement with the app) or `docs/decisions/`.
- [x] Done when: the app project reports that every step above works with the published site.

### Task 8: First real templates
- [ ] Add two templates in one pull request: `emergency-medicine-kit-adult` and `emergency-medicine-kit-child`, from the maintainer's draft lists (the `AdultFullFirstAidKit` and `ChildFullFirstAidKit` lists, recorded in `docs/decisions/2026-11-05-plan-review.md`).
- [ ] Names:

  | | Adult | Child |
  |---|---|---|
  | en | Emergency medicine kit for adults | Emergency medicine kit for children |
  | ru | Тревожная аптечка для взрослых | Тревожная аптечка для детей |
  | pl | Apteczka ewakuacyjna dla dorosłych | Apteczka ewakuacyjna dla dzieci |
  | uk | Тривожна аптечка для дорослих | Тривожна аптечка для дітей |

- [ ] Item ids are the kebab-case form of the draft keys (for example `nitrile-gloves`, `sterile-non-adherent-dressings`), and the recommendations are the draft texts. Texts that are too long in any language are shortened (for example the child kit's medical information card).
- [ ] Importance: essential items are personal medications, medical information card, paracetamol, ibuprofen, antihistamine, nitrile gloves, sterile gauze pads, sterile non-adherent dressings, large sterile absorbent dressings, gauze bandages, medical adhesive tape (sensitive-skin medical tape in the child kit), adhesive bandages, sterile saline, blunt-tipped scissors, digital thermometer, emergency thermal blanket, water-resistant first aid pouch, and, in the child kit, oral dosing syringes. Everything else is optional. That gives 17 essential and 9 optional items for adults, and 18 essential and 9 optional for children.
- [ ] Descriptions and the ru/pl/uk translations drafted by Claude; the pull request template filled in (machine-assisted translation). The maintainer checks the languages they know and spot-checks the others. Sources are linked if there are any (recommended, not required).
- [ ] Delete every test template from `templates/v1/` in the same pull request.
- [ ] Done when: the pull request is merged with every check passing, `templates/v1/` holds only the two kits, and both appear in the published catalog and on their gallery pages.

### Task 9: Checks against `main`
From this task on, templates in `templates/v1/` are permanent (domain rules, 2.7 and 3). Merge it before the app's first release.
- [ ] `npm run check` also compares the templates folder with a base ref (`--base`, default `origin/main`), reading the base files with `git show` and parsing them with the Task 2 reader. It fails when:
  - a template file on the base is missing;
  - an item id on the base is missing from its template;
  - a file's parsed JSON differs from the base without a higher `version`, or a `version` is lower than on the base;
  - an item or template that is retired on the base is no longer retired

  (domain rules, 2.7 and 3).
- [ ] Parsed JSON is compared with object key order ignored and array order kept, so reformatting a file or reordering keys doesn't need a new version.
- [ ] A template that's new in the pull request is checked only against section 2.
- [ ] If the base ref doesn't exist, the check fails with a message saying how to fetch it; it's never skipped.
- [ ] `checks.yml` and `publish.yml` both fetch `main` so the base ref exists in CI; both run `npm run check`.
- [ ] Tests: a fixture pair (base, changed) for each failure above, and for each case that must pass (reformatting only, reordered keys, a new template, a correctly bumped edit), plus a missing base ref. Each test commits its base files to a temporary git repository and runs the check there.
- [ ] Update domain rules section 3 to say the checks against `main` are in force, removing the "before the first release" exception.
- [ ] Done when: `npm test` and `npm run check` pass, and a pull request that deletes an item id from a kit fails its checks.

### Task 10: Privacy and support pages
- [ ] Set `supportEmail` in `site.config.json` to `kitkeep.app@gmail.com` (domain rules, section 6). The maintainer creates the mailbox and protects it with a passkey or two-factor authentication, with recovery codes kept with the GitHub ones. The maintainer also signs in at least once a year, because Google may delete a personal account after two years of inactivity and the address must never lapse (domain rules, section 6).
- [ ] Write `src/pages/privacy.html` with everything domain rules section 5 requires, including the backups and camera texts (with ML Kit's technical data on Android), and a "Last updated" date set to the day the pull request is merged.
- [ ] Write `src/pages/support.html` with the support address and the FAQ (moving kits to a new phone). The address is inserted from `site.config.json` through a `{{supportEmail}}` placeholder in both pages.
- [ ] Link both pages from the footer.
- [ ] Tests on the build output: both pages exist, are linked from the footer of every page, and show the support address from the configuration.
- [ ] Done when: both pages are published and match domain rules, sections 5 and 6.
