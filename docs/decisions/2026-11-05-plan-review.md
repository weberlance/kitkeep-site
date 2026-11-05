# Plan review

- Date: 2026-11-05.
- Applies to: `docs/plans/kitkeep-site.md`, reviewed so that it holds only clear requirements and instructions. Task numbers below refer to the plan after this review.

Each decision gives what was chosen, why, and what was rejected.

## 1. Build approach
- **Decision:** a plain Node script with no dependencies generates static HTML pages (`/`, `/gallery/`, `/gallery/<id>/`, `/privacy/`, `/support/`) into `dist/`, copies the template files byte for byte and generates the catalog. Privacy and support are hand-written HTML fragments in `src/pages/`, wrapped in the shared layout at build time. Node 26 (LTS), Node's built-in test runner.
- **Why:** four kinds of page don't justify a framework, and no dependencies means nothing to pin, audit or upgrade in a pipeline that publishes the address built into the app (domain rules, 3, pipeline security).
- **Rejected:** Eleventy (a large dependency tree in CI); a Node script plus a Markdown library (one dependency for two short pages).

## 2. Language switching
- **Decision:** a template page contains all four app languages in `lang` blocks; a small inline script shows one at a time, starting with English on every load. The choice isn't remembered or put in the URL. Without JavaScript all four are shown.
- **Why:** meets "the reader can switch" with one URL per template, and still works without JavaScript.
- **Rejected:** a page per language (four times the paths to keep stable); all languages stacked with jump links; remembering the language in the URL (not needed).

## 3. Test data before the first release
- **Decision:** until the checks against `main` come into force (plan Task 9, before the app's first release), `templates/v1/` holds test data that may be changed or deleted freely. The first test template is winter-car, published at `version: 1` with its three items that aren't retired (the domain-rules example stays an illustration; the retired-item case is covered by a fixture). The test templates are deleted in the pull request that adds the first real templates (Task 8), which comes before Task 9.
- **Why:** the app is still in test mode, so no real user is affected. The goal is to develop the approach and test GitHub Pages and the app's integration with real published files.
- **Rejected:** keeping winter-car in fixtures only (an empty live site until the real template); publishing the example at version 2 with a retired item never offered; a `released` flag that switches the checks on (more machinery than needed); a bypass label or admin merge for deletions.

## 4. Unknown fields
- **Decision:** the site's checks reject fields that section 2.3 doesn't list. Inside texts, keys are language codes. Recorded in domain rules section 3 (the checks), not section 2, because the app's side doesn't change: it still ignores unknown fields.
- **Why:** a typo like `recomendation` would otherwise be published and silently ignored by the app. Tightening the site's output is allowed inside `v1/`.
- **Rejected:** allowing unknown fields; a warning that doesn't fail the check.

## 5. Catalog format
- **Decision:** `JSON.stringify(catalog, null, 2)` plus a trailing newline, with a fixed key order (`format`, `templates`; `id`, `version`, `itemCount`, `name`, `description`).
- **Why:** readable in a browser and in diffs. The extra 5–8% only matters near 100 templates, and the size check fails clearly before then.
- **Rejected:** minified output.

## 6. Store buttons
- **Decision:** the official App Store and Google Play badges, stored in the repo and served from GitHub Pages, used under Apple's and Google's guidelines and noted in the README as theirs.
- **Why:** instantly recognisable, and stored locally they keep "no third-party resources".
- **Rejected:** plain text buttons.

## 7. First real templates
- **Decision:** two templates, `emergency-medicine-kit-adult` and `emergency-medicine-kit-child`, named "Emergency medicine kit for adults / for children" (ru "Тревожная аптечка…", pl "Apteczka ewakuacyjna…", uk "Тривожна аптечка…"). They're meant to be packed in the emergency backpack. Importance as listed in plan Task 8; the digital thermometer is essential in both.
- **Why:** the adult and child recommendations differ too much to share one template ("12 tablets, 500 mg" against a children's formulation dosed by weight). The list (pouch, thermal blanket, 7-day personal medicines, medical card) fits a grab-and-go kit, and "тревожная / тривожна / ewakuacyjna" are the usual go-bag terms.
- **Rejected:** one template with child items as optional; "First aid kit" (suggests injuries only); "Home medicine kit".

## 8. Sources are recommended, not required
- **Decision:** a template pull request links a source for its quantities if there is one; a pull request without one isn't blocked.
- **Why:** some templates are for very specific kits with no official guide.
- **Rejected:** requiring an official guide for every template.

## 9. No release task in this plan
- **Decision:** release readiness (the Data safety form, App Store privacy details, store listings) is tracked in the app project. The app's confirmation of the **(app: to confirm)** rules is handled by a docs pull request when it arrives.
- **Why:** this plan holds only work done in this repo.
- **Rejected:** a release gate limited to this repo; keeping the store work here.

## 10. Privacy policy scope
- **Decision:** the policy stays as domain rules section 5 specifies, without a section naming a data controller or listing GDPR rights.
- **Why:** the maintainer's choice; the developer holds almost no user data.
- **Rejected:** a short "Who we are and your rights" section.

## 11. Support address
- **Decision:** `kitkeep.app@gmail.com`.
- **Why:** Gmail is free with passkeys, has no inactivity lapse risk on free accounts like Proton's, and fits the Google Play developer account.
- **Rejected:** Proton.

## 12. Smaller defaults
- **Decision:**
  - build output in `dist/`; `--templates`, `--out` and `--base` options;
  - the build runs the validator;
  - `templates/v1/` holds only `<id>.json` files;
  - a missing base ref fails the check;
  - key order is ignored when comparing with `main`;
  - the gallery is sorted with `Intl.Collator('en')`, ties by `id`;
  - `site.config.json` holds the store links and the support address;
  - the third-party check covers resource URLs, not `<a href>` links;
  - `npm run serve` previews the site;
  - every action is pinned to a SHA, `actions/*` included;
  - the publish workflow runs the Validation Commands first;
  - the `main` ruleset has no bypass;
  - the Pages source is "GitHub Actions";
  - the home page text is drafted by Claude and reviewed in its pull request.
- **Why:** routine choices that make every task checkable.

## 13. Size limit in bytes
- **Decision:** "256 KB" in domain rules 2.1 means 262,144 bytes (256 × 1024). The app still has to confirm this (open question 1).
- **Why:** the maintainer's choice. The site and the app have to use the same number, or the site could publish a file the app rejects.
- **Rejected:** 256,000 bytes.

## 14. Task order
- **Decision:** the privacy and support pages stay at Task 10, after the integration test with the app (Task 7).
- **Why:** the maintainer's choice, knowing that those pages wait until the app's download feature works.
- **Rejected:** moving Task 10 ahead of Task 7.

## 15. No instructions for finding a template in the app
- **Decision:** template pages don't say how to find the template in the app. A retired template's page keeps its notice.
- **Why:** the maintainer's choice. It also settles which language the template's name would have used in that line.
- **Rejected:** "New kit → More templates → <name>", with the name in the chosen language or always in English.

## Draft lists for Task 8
The maintainer's draft, as given on 2026-11-05. Recommendations may be shortened to fit 2.6.

Adult (`AdultFullFirstAidKit`):
- Paracetamol: 12 tablets, 500 mg each.
- Ibuprofen: 12 tablets, 200 mg each.
- Antihistamine: 1 small pack of cetirizine OR loratadine.
- Nitrile gloves: 4 pairs.
- Sterile gauze pads: 10 individually wrapped pads, approximately 10 × 10 cm.
- Sterile non-adherent dressings: 3.
- Large sterile absorbent dressings: 2, approximately 10 × 20 cm.
- Gauze bandages: 2 rolls each of 5 cm and 10 cm width.
- Medical adhesive tape: 1 roll, approximately 2.5 cm × 5 m.
- Adhesive bandages: 15 assorted sizes.
- Hydrocolloid blister plasters: 4.
- Elastic bandage: 1 roll.
- Triangular bandage: 1.
- Sterile saline: 5 single-use plastic containers, 10 mL each.
- Hand sanitizer: 30 mL.
- Blunt-tipped scissors: 1 pair.
- Tweezers: 1 pair.
- Digital thermometer: 1.
- Instant cold pack: 1.
- Emergency thermal blanket: 1.
- Waste bags: 2.
- First aid instructions: 1 official First Aid Guide.
- Medication instructions and record: Product leaflets, medication administration record and pencil.
- Water-resistant first aid pouch: 1.
- Personal medications: Prescribed regular and emergency medications; preferably a 7-day supply.
- Medical information card: Allergies or unknown allergy status, current medications, prescribed doses and relevant medical conditions.

Child (`ChildFullFirstAidKit`):
- Paracetamol: 1 original pack of an age-appropriate children's formulation; sufficient for up to 72 hours based on body weight and product instructions.
- Ibuprofen: 1 original pack of an age-appropriate children's formulation; sufficient for up to 72 hours based on body weight and product instructions.
- Oral dosing syringes: 1 needle-free oral syringe per liquid medicine.
- Antihistamine: 1 small original pack of a second-generation antihistamine in an age-appropriate formulation.
- Nitrile gloves: 4 pairs, sized for the caregiver.
- Sterile gauze pads: 5 individually wrapped pads each of 5 × 5 cm and 10 × 10 cm.
- Sterile non-adherent dressings: 3.
- Large sterile absorbent dressings: 2.
- Gauze bandages: 2 rolls each of 5 cm and 10 cm width.
- Sensitive-skin medical tape: 1 roll.
- Adhesive bandages: 15 assorted sizes, including small sizes.
- Blister plasters: 3, for a child who walks.
- Elastic bandage: 1 roll.
- Triangular bandage: 1.
- Sterile saline: 5 single-use plastic containers, 10 mL each.
- Hand sanitizer: 30 mL.
- Blunt-tipped scissors: 1 pair.
- Tweezers: 1 pair.
- Digital thermometer: 1.
- Instant cold pack: 1.
- Emergency thermal blanket: 1.
- Waste bags: 2.
- First aid instructions: 1 official Pediatric First Aid Guide.
- Medication instructions and record: Product leaflets, medication administration record and pencil.
- Water-resistant first aid pouch: 1.
- Personal medications: Prescribed regular and emergency medications; preferably a 7-day supply.
- Medical information card: Age, current body weight, allergies or unknown allergy status, current medications and relevant medical conditions; prescribed doses, including concentration and dose in mL for liquid medicines.
