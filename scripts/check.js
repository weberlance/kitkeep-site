// `npm run check`: validates every file in the templates folder.

import { parseArgs } from 'node:util';
import { formatProblem, validateFolder } from './validator.js';

function readOptions() {
  try {
    return parseArgs({
      options: { templates: { type: 'string', default: 'templates/v1' } },
    }).values;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

const { templates: folder } = readOptions();
const { problems, templates } = validateFolder(folder);

if (problems.length > 0) {
  for (const problem of problems) console.error(formatProblem(problem));
  console.error(`\n${problems.length} problem(s) found in ${folder}.`);
  process.exit(1);
}
console.log(`${templates.length} template file(s) in ${folder} are valid.`);
