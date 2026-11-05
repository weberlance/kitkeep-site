// Checks template files against domain rules 2.1 and 2.3–2.6, and the stricter
// repository checks in section 3 (unknown fields, only <id>.json in the folder).

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { joinKey, readJson } from './json-reader.js';

export const MAX_FILE_BYTES = 262144;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_ID_LENGTH = 40;
const MAX_VERSION = 2147483647;
const MAX_ITEMS = 100;
const REQUIRED_LANGUAGES = ['en', 'ru', 'pl', 'uk'];

const TEMPLATE_FIELDS = ['format', 'id', 'version', 'name', 'description', 'items', 'retired'];
const ITEM_FIELDS = ['id', 'importance', 'name', 'recommendation', 'retired'];

const LIMITS = {
  templateName: 60,
  description: 300,
  itemName: 80,
  recommendation: 200,
};

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function codePointLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function forbiddenReason(codePoint) {
  if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return 'a control character';
  if (codePoint === 0x2028 || codePoint === 0x2029) return 'a line or paragraph separator';
  if (
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    codePoint === 0x061c
  ) {
    return 'a bidirectional control';
  }
  if (codePoint === 0x200b || codePoint === 0x2060 || codePoint === 0xfeff) {
    return 'an invisible character';
  }
  if (codePoint === 0x00ad) return 'a soft hyphen';
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return 'a lone surrogate';
  if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe) {
    return 'a noncharacter';
  }
  if ((codePoint >= 0xe000 && codePoint <= 0xf8ff) || codePoint >= 0xf0000) {
    return 'a private-use character';
  }
  return null;
}

function checkTextValue(text, maxLength, path, problems) {
  if (typeof text !== 'string') {
    if (text !== null) problems.push({ path, message: 'must be a string' });
    return;
  }
  if (text.length < 1 || text.length > maxLength) {
    problems.push({
      path,
      message: `must be 1 to ${maxLength} UTF-16 code units long, but is ${text.length}`,
    });
  }
  if (/^\s|\s$/.test(text)) {
    problems.push({ path, message: 'must not start or end with whitespace' });
  }
  if (/\s\s/.test(text)) {
    problems.push({ path, message: 'must not contain two whitespace characters in a row' });
  }
  if (text.normalize('NFC') !== text) {
    problems.push({ path, message: 'must be in Unicode NFC' });
  }
  const reported = new Set();
  // for...of walks code points, and yields a lone surrogate as its own value.
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    const reason = forbiddenReason(codePoint);
    if (reason !== null && !reported.has(codePoint)) {
      reported.add(codePoint);
      problems.push({
        path,
        message: `contains ${codePointLabel(codePoint)}, ${reason}, which is forbidden`,
      });
    }
  }
  for (const markup of ['{{', '}}', '$t(']) {
    if (text.includes(markup)) {
      problems.push({ path, message: `must not contain "${markup}"` });
    }
  }
}

function isLanguageCode(key) {
  if (key !== key.toLowerCase()) return false;
  try {
    Intl.getCanonicalLocales(key);
    return true;
  } catch {
    return false;
  }
}

function checkText(text, maxLength, path, problems) {
  if (!isObject(text)) {
    if (text !== null) problems.push({ path, message: 'must be an object of language codes' });
    return;
  }
  for (const language of REQUIRED_LANGUAGES) {
    if (!Object.hasOwn(text, language)) {
      problems.push({ path: joinKey(path, language), message: 'this required language is missing' });
    }
  }
  for (const [key, value] of Object.entries(text)) {
    const keyPath = joinKey(path, key);
    if (!isLanguageCode(key)) {
      problems.push({ path: keyPath, message: 'not a lowercase BCP 47 language tag' });
    }
    checkTextValue(value, maxLength, keyPath, problems);
  }
}

function checkId(id, path, problems) {
  if (typeof id !== 'string') {
    if (id !== null) problems.push({ path, message: 'must be a string' });
    return;
  }
  if (!ID_PATTERN.test(id)) {
    problems.push({ path, message: 'must be lowercase kebab-case' });
  }
  if (id.length > MAX_ID_LENGTH) {
    problems.push({ path, message: `must be at most ${MAX_ID_LENGTH} characters long` });
  }
}

function checkRetired(value, path, problems) {
  if (typeof value !== 'boolean' && value !== null) {
    problems.push({ path, message: 'must be true or false' });
  }
}

function checkFields(object, allowed, required, path, problems) {
  for (const key of required) {
    if (!Object.hasOwn(object, key)) {
      problems.push({ path: joinKey(path, key), message: 'this required field is missing' });
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      problems.push({ path: joinKey(path, key), message: 'unknown field' });
    }
  }
}

function checkVersion(version, literal, problems) {
  if (typeof version !== 'number') {
    if (version !== null) problems.push({ path: 'version', message: 'must be a whole number' });
    return;
  }
  if (!/^-?\d+$/.test(literal)) {
    problems.push({
      path: 'version',
      message: `must be written without a decimal point or exponent, but is ${literal}`,
    });
  } else if (version < 1 || version > MAX_VERSION) {
    problems.push({ path: 'version', message: `must be from 1 to ${MAX_VERSION}, but is ${literal}` });
  }
}

function checkItem(item, path, seenIds, problems) {
  if (!isObject(item)) {
    if (item !== null) problems.push({ path, message: 'must be an object' });
    return;
  }
  checkFields(item, ITEM_FIELDS, ['id', 'importance', 'name'], path, problems);
  if (Object.hasOwn(item, 'id')) {
    const idPath = joinKey(path, 'id');
    checkId(item.id, idPath, problems);
    if (seenIds.has(item.id)) {
      problems.push({ path: idPath, message: `the item id "${item.id}" is used more than once` });
    }
    seenIds.add(item.id);
  }
  if (Object.hasOwn(item, 'importance') && item.importance !== null) {
    if (item.importance !== 'essential' && item.importance !== 'optional') {
      problems.push({ path: joinKey(path, 'importance'), message: 'must be "essential" or "optional"' });
    }
  }
  if (Object.hasOwn(item, 'name')) {
    checkText(item.name, LIMITS.itemName, joinKey(path, 'name'), problems);
  }
  if (Object.hasOwn(item, 'recommendation')) {
    checkText(item.recommendation, LIMITS.recommendation, joinKey(path, 'recommendation'), problems);
  }
  if (Object.hasOwn(item, 'retired')) {
    checkRetired(item.retired, joinKey(path, 'retired'), problems);
  }
}

function checkItems(items, problems) {
  if (!Array.isArray(items)) {
    if (items !== null) problems.push({ path: 'items', message: 'must be an array' });
    return;
  }
  if (items.length < 1 || items.length > MAX_ITEMS) {
    problems.push({
      path: 'items',
      message: `must hold 1 to ${MAX_ITEMS} items, retired ones included, but holds ${items.length}`,
    });
  }
  const seenIds = new Set();
  items.forEach((item, index) => checkItem(item, `items[${index}]`, seenIds, problems));
  if (items.length > 0 && items.every((item) => isObject(item) && item.retired === true)) {
    problems.push({ path: 'items', message: 'must hold at least one item that is not retired' });
  }
}

// Checks one template file. `fileName` is its name in the folder, such as
// `winter-car.json`. Returns { problems: [{ path, message }], value }, with
// value undefined if the file can't be read as JSON.
export function validateTemplate(fileName, bytes) {
  const problems = [];
  if (bytes.length > MAX_FILE_BYTES) {
    problems.push({
      path: '',
      message: `the file is ${bytes.length} bytes, over the limit of ${MAX_FILE_BYTES}`,
    });
  }

  const { parsed, value, problems: readProblems, literals } = readJson(bytes);
  problems.push(...readProblems);
  if (!parsed) return { problems };

  if (!isObject(value)) {
    if (value !== null) problems.push({ path: '', message: 'the file must hold a JSON object' });
    return { problems, value };
  }

  const required = ['format', 'id', 'version', 'name', 'description', 'items'];
  checkFields(value, TEMPLATE_FIELDS, required, '', problems);

  if (Object.hasOwn(value, 'format') && value.format !== null && value.format !== 'kitkeep-template') {
    problems.push({ path: 'format', message: 'must be exactly "kitkeep-template"' });
  }
  if (Object.hasOwn(value, 'id')) {
    checkId(value.id, 'id', problems);
    const expected = fileName.replace(/\.json$/, '');
    if (typeof value.id === 'string' && value.id !== expected) {
      problems.push({ path: 'id', message: `must equal the file name "${expected}", but is "${value.id}"` });
    }
  }
  if (Object.hasOwn(value, 'version')) {
    checkVersion(value.version, literals.get('version'), problems);
  }
  if (Object.hasOwn(value, 'name')) {
    checkText(value.name, LIMITS.templateName, 'name', problems);
  }
  if (Object.hasOwn(value, 'description')) {
    checkText(value.description, LIMITS.description, 'description', problems);
  }
  if (Object.hasOwn(value, 'items')) {
    checkItems(value.items, problems);
  }
  if (Object.hasOwn(value, 'retired')) {
    checkRetired(value.retired, 'retired', problems);
  }
  return { problems, value };
}

// Checks a whole templates folder. Returns:
// - problems: [{ file, path, message }], in file order;
// - templates: [{ fileName, bytes, value }] for each file that can be read,
//   sorted by file name in code-point order.
export function validateFolder(folder) {
  let entries;
  try {
    entries = readdirSync(folder);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    return {
      problems: [{ file: folder, path: '', message: 'the templates folder does not exist' }],
      templates: [],
    };
  }

  const problems = [];
  const templates = [];
  // Array.prototype.sort compares UTF-16 code units, which is code-point order
  // for the ASCII names that are allowed here.
  for (const fileName of entries.sort()) {
    const fullPath = join(folder, fileName);
    if (!lstatSync(fullPath).isFile()) {
      problems.push({ file: fileName, path: '', message: 'only <id>.json files are allowed here' });
      continue;
    }
    if (fileName === 'catalog.json') {
      problems.push({
        file: fileName,
        path: '',
        message: 'the catalog is generated by the build and must not be in this folder',
      });
      continue;
    }
    if (!fileName.endsWith('.json')) {
      problems.push({ file: fileName, path: '', message: 'only <id>.json files are allowed here' });
      continue;
    }
    const stem = fileName.slice(0, -'.json'.length);
    if (!ID_PATTERN.test(stem) || stem.length > MAX_ID_LENGTH) {
      problems.push({
        file: fileName,
        path: '',
        message: `the file name must be <id>.json, with a lowercase kebab-case id of at most ${MAX_ID_LENGTH} characters`,
      });
    }
    const bytes = readFileSync(fullPath);
    const result = validateTemplate(fileName, bytes);
    problems.push(...result.problems.map((problem) => ({ file: fileName, ...problem })));
    if (result.value !== undefined) templates.push({ fileName, bytes, value: result.value });
  }
  return { problems, templates };
}

// The reported form: <file>: <JSON path>: <message>. `$` stands for the whole file.
export function formatProblem({ file, path, message }) {
  return `${file}: ${path === '' ? '$' : path}: ${message}`;
}
