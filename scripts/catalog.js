// Generates catalog.json from the template files, and checks the result against
// domain rules 2.1 and 2.2.

import { readJson } from './json-reader.js';
import { MAX_FILE_BYTES } from './validator.js';

export function isRetired(templateOrItem) {
  return templateOrItem.retired === true;
}

function compareById(a, b) {
  // Ids are ASCII, so comparing UTF-16 code units is code-point order. This sorts
  // ids, not file names, which differ: `a-b.json` sorts before `a.json`.
  if (a.id < b.id) return -1;
  return a.id > b.id ? 1 : 0;
}

// `templates` holds the parsed template objects. Returns the text of catalog.json.
export function generateCatalog(templates) {
  const entries = templates
    .filter((template) => !isRetired(template))
    .map((template) => ({
      id: template.id,
      version: template.version,
      itemCount: template.items.filter((item) => !isRetired(item)).length,
      name: template.name,
      description: template.description,
    }))
    .sort(compareById);
  return `${JSON.stringify({ format: 'kitkeep-catalog', templates: entries }, null, 2)}\n`;
}

const ENTRY_FIELDS = ['id', 'version', 'itemCount', 'name', 'description'];

// Returns [{ path, message }], empty if the catalog meets the rules.
export function checkCatalog(text) {
  const bytes = Buffer.from(text, 'utf8');
  const { parsed, value, problems } = readJson(bytes);
  if (bytes.length > MAX_FILE_BYTES) {
    problems.push({
      path: '',
      message: `the catalog is ${bytes.length} bytes, over the limit of ${MAX_FILE_BYTES}; going past it needs v2/ (domain rules, 2.1 and 2.7)`,
    });
  }
  if (!parsed) return problems;

  if (value.format !== 'kitkeep-catalog') {
    problems.push({ path: 'format', message: 'must be exactly "kitkeep-catalog"' });
  }
  if (!Array.isArray(value.templates)) {
    problems.push({ path: 'templates', message: 'must be an array' });
    return problems;
  }
  value.templates.forEach((entry, index) => {
    const path = `templates[${index}]`;
    for (const field of ENTRY_FIELDS) {
      if (!Object.hasOwn(entry, field)) {
        problems.push({ path: `${path}.${field}`, message: 'this required field is missing' });
      }
    }
    if (!(entry.itemCount >= 1)) {
      problems.push({ path: `${path}.itemCount`, message: 'must be at least 1' });
    }
    const previous = value.templates[index - 1];
    if (previous !== undefined && !(previous.id < entry.id)) {
      problems.push({
        path: `${path}.id`,
        message: `"${entry.id}" must sort after "${previous.id}", with no duplicates`,
      });
    }
  });
  return problems;
}
