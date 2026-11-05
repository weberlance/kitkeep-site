# Site requirements review

- Date: 2026-11-04.
- Applies to: the requirements proposal, whose rules are now in `docs/domain-rules.md` and whose work is in `docs/plans/kitkeep-site.md` (decision 18). Section numbers below refer to the proposal at the time of the review.
- Rules that need the app's agreement are marked **(app: to confirm)** in `docs/domain-rules.md` and tracked in `docs/open-questions.md`.

Each decision gives what was chosen, why, and what was rejected.

## 1. Templates are a one-time copy
- **Decision:** a kit is a copy of the template when it was created; later versions never change existing kits. Item ids stay permanent anyway. Texts may be corrected under the same id; an item that becomes a different thing gets a new id.
- **Why:** simplest for the first release. Permanent ids cost nothing now and are the one thing that can't be added later, so a sync stays possible.
- **Rejected:** refreshing texts in existing kits; a full "update kit from template" sync.

## 2. Compatibility direction
- **Decision:** the site never publishes anything an app already released would reject, so loosening a rule needs `v2/`. A rule may be tightened inside `v1/` if the published data already meets it. A new app never rejects data that was valid `v1` before.
- **Why:** old apps never update their reader, so loosening is the change that breaks them. The doc had named only tightening.
- **Rejected:** an app that tolerates more than the site produces (hidden fallbacks, frozen forever in old apps).

## 3. Separate namespaces for built-in and site templates
- **Decision:** the app records a kit's source as `builtin:<id>` or `site:<id>`. The site keeps no list of reserved ids, and the gallery shows site templates only.
- **Why:** collisions become impossible in the app's data model, with nothing to maintain on the site.
- **Rejected:** one namespace with reserved built-in ids; publishing the built-in templates on the site.

## 4. At least one item that isn't retired
- **Decision:** a template must have an item that isn't retired, checked by the site and by the app; `itemCount` is always at least 1.
- **Why:** a template with every item retired would create an empty kit. Retiring the template is the proper way to take it down.
- **Rejected:** treating such a template as retired; allowing empty kits.

## 5. 100 items, retired ones included
- **Decision:** the cap stays. A template that fills up is replaced by a successor with a new id, and the old one is retired.
- **Why:** realistic templates have 10–40 items, and a higher cap would loosen what old apps accept and make files larger.
- **Rejected:** counting only active items; raising the cap before release.

## 6. Size limit
- **Decision:** 256 KB for every file, counted on the stored bytes before compression, and enforced by a check. When the catalog nears the limit (roughly 100 templates), the move is to `v2/`.
- **Why:** one unambiguous number that the app and the checks can both test.
- **Rejected:** 1 MB per file; separate limits for templates and the catalog.

## 7. Field rules
- **Decision:**
  - required fields are spelled out;
  - `null` isn't allowed;
  - `version` is a whole number from 1 to 2³¹−1, without a decimal point or exponent;
  - repeated JSON keys are rejected by the site;
  - catalog entries are sorted by `id` in code-point order, and the app sorts for display in its own way;
  - item order in the file is meaningful;
  - retired items still meet every rule and keep their place.

  The doc's examples are replaced with a real, valid template.
- **Why:** every point the doc left open becomes a rule that can be checked.

## 8. Text rules
- **Decision:**
  - no Unicode whitespace at the edges;
  - no repeated whitespace (checked by the site only);
  - newly forbidden: U+2028, U+2029, U+0085, U+00AD, lone surrogates, noncharacters and private-use characters;
  - unassigned code points aren't checked;
  - extra languages use lowercase BCP 47 tags and follow every rule;
  - HTML and Markdown are caught in review.
- **Why:** the rules were ambiguous about whitespace and line breaks. Checking unassigned code points would depend on the Unicode version and reject new emoji. `<` and `*` can be legitimate.

## 9. `v1/` after `v2/`
- **Decision:** once `v2/` exists, `v1/` is frozen: never removed, no new templates, only fixes that matter for safety.
- **Why:** with no analytics, "as long as old apps are in use" can't be measured. Static hosting costs nothing.
- **Rejected:** maintaining both formats in parallel; a fixed sunset date.

## 10. Additional checks
- **Decision:** a file whose parsed JSON changed has a higher `version`; no `version` goes down; retirement can't be undone; at least one item isn't retired; size.
- **Why:** these are rules from section 2 that no check enforced. Comparing parsed JSON lets reformatting through without a new version. A retirement made by mistake is fixed with a new id.
- **Rejected:** a byte-level comparison; checking that `importance` doesn't change (that's a legitimate editorial change).

## 11. The catalog is generated at build time
- **Decision:** `catalog.json` is generated during the site build and not kept in the repo. Template files in `templates/v1/` are published as they are. The "catalog matches the files" check is dropped.
- **Why:** removes a whole class of errors and a check, and fits "never edited by hand".
- **Rejected:** committing it and checking it in CI; a bot committing it after merge (needs push rights to `main`).

## 12. Licenses
- **Decision:** template content under CC0, site code under MIT. The pull request template states that contributions are released under CC0.
- **Why:** the app shows texts with no room for credits, and the texts stay on phones after a template leaves the site.
- **Rejected:** CC BY 4.0 (the app would need to show attribution); all rights reserved with a CLA.

## 13. Protecting the address and the pipeline
- **Decision:**
  - no custom domain on the repo or the `weberlance.github.io` user site;
  - the account is never renamed or deleted;
  - the site is published only from `main` through the `github-pages` environment;
  - pull request checks run on `pull_request` with a read-only token;
  - actions are pinned to a commit SHA;
  - no secrets.
- **Why:** the base address is built into the app and the catalog isn't signed, so the account and the pipeline are the only protection.
- **Rejected:** requiring signed commits (little gain for one maintainer).

## 14. Retired template pages
- **Decision:** the page stays, with "This template is no longer offered in the app", and isn't listed on `/gallery/`. On live pages, retired items stay hidden.
- **Why:** shared links keep working, and kits built from it remain explainable. The file stays anyway.
- **Rejected:** a 404; redirecting to a successor template.

## 15. Template page content
- **Decision:**
  - template pages group items as "Essential" then "Optional", in file order within each group;
  - the item count is shown; the version and extra languages are not;
  - `/gallery/` shows name, description and item count, sorted by English name;
  - all paths are relative to `/kitkeep-site/`.
- **Why:** grouping by importance mirrors how a kit is used. It's a site-only choice, independent of how the app shows items.

## 16. Privacy policy
- **Decision:**
  - the policy covers the app and the site, and the site loads no third-party resources;
  - it's in English, with a "Last updated" date, and the support address as contact;
  - the backups section follows the agreed points, with a fix: a computer backup stays on the user's computer rather than with Apple;
  - camera recognition on the phone (and the Android model download) is still to be confirmed with the app.
- **Why:** with no third-party resources, the site's privacy statement is true by construction. The backups text resolves what was blocking the policy.

## 17. Support mailbox
- **Decision:** a dedicated mailbox (Proton or Gmail) with a passkey, protected like the GitHub account. The address name is still to be chosen.
- **Why:** keeps the maintainer's personal identity out of support, and can serve as the developer contact in the store listings.
- **Rejected:** a forwarding alias; GitHub Issues only (public, and needs a GitHub account).

## 18. Where rules live
- **Decision:** all rules move into `docs/domain-rules.md`, which is now the single source and the document to share with the app. Rules that still need the app's confirmation are marked **(app: to confirm)** there. The requirements proposal became the plan `docs/plans/kitkeep-site.md`, which describes only the work.
- **Why:** one place for rules, as the project conventions require, with no second copy to keep in sync. The markers keep the agreement with the app visible without a separate document.
- **Rejected:** keeping the requirements doc as the source until the app confirms (first chosen on 2026-11-04, then replaced the same day by the maintainer's decision); a short index in `domain-rules.md`.

## 19. ML Kit's usage metrics on Android
- **Decision:** disclose them in the privacy policy now. The app project may try turning them off later; the policy is simplified only once a network check on a release build proves nothing is sent.
- **Facts (from the app, 2026-11-04):**
  - recognition runs on the phone on both platforms (Apple Vision on iOS; ML Kit on Android, with its model bundled inside the app);
  - photos are deleted whatever the outcome;
  - on Android, ML Kit sends Google device information, performance and API configuration data, plus an installation identifier, but not the image.
- **Why:** honest and supported, and it doesn't block publishing. Turning the metrics off is undocumented, could break recognition, and would need checking again after every ML Kit upgrade. Because of the installation identifier, the data is described as technical data, not "anonymous". The policy doesn't say when it's sent, because ML Kit starts with the app.
- **Rejected:** blocking the policy until the metrics are turned off.
