// `npm run check`: validates every file in the templates folder, then compares
// the folder with the base ref (domain rules, 2.7 and 3).

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { compareWithBase, readBaseFiles } from './base.js';
import { formatProblem, validateFolder } from './validator.js';

function readOptions() {
  try {
    return parseArgs({
      options: {
        templates: { type: 'string', default: 'templates/v1' },
        base: { type: 'string', default: 'origin/main' },
      },
    }).values;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

const { templates: folder, base } = readOptions();
const { problems, templates } = validateFolder(folder);

// A missing folder is already reported, and comparing it would only add a
// "must not be deleted" line for every template on the base.
if (existsSync(folder)) {
  const { files: baseFiles, problem } = readBaseFiles(base, folder);
  if (problem) problems.push(problem);
  else problems.push(...compareWithBase({ base, baseFiles, folder, templates }));
}

if (problems.length > 0) {
  for (const problem of problems) console.error(formatProblem(problem));
  console.error(`\n${problems.length} problem(s) found in ${folder}.`);
  process.exit(1);
}
console.log(`${templates.length} template file(s) in ${folder} are valid and match the rules for changes since ${base}.`);
