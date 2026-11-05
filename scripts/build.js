// `npm run build`: validates the templates, then writes the published files.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { checkCatalog, generateCatalog } from './catalog.js';
import { formatProblem, validateFolder } from './validator.js';

function readOptions() {
  try {
    return parseArgs({
      options: {
        templates: { type: 'string', default: 'templates/v1' },
        out: { type: 'string', default: 'dist' },
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

const { templates: templatesFolder, out } = readOptions();

const { problems, templates } = validateFolder(templatesFolder);
if (problems.length > 0) failWith(problems);

const catalog = generateCatalog(templates.map((template) => template.value));
const catalogProblems = checkCatalog(catalog);
if (catalogProblems.length > 0) {
  failWith(catalogProblems.map((problem) => ({ file: 'catalog.json', ...problem })));
}

// Only what the build owns is removed, because --out can point anywhere.
const dataFolder = join(out, 'templates', 'v1');
rmSync(dataFolder, { recursive: true, force: true });
mkdirSync(dataFolder, { recursive: true });

for (const { fileName, bytes } of templates) {
  writeFileSync(join(dataFolder, fileName), bytes);
}
writeFileSync(join(dataFolder, 'catalog.json'), catalog);

console.log(`Built ${out}: ${templates.length} template file(s) and the catalog.`);
