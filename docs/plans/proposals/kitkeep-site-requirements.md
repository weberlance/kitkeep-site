# KitKeep site: requirements

Requirements for `kitkeep-site`, the website of the KitKeep app and the source of the kit templates the app can download. This document is self-contained: it's written to be handed to the site project, and it describes only what the site must provide, not how to build it.

- Prepared: 2026-11-04.
- The site is built before the app's download feature. The app implements the same contract on its own side, so **any change to section 2 must be agreed with the app first**.

## 1. Context

**KitKeep** is an offline-first mobile app (iOS and Android) for assembling and maintaining emergency backpacks ("kits"): which items to pack, which are packed, and when they expire. There is no account and no backend; all data stays on the phone. The app is available in English, Russian, Polish and Ukrainian. It comes with two built-in templates.

**How the app uses the site.** The site's templates are extra kit templates that can be added without releasing the app:
- **The catalog:** the app requests it only when the user opens "More templates" while creating a kit. It never makes background requests.
- **A template:** tapping a catalog entry downloads that template, and the user creates a kit from it. The app then saves the template's texts on the phone, so the kit shows in every language from then on, even after the template leaves the site.
- **A failed template:** if a template breaks the contract, the app rejects that one template and the rest of the catalog stays usable.
- **A bad catalog entry:** the app skips it and lists the rest. If an id appears twice, the app keeps the first entry.
- **Disagreement:** if a template file and its catalog entry disagree (for example while caches update), the app trusts the template file.
- **Old apps:** apps already on phones never update their reader. That's why the compatibility rules in 2.6 are strict.

## 2. Public contract

### 2.1 Addresses
- **Base:** `https://weberlance.github.io/kitkeep-site/templates/v1/`. The app has this address built in, so after the app's first release it can't change.
- **Files:** `catalog.json` and one `<id>.json` per template, both directly under the base.
- **HTTPS only.** A redirect is allowed only to another HTTPS address.
- **Encoding:** UTF-8 JSON with no byte-order mark, at most 256 KB per file.

### 2.2 `catalog.json`
```json
{
  "format": "kitkeep-catalog",
  "templates": [
    { "id": "winter-car", "version": 3, "itemCount": 12,
      "name": { "en": "Winter car kit", "ru": "…", "pl": "…", "uk": "…" },
      "description": { "en": "…", "ru": "…", "pl": "…", "uk": "…" } }
  ]
}
```
- `format` is required and is exactly `kitkeep-catalog`.
- **Entries:** one per published template that isn't retired, in `id` order, with no duplicate ids. An empty list is valid; the app shows "No templates yet".
- **Matching the files:** each entry's `version`, `name` and `description` equal those in the template's file. `itemCount` is the number of items in it that aren't retired.

### 2.3 `<id>.json`
```json
{
  "format": "kitkeep-template",
  "id": "winter-car",
  "version": 3,
  "name": { "en": "…", "ru": "…", "pl": "…", "uk": "…" },
  "description": { "en": "…", "ru": "…", "pl": "…", "uk": "…" },
  "items": [
    { "id": "ice-scraper", "importance": "essential",
      "name": { "en": "…", "ru": "…", "pl": "…", "uk": "…" },
      "recommendation": { "en": "…", "ru": "…", "pl": "…", "uk": "…" } }
  ]
}
```
- `format` is required and is exactly `kitkeep-template`.
- `id` equals the file name without `.json`. The app rejects a file whose `id` differs from the one it requested.
- `version` is a positive integer.
- **Each item:**
  - `importance` is `essential` or `optional`;
  - `recommendation` is optional;
  - `retired` is optional (default `false`); a retired item isn't added to new kits.
- **The template itself:** `retired` is optional (default `false`); a retired template is left out of the catalog and the gallery (see 2.6).
- **Item count:** 1 to 100 items, retired ones included. Item ids are unique within the template.

### 2.4 Ids
Template and item ids are lowercase kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 to 40 characters.

### 2.5 Text
These rules apply to every `name`, `description` and `recommendation`, in every language.
- **Languages:** `en`, `ru`, `pl` and `uk` are all required. Other language codes may be added, and the app ignores them until it supports that language.
- **Lengths:** counted in UTF-16 code units (JavaScript `string.length`).

  | Field | Length |
  |---|---|
  | Template name | 1–60 |
  | Description | 1–300 |
  | Item name | 1–80 |
  | Recommendation | 1–200 |

  The template name is also the kit name the app suggests, and kit names are limited to 60.
- **Clean edges:** no spaces at the start or end.
- **Unicode NFC** (precomposed characters), so the same word always has the same length.
- **Forbidden characters:**
  - control characters, including line breaks and tabs;
  - bidirectional controls U+202A–U+202E, U+2066–U+2069, U+200E, U+200F and U+061C;
  - U+200B, U+2060 and U+FEFF.

  U+200C and U+200D are allowed, because emoji sequences and some scripts need them.
- **No `{{`, `}}` or `$t(`:** the app passes the text to its translation library, which treats these as markup.
- **Plain text only:** the app shows the text as it is, so HTML or Markdown would appear literally.

### 2.6 Compatibility
- **Inside `v1/`:** optional fields may be added, and the app ignores fields it doesn't know.
- **Breaking changes:** removing or renaming a field, changing its type or meaning, or tightening a rule needs a new folder, `v2/`. `v1/` stays published for older apps for as long as they're in use.
- **Versions:** a template's `version` goes up with every change to its file, and never goes down.
- **Item ids:** a released item id is never removed, renamed or reused. To take an item out, set `"retired": true` on it.
- **Template ids:** a released template id is never reused for a different template. To take a template off the site, set `"retired": true` on the template. Its file stays, so its id stays reserved.

## 3. Repository rules

- **The repo:** public, `weberlance/kitkeep-site`, on a personal GitHub account. The address in 2.1 depends on the account name and the repo name, so neither may be renamed once the app has shipped.
- **`main`:**
  - changes only through pull requests, which merge only when the checks pass;
  - no force pushes, and `main` can't be deleted;
  - no required review while there's one maintainer;
  - a `CODEOWNERS` entry covers `templates/`, and review from code owners becomes required once there's a second maintainer.
- **The catalog is always derived from the template files** and is never edited by hand, so the two can't disagree.
- **Checks on every pull request:**
  - every template file meets section 2;
  - the catalog matches the template files;
  - no item id on `main` is missing from the pull request;
  - no template file on `main` is missing from the pull request;
  - the site builds.
- **Contributions:** a pull request template asks how each language was written: native speaker, fluent speaker, or machine translation. The maintainer checks the languages they know and spot-checks the others. Later, a `CONTRIBUTING.md` asks template pull requests to link a source for their quantities, for example an official preparedness guide.
- **Account security:** two-factor authentication on the account (ideally a passkey or security key), and recovery codes kept safe. The catalog isn't signed, so the account is the only protection. Moving to a custom domain would need signing to be reconsidered, because a lapsed domain can be taken over.

## 4. Pages

| Path | Content |
|---|---|
| `/` | What KitKeep is (emergency kits, expiry tracking, works offline, no account), store buttons, and a link to the gallery. Screenshots can come later. |
| `/gallery/` | The list of published templates that aren't retired |
| `/gallery/<id>/` | One template: name, description, and items with their recommendations (retired items hidden). It says how to find the template in the app: "New kit → More templates → <name>". Also store buttons. |
| `/privacy/` | The privacy policy |
| `/support/` | The support email address and a short FAQ (for example, how to move kits to a new phone: export them in Settings, then import the file on the new phone) |

- **Paths:** pages stay out of `/templates/`, so a template id can never collide with the data folder.
- **Languages:** the site's own text is in English only. Template pages show the template in all four languages, English first, and the reader can switch between them.
- **Footer on every page:** "Templates are suggestions from the KitKeep community, not professional safety advice."
- **Store buttons** (App Store and Google Play): each appears only when its store link is set in the site's configuration. With neither set, no buttons appear.
- **The privacy policy must say** (checked against the app on 2026-11-04):
  - **Data:** no account, no analytics, and nothing leaves the phone without a user action. Kits are kept on the phone. They may be included in the phone's own iCloud or Google backups, which KitKeep doesn't control; the app hasn't yet decided whether to keep its data in OS backups, so confirm this point before publishing.
  - **Export files:** created and shared only by the user.
  - **Camera:** reads expiry dates from photos on the phone, and the photo is deleted right away.
  - **Notifications:** local, scheduled on the phone.
  - **Web search:** opens Google in the in-app browser with the item's name, so Google sees that search.
  - **More templates:** fetches files from GitHub Pages, so GitHub sees the phone's IP address. Nothing else is sent.

  The policy must be updated whenever the app's data handling changes.
- **Support contact:** an email address used only for KitKeep, not the maintainer's personal one.

## 5. Before the app's first release

- **Content:** at least one real template is published and passes every check.
- **Pages:** the privacy policy and support pages are live; the store listings link to them.
- **Support:** the support email address exists.
- **Store links:** they can be added later; the buttons stay hidden until then.

## 6. Left to the site project

- the build tool, page templates and styling (plain styling is enough to start);
- how readers switch languages on template pages;
- how the checks are implemented;
- how the site is published.
