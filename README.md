# kitkeep-site

The website of the KitKeep mobile app, published with GitHub Pages at <https://weberlance.github.io/kitkeep-site/>, and the source of the kit templates the app downloads from `templates/v1/`.

## Commands

Use Node.js 26 (`nvm use` reads `.nvmrc`). There are no dependencies.

| Command | What it does |
|---|---|
| `npm ci` | Sets up the project from the lockfile |
| `npm test` | Runs the tests |
| `npm run check` | Validates the template files and compares them with `origin/main` (run `git fetch origin main` first) |
| `npm run build` | Builds the site into `dist/` |
| `npm run serve` | Previews `dist/` under `/kitkeep-site/` |

Options are passed after `--`, for example `npm run build -- --templates test/fixtures/site`:

- `--templates <dir>` (`check`, `build`): the templates folder, by default `templates/v1`
- `--out <dir>` (`build`): the output folder, by default `dist`
- `--config <file>` (`build`): the site configuration, by default `site.config.json`
- `--base <ref>` (`check`): the ref to compare templates with, by default `origin/main`
- `--out <dir>` and `--port <number>` (`serve`): the folder to serve, by default `dist`, and the port, by default `8080`

## Site configuration

`site.config.json` holds:

- `appStoreUrl` and `googlePlayUrl`: each a URL, or `null` to hide that store button
- `supportEmail`: the support address

## Where the rules are

- `docs/domain-rules.md`: the business rules, including the data contract with the app (section 2)
- `docs/decisions/`: earlier decisions and their reasons
- `docs/open-questions.md`: unanswered questions
- `docs/plans/`: plans still to be implemented

## Licenses

The code is under the MIT license (`LICENSE`). Template content in `templates/` is released under CC0 1.0 (`templates/LICENSE`).

The store badges in `src/assets/badges/` belong to Apple and Google, are used under their guidelines, and aren't under either license.
