// Compares the templates folder with a base ref, usually origin/main, under
// domain rules 2.7 and 3: released templates and item ids stay, a changed file
// gets a higher version, and retiring can't be undone.

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { isRetired } from './catalog.js';
import { readJson } from './json-reader.js';

function git(args) {
  return spawnSync('git', args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Object key order is ignored and array order is kept, so reformatting a file
// or reordering its keys doesn't need a new version.
export function sameJson(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => sameJson(value, b[index]));
  }
  if (isObject(a) || isObject(b)) {
    if (!isObject(a) || !isObject(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
  }
  return a === b;
}

function fetchHint(base) {
  const match = /^origin\/(.+)$/.exec(base);
  return match ? `git fetch origin ${match[1]}` : `git fetch origin <branch>`;
}

// Reads every .json file in `folder` as it is on `base`. Returns
// { files: Map<fileName, Buffer> } or { problem: { file, path, message } }.
export function readBaseFiles(base, folder) {
  const fail = (message) => ({ problem: { file: base, path: '', message } });
  // A ref starting with "-" would be read by git as an option.
  if (base === '' || base.startsWith('-')) return fail('the base ref must be a branch, tag or commit');

  const verified = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (verified.error) return fail(`git could not be run: ${verified.error.message}`);
  if (verified.status !== 0) {
    return fail(`the base ref does not exist, so the templates can't be compared with it. Fetch it with \`${fetchHint(base)}\`, or pass another ref with --base`);
  }
  const commit = String(verified.stdout).trim();

  // git takes paths relative to the working folder, with "/" on every platform.
  // Both sides are resolved first, because a symlink in either one (such as
  // macOS's /var to /private/var) would otherwise give a path outside the repo.
  const path = relative(realpathSync(process.cwd()), realpathSync(folder)).split(sep).join('/') || '.';
  const listed = git(['ls-tree', '-z', commit, '--', `${path}/`]);
  if (listed.status !== 0) {
    return fail(`git could not list ${path} on the base ref: ${String(listed.stderr).trim()}`);
  }

  const files = new Map();
  for (const entry of String(listed.stdout).split('\0')) {
    if (entry === '') continue;
    const tab = entry.indexOf('\t');
    const [, type] = entry.slice(0, tab).split(' ');
    const entryPath = entry.slice(tab + 1);
    if (type !== 'blob' || !entryPath.endsWith('.json')) continue;
    // ls-tree prints paths relative to the working folder; "./" tells git so.
    const shown = git(['cat-file', 'blob', `${commit}:./${entryPath}`]);
    if (shown.status !== 0) {
      return fail(`git could not read ${entryPath} on the base ref: ${String(shown.stderr).trim()}`);
    }
    files.set(basename(entryPath), shown.stdout);
  }
  return { files };
}

function itemIds(template) {
  if (!Array.isArray(template.items)) return new Map();
  const ids = new Map();
  template.items.forEach((item, index) => {
    if (isObject(item) && typeof item.id === 'string' && !ids.has(item.id)) ids.set(item.id, { item, index });
  });
  return ids;
}

// `templates` are the readable files from validateFolder: [{ fileName, value }].
// Returns problems as [{ file, path, message }]. A template that is new in the
// pull request isn't on the base, so only section 2 applies to it.
export function compareWithBase({ base, baseFiles, folder, templates }) {
  const problems = [];
  const current = new Map(templates.map((template) => [template.fileName, template.value]));

  for (const [fileName, bytes] of [...baseFiles].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const add = (path, message) => problems.push({ file: fileName, path, message });

    if (!existsSync(join(folder, fileName))) {
      add('', `this template is on ${base} and must not be deleted; set "retired": true on it to take it off the site`);
      continue;
    }
    const { parsed, value: before } = readJson(bytes);
    if (!parsed || !isObject(before)) {
      add('', `the file on ${base} can't be read as a template, so it can't be compared`);
      continue;
    }
    const after = current.get(fileName);
    // An unreadable file is already reported by the section 2 checks.
    if (!isObject(after)) continue;

    const afterIds = itemIds(after);
    for (const [id, { item }] of itemIds(before)) {
      const now = afterIds.get(id);
      if (!now) {
        add('items', `item "${id}" is on ${base} and must not be removed or renamed; set "retired": true on it instead`);
      } else if (isRetired(item) && !isRetired(now.item)) {
        add(`items[${now.index}].retired`, `item "${id}" is retired on ${base}, and retiring can't be undone`);
      }
    }
    if (isRetired(before) && !isRetired(after)) {
      add('retired', `the template is retired on ${base}, and retiring can't be undone`);
    }

    if (Number.isInteger(before.version) && Number.isInteger(after.version)) {
      if (after.version < before.version) {
        add('version', `must not be lower than ${before.version}, the version on ${base}`);
      } else if (after.version === before.version && !sameJson(before, after)) {
        add('version', `the file differs from ${base}, so it must be higher than ${before.version}`);
      }
    }
  }
  return problems;
}
