// `npm run build`: validates the templates, then writes the published files.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkCatalog, generateCatalog } from './catalog.js';
import { loadConfig } from './config.js';
import { renderSite } from './site.js';
import { formatProblem, validateFolder } from './validator.js';

const ASSETS = fileURLToPath(new URL('../src/assets', import.meta.url));

function readOptions() {
  try {
    return parseArgs({
      options: {
        templates: { type: 'string', default: 'templates/v1' },
        out: { type: 'string', default: 'dist' },
        config: { type: 'string', default: 'site.config.json' },
      },
    }).values;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

function failWith(problems) {
  for (const problem of problems) console.error(formatProblem(problem));
  console.error(`\nThe build failed with ${problems.length} problem(s).`);
  process.exit(1);
}

const options = readOptions();
const { out } = options;

const { config, problems: configProblems } = loadConfig(options.config);
const { problems, templates } = validateFolder(options.templates);
if (configProblems.length + problems.length > 0) failWith([...configProblems, ...problems]);

const parsedTemplates = templates.map((template) => template.value);
const catalog = generateCatalog(parsedTemplates);
const catalogProblems = checkCatalog(catalog);
if (catalogProblems.length > 0) {
  failWith(catalogProblems.map((problem) => ({ file: 'catalog.json', ...problem })));
}
const pages = renderSite(parsedTemplates, config);

// Only what the build owns is removed, because --out can point anywhere.
for (const owned of ['templates/v1', 'gallery', 'assets', 'index.html']) {
  rmSync(join(out, owned), { recursive: true, force: true });
}

const dataFolder = join(out, 'templates', 'v1');
mkdirSync(dataFolder, { recursive: true });
for (const { fileName, bytes } of templates) {
  writeFileSync(join(dataFolder, fileName), bytes);
}
writeFileSync(join(dataFolder, 'catalog.json'), catalog);

cpSync(ASSETS, join(out, 'assets'), { recursive: true });
for (const { path, html } of pages) {
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

console.log(`Built ${out}: ${templates.length} template file(s), the catalog and ${pages.length} page(s).`);
