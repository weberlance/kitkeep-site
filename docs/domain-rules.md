# Domain rules

The business rules of `kitkeep-site`: the website of the KitKeep app and the source of the kit templates the app can download. Update this file in the same pull request as any rule change.

- The reasons behind the rules are in `docs/decisions/`, starting with `2026-11-04-site-requirements-review.md`.
- **Section 2 is a contract with the app**, which implements the same rules on its own side. Any change to it must be agreed with the app first. Rules marked **(app: to confirm)** still need the app's confirmation; they're tracked in `docs/open-questions.md`.

## 1. How the app uses the site

**KitKeep** is an offline-first mobile app (iOS and Android) for assembling and maintaining emergency backpacks ("kits"): which items to pack, which are packed, and when they expire. There is no account and no backend; all data stays on the phone. The app is available in English, Russian, Polish and Ukrainian. It comes with two built-in templates.

The site's templates are extra kit templates that can be added without releasing the app:
- **The catalog:** the app requests it only when the user opens "More templates" while creating a kit. It never makes background requests.
- **A template:** tapping a catalog entry downloads that template, and the user creates a kit from it. The app then saves the template's texts on the phone, so the kit shows in every language from then on, even after the template leaves the site.
- **One-time copy (app: to confirm):** a kit is a copy of the template at the moment it was created. Later versions of the template never change existing kits. Item ids are still permanent (2.7), so that a sync can be added later without breaking anything.
- **Built-in templates (app: to confirm):** they are separate from the site's. The app records where a kit came from as `builtin:<id>` or `site:<id>`, so site ids can never collide with built-in ones, and the site keeps no list of reserved ids.
- **A failed template:** if a template breaks the contract, the app rejects that one template and the rest of the catalog stays usable.
- **A bad catalog entry:** the app skips it and lists the rest. If an id appears twice, the app keeps the first entry.
- **Disagreement:** if a template file and its catalog entry disagree (for example while caches update), the app trusts the template file.
- **Old apps:** apps already on phones never update their reader. That's why the compatibility rules in 2.7 are strict.

## 2. Data contract

### 2.1 Addresses
- **Base:** `https://weberlance.github.io/kitkeep-site/templates/v1/`. The app has this address built in, so after the app's first release it can't change.
- **Files:** `catalog.json` and one `<id>.json` per template, both directly under the base.
- **HTTPS only.** A redirect is allowed only to another HTTPS address.
- **Encoding:** UTF-8 JSON with no byte-order mark.
- **Size:** at most 256 KB per file, counted on the bytes of the file as stored, before any compression in transit. At about 2–2.5 KB per entry, the catalog reaches this limit at roughly 100 templates; going past that needs `v2/` (2.7).

### 2.2 `catalog.json`
```json
{
  "format": "kitkeep-catalog",
  "templates": [
    {
      "id": "winter-car",
      "version": 2,
      "itemCount": 3,
      "name": { "en": "Winter car kit", "ru": "Зимний набор для машины", "pl": "Zimowy zestaw do auta", "uk": "Зимовий набір для авто" },
      "description": { "en": "For cold-weather trips: staying warm and getting moving again if the car is stuck.", "ru": "Для поездок в холод: как согреться и снова тронуться, если машина застряла.", "pl": "Na wyjazdy w mróz: jak się ogrzać i ruszyć dalej, gdy auto utknie.", "uk": "Для поїздок у холод: як зігрітися й знову рушити, якщо авто застрягло." }
    }
  ]
}
```
- `format` is required and is exactly `kitkeep-catalog`.
- **Required fields of an entry:** `id`, `version`, `itemCount`, `name`, `description`.
- **Entries:** one per published template that isn't retired, sorted by `id` in ascending code-point order, with no duplicate ids. An empty list is valid; the app shows "No templates yet". The order only keeps the file stable; the app sorts entries for display in its own way.
- **Matching the files:** each entry's `version`, `name` and `description` equal those in the template's file, including any extra languages. `itemCount` is the number of items in it that aren't retired, so it's always at least 1.

### 2.3 `<id>.json`
```json
{
  "format": "kitkeep-template",
  "id": "winter-car",
  "version": 2,
  "name": {
    "en": "Winter car kit",
    "ru": "Зимний набор для машины",
    "pl": "Zimowy zestaw do auta",
    "uk": "Зимовий набір для авто"
  },
  "description": {
    "en": "For cold-weather trips: staying warm and getting moving again if the car is stuck.",
    "ru": "Для поездок в холод: как согреться и снова тронуться, если машина застряла.",
    "pl": "Na wyjazdy w mróz: jak się ogrzać i ruszyć dalej, gdy auto utknie.",
    "uk": "Для поїздок у холод: як зігрітися й знову рушити, якщо авто застрягло."
  },
  "items": [
    {
      "id": "ice-scraper",
      "importance": "essential",
      "name": { "en": "Ice scraper", "ru": "Скребок для льда", "pl": "Skrobaczka do szyb", "uk": "Скребок для льоду" }
    },
    {
      "id": "thermal-blanket",
      "importance": "essential",
      "name": { "en": "Thermal blanket", "ru": "Термоодеяло", "pl": "Koc termiczny", "uk": "Термоковдра" },
      "recommendation": { "en": "1 per seat", "ru": "1 на каждое место", "pl": "1 na każde miejsce", "uk": "1 на кожне місце" }
    },
    {
      "id": "tow-strap",
      "importance": "optional",
      "name": { "en": "Tow strap", "ru": "Буксировочный трос", "pl": "Linka holownicza", "uk": "Буксирувальний трос" },
      "recommendation": { "en": "At least 4 m, rated for your car's weight", "ru": "Не короче 4 м, под вес вашей машины", "pl": "Co najmniej 4 m, na masę twojego auta", "uk": "Щонайменше 4 м, під вагу вашого авто" }
    },
    {
      "id": "hand-warmers",
      "importance": "optional",
      "retired": true,
      "name": { "en": "Hand warmers", "ru": "Грелки для рук", "pl": "Ogrzewacze do rąk", "uk": "Грілки для рук" },
      "recommendation": { "en": "2 pairs", "ru": "2 пары", "pl": "2 pary", "uk": "2 пари" }
    }
  ]
}
```
The example is at version 2 because retiring `hand-warmers` changed the file.

- `format` is required and is exactly `kitkeep-template`.
- **Required fields:** `format`, `id`, `version`, `name`, `description`, `items`. Optional: `retired`.
- `id` equals the file name without `.json`. The app rejects a file whose `id` differs from the one it requested.
- `version` is a whole number from 1 to 2147483647 (2³¹−1), written without a decimal point or exponent: `3.0` and `3e0` are rejected **(app: to confirm)**.
- **Each item:**
  - required: `id`, `importance`, `name`;
  - `importance` is `essential` or `optional`;
  - `recommendation` is optional;
  - `retired` is optional (default `false`); a retired item isn't added to new kits. A retired item still meets every rule in this section, and it keeps its place in the list.
- **The template itself:** `retired` is optional (default `false`); a retired template is left out of the catalog and the gallery list (2.7 and section 4).
- **Item count:** 1 to 100 items, retired ones included, and at least one of them not retired. The app also rejects a template without an item that isn't retired **(app: to confirm)**. Item ids are unique within the template; the same item id may be used in different templates.
- **Item order:** the order of `items` is meaningful. The gallery shows items in this order within each importance group (section 4).

### 2.4 JSON
- `null` isn't allowed anywhere **(app: to confirm)**. An optional field is either left out or has a valid value.
- An object must not repeat a key. The site's checks reject repeated keys; the app may reject them too, but doesn't have to.

### 2.5 Ids
Template and item ids are lowercase kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 to 40 characters.

### 2.6 Text
These rules apply to every `name`, `description` and `recommendation`, in every language, including in retired items. The app rejects the same forbidden characters as the site's checks **(app: to confirm)**.
- **Languages:** `en`, `ru`, `pl` and `uk` are all required. Other languages may be added, and the app ignores them until it supports that language. Their codes are BCP 47 language tags written in lowercase (for example `de`, `pt-br`), and their texts follow every rule here. They count toward the file size.
- **Lengths:** counted in UTF-16 code units (JavaScript `string.length`).

  | Field | Length |
  |---|---|
  | Template name | 1–60 |
  | Description | 1–300 |
  | Item name | 1–80 |
  | Recommendation | 1–200 |

  The template name is also the kit name the app suggests, and kit names are limited to 60.
- **Clean edges:** no whitespace at the start or end. Whitespace means anything JavaScript's `\s` matches, which includes U+00A0 and U+3000, not only the space.
- **No repeated whitespace:** no two whitespace characters in a row. This is checked by the site only; the app doesn't reject it.
- **Unicode NFC** (precomposed characters), so the same word always has the same length.
- **Forbidden characters:**
  - control characters U+0000–U+001F and U+007F–U+009F, including line breaks, tabs and U+0085;
  - the line and paragraph separators U+2028 and U+2029;
  - bidirectional controls U+202A–U+202E, U+2066–U+2069, U+200E, U+200F and U+061C;
  - U+200B, U+2060, U+FEFF and the soft hyphen U+00AD;
  - lone surrogates (possible in JSON as `\uD800` and the like);
  - noncharacters (U+FDD0–U+FDEF, and the last two code points of every plane, such as U+FFFE and U+FFFF);
  - private-use characters (U+E000–U+F8FF, and planes 15 and 16).

  U+200C and U+200D are allowed, because emoji sequences and some scripts need them. Unassigned code points aren't checked, because the answer depends on the checker's Unicode version and would reject new emoji.
- **No `{{`, `}}` or `$t(`:** the app passes the text to its translation library, which treats these as markup.
- **Plain text only:** the app shows the text as it is, so HTML or Markdown would appear literally. This is an editorial rule checked in review, not by the checks, because characters like `<` and `*` can be legitimate ("<5 kg").

### 2.7 Compatibility
- **Inside `v1/`:** optional fields may be added, and the app ignores fields it doesn't know.
- **Breaking changes need a new folder, `v2/`:**
  - the site publishing anything an app already released would reject, for example by loosening a rule (longer texts, a new `importance` value, more than 100 items, a character that was forbidden);
  - removing or renaming a field, or changing its type or meaning.

  A rule may be tightened inside `v1/` as long as the published data already meets it.
- **App side (app: to confirm):** a new version of the app never rejects data that was valid `v1` before.
- **When `v2/` exists:** `v1/` is frozen. It's never removed, gets no new templates, and changes only to fix errors that matter for safety.
- **Versions:** a template's `version` goes up with every change to its file, and never goes down. A change means the parsed JSON differs; reformatting alone doesn't need a new version.
- **Item ids:** a released item id is never removed, renamed or reused. Its texts may be corrected (typos, better wording), but if the item becomes a different thing (for example 2 L of water becomes 4 L), it gets a new id and the old one is retired. To take an item out, set `"retired": true` on it.
- **Template ids:** a released template id is never reused for a different template. To take a template off the site, set `"retired": true` on the template. Its file stays, so its id stays reserved.
- **Retiring can't be undone.** A retired item or template stays retired. A retirement made by mistake is fixed by adding the item or template again under a new id.
- **A full template:** if a template reaches 100 items, retired ones included, it's replaced by a successor template with a new id, and the old one is retired.

## 3. Repository

- **The repo:** public, `weberlance/kitkeep-site`, on a personal GitHub account. The address in 2.1 depends on the account name and the repo name, so neither may be renamed once the app has shipped.
- **`main`:**
  - changes only through pull requests, which merge only when the checks pass;
  - no force pushes, and `main` can't be deleted;
  - no required review while there's one maintainer;
  - a `CODEOWNERS` entry covers `templates/`, and review from code owners becomes required once there's a second maintainer.
- **Template files** live in the repo at `templates/v1/<id>.json` and are published exactly as they are.
- **The catalog is generated** from the template files when the site is built, and isn't kept in the repo, so the two can't disagree.
- **Checks on every pull request:**
  - every template file meets section 2, including its size;
  - no item id on `main` is missing from the pull request;
  - no template file on `main` is missing from the pull request;
  - a template file whose parsed JSON differs from `main` has a higher `version`, and no `version` is lower than on `main`;
  - no item or template that is retired on `main` is un-retired;
  - the site builds, including the catalog.
- **Licenses:** template content (`templates/`) is released under CC0; the site's code is under MIT. The app shows template texts without room for credits, and CC0 means nobody has to be credited.
- **Contributions:** a pull request template:
  - asks how each language was written: native speaker, fluent speaker, or machine translation;
  - states that submitting releases the contribution under CC0.

  The maintainer checks the languages they know and spot-checks the others. Later, a `CONTRIBUTING.md` asks template pull requests to link a source for their quantities, for example an official preparedness guide.
- **Account security:** the catalog isn't signed, so the account is the only protection.
  - Two-factor authentication on the account (ideally a passkey or security key), and recovery codes kept safe.
  - The account is never renamed or deleted: a freed username can be registered by someone else, who would then serve the address in 2.1.
  - No custom domain, neither on this repo nor on the `weberlance.github.io` user site. A custom domain on the user site would redirect every project site to it, and a lapsed domain can be taken over. Moving to a custom domain would need signing to be reconsidered.
- **Pipeline security:**
  - the site is published only from `main`, through the `github-pages` environment restricted to `main`;
  - pull request checks run on `pull_request` (not `pull_request_target`) with a read-only token;
  - third-party GitHub Actions are pinned to a commit SHA;
  - the repo and its workflows hold no secrets.

## 4. Pages

All paths are relative to the site's base address, `https://weberlance.github.io/kitkeep-site/`.

| Path | Content |
|---|---|
| `/` | What KitKeep is (emergency kits, expiry tracking, works offline, no account), store buttons, and a link to the gallery. Screenshots can come later. |
| `/gallery/` | The list of the site's published templates that aren't retired: name, description and item count, in English, sorted by English name. Built-in templates aren't listed. |
| `/gallery/<id>/` | One template: name, description, item count (items that aren't retired), and the items with their recommendations, retired items hidden. Items are grouped as "Essential" then "Optional", in file order within each group. The version isn't shown. The page says how to find the template in the app: "New kit → More templates → <name>". Also store buttons. |
| `/privacy/` | The privacy policy (section 5) |
| `/support/` | The support email address and a short FAQ (for example, how to move kits to a new phone: export them in Settings, then import the file on the new phone) |

- **Paths:** pages stay out of `/templates/`, so a template id can never collide with the data folder.
- **Retired templates:** a retired template's page stays, so shared links keep working. It shows a notice, "This template is no longer offered in the app", in place of the instructions for finding it in the app, and it isn't listed on `/gallery/`.
- **Languages:** the site's own text is in English only. Template pages show the template in the four app languages, English first, and the reader can switch between them. Extra languages in a template aren't shown until the app supports them.
- **Footer on every page:** "Templates are suggestions from the KitKeep community, not professional safety advice."
- **Store buttons** (App Store and Google Play): each appears only when its store link is set in the site's configuration. With neither set, no buttons appear.
- **No third-party resources:** the site has no analytics, no cookies, and no fonts, scripts or images from other hosts. Everything is served from GitHub Pages.

## 5. Privacy policy

The policy covers both the app and the site. It's in English, shows a "Last updated" date (the repo's history keeps earlier versions), and gives the support email address as the contact. It must be updated whenever the app's data handling changes. Checked against the app on 2026-11-04, it must say:
- **Data:** no account, and KitKeep itself has no analytics. Apart from ML Kit's technical data on Android (see Camera), nothing leaves the phone without a user action. Kits are kept in a database inside the app, on the phone.
- **Backups:**
  - If iCloud Backup, a computer backup or Google backup is turned on, the backup may include KitKeep's data. The phone's operating system makes these backups; iCloud and Google backups are stored by Apple or Google under their terms, and a computer backup stays on the user's computer.
  - KitKeep never receives these backups and can't read them. The developer has no copy of anyone's kits.
  - The user controls backups in the phone's settings, for the whole phone or, on iPhone, just for KitKeep.
  - Restoring a backup isn't guaranteed to bring kits back. To move kits reliably, export them in Settings and import the file on the new phone, the same advice as on the support page.
  - Uninstalling the app deletes its data from the phone. Copies already in a backup are kept and deleted under the backup's own rules.

  Draft text:

  > **Backups.** Your kits are stored in a database inside the app, on your phone. If you use iCloud Backup, a computer backup, or Google backup, your phone's backup may include KitKeep's data. These backups are made by your phone's operating system. iCloud and Google backups are stored by Apple or Google under their terms; a computer backup stays on your computer. KitKeep never receives them and can't read them. You can turn backups off in your phone's settings (on iPhone, also just for KitKeep). Restoring a backup doesn't always bring kits back, so to move kits to a new phone, export them in Settings and import the file there. Uninstalling KitKeep deletes its data from your phone, but not from backups that were already made.
- **Export files:** created and shared only by the user.
- **Camera** (confirmed with the app on 2026-11-04):
  - The text is recognized on the phone on both platforms: Apple Vision on iPhone, and Google's ML Kit on Android, with its model inside the app (no download). The photo is never sent anywhere and is deleted as soon as it has been read, whatever the outcome.
  - On Android, ML Kit sends Google technical data about its use: device information (manufacturer, model, OS version), performance (such as how long recognition took), API configuration (such as image format and resolution), and an identifier for this installation. It doesn't send the photo or its text. Because of the installation identifier, the policy doesn't call this data anonymous.
  - The policy doesn't say *when* this data is sent. ML Kit starts with the app, and no network check has shown whether anything is sent before the first scan.

  Draft text:

  > **Camera.** KitKeep can read an expiry date from a photo you take. The text is recognized on your phone (Apple Vision on iPhone, Google's ML Kit inside the app on Android); the photo is never sent anywhere and is deleted as soon as it has been read. On Android, ML Kit sends Google technical data about its use, such as the phone model, OS version, how long recognition took and an identifier for this installation, but not the photo or its text.

  If the app project later proves, with a network check on a release build, that the metrics are turned off, the Android sentence and the exception in "Data" are removed.
- **Notifications:** local, scheduled on the phone.
- **Web search:** opens Google in the in-app browser with the item's name, so Google sees that search.
- **More templates:** fetches files from GitHub Pages, so GitHub sees the phone's IP address. Nothing else is sent.
- **The website:** no analytics and no cookies; GitHub Pages sees visitors' IP addresses.

## 6. Support contact

A dedicated mailbox used only for KitKeep, not the maintainer's personal one (for example on Proton or Gmail).
- It's protected like the GitHub account: a passkey or two-factor authentication, and recovery codes kept with the GitHub ones.
- It must never lapse, because its address is printed in the policy and the store listings.
- The address name is still to be chosen (`docs/open-questions.md`).
