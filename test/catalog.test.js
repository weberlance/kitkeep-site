import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCatalog } from '../scripts/catalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE_FIXTURES = join(ROOT, 'test/fixtures/site');

function texts(text) {
  return { en: text, ru: text, pl: text, uk: text };
}

function template(id, change = () => {}) {
  const result = {
    format: 'kitkeep-template',
    id,
    version: 1,
    name: texts('Name'),
    description: texts('Description'),
    items: [{ id: 'thing', importance: 'essential', name: texts('Thing') }],
  };
  change(result);
  return result;
}

describe('npm run build: the catalog', () => {
  let work;
  let source;
  let out;

  function build(...args) {
    return spawnSync(process.execPath, ['scripts/build.js', '--out', out, ...args], { cwd: ROOT, encoding: 'utf8' });
  }
  function buildFrom(...files) {
    for (const file of files) {
      writeFileSync(join(source, `${file.id}.json`), JSON.stringify(file));
    }
    const result = build('--templates', source);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(readFileSync(join(out, 'templates/v1/catalog.json'), 'utf8'));
  }

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'kitkeep-build-'));
    source = join(work, 'source');
    out = join(work, 'out');
    mkdirSync(source);
  });
  afterEach(() => { rmSync(work, { recursive: true, force: true }); });

  it('matches the expected file exactly for the test fixtures', () => {
    const result = build('--templates', SITE_FIXTURES);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      readFileSync(join(out, 'templates/v1/catalog.json')),
      readFileSync(join(ROOT, 'test/fixtures/site-catalog.expected.json')),
    );
  });

  it('is valid and empty for an empty folder', () => {
    assert.deepEqual(buildFrom(), { format: 'kitkeep-catalog', templates: [] });
    assert.equal(readFileSync(join(out, 'templates/v1/catalog.json'), 'utf8').endsWith('}\n'), true);
  });

  it('leaves out a retired template but still publishes its file', () => {
    const catalog = buildFrom(template('kept'), template('gone', (t) => { t.retired = true; }));
    assert.deepEqual(catalog.templates.map((entry) => entry.id), ['kept']);
    assert.ok(existsSync(join(out, 'templates/v1/gone.json')));
  });

  it('does not count a retired item', () => {
    const catalog = buildFrom(template('kit', (t) => {
      t.items.push({ id: 'old', importance: 'optional', retired: true, name: texts('Old') });
    }));
    assert.equal(catalog.templates[0].itemCount, 1);
  });

  it('sorts by id, not by file name or name', () => {
    // `a-b.json` sorts before `a.json`, but the id `a` sorts before `a-b`.
    const catalog = buildFrom(
      template('b', (t) => { t.name = texts('A'); }),
      template('a-b'),
      template('a'),
      template('a1'),
    );
    assert.deepEqual(catalog.templates.map((entry) => entry.id), ['a', 'a-b', 'a1', 'b']);
  });

  it('copies extra languages in the order of the file', () => {
    const catalog = buildFrom(template('kit', (t) => {
      t.name = { de: 'Set', en: 'Kit', ru: 'Набор', pl: 'Zestaw', 'pt-br': 'Conjunto', uk: 'Набір' };
    }));
    assert.deepEqual(Object.keys(catalog.templates[0].name), ['de', 'en', 'ru', 'pl', 'pt-br', 'uk']);
  });

  it('writes the entry keys in the fixed order', () => {
    const catalog = buildFrom(template('kit'));
    assert.deepEqual(Object.keys(catalog), ['format', 'templates']);
    assert.deepEqual(Object.keys(catalog.templates[0]), ['id', 'version', 'itemCount', 'name', 'description']);
  });

  it('fails when the catalog is too large, and writes nothing', () => {
    const long = 'я'.repeat(300);
    for (let index = 0; index < 120; index += 1) {
      const file = template(`kit-${index}`, (t) => { t.description = texts(long); });
      writeFileSync(join(source, `${file.id}.json`), JSON.stringify(file));
    }
    const result = build('--templates', source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^catalog\.json: \$: the catalog is \d+ bytes, over the limit of 262144/m);
    assert.equal(existsSync(out), false);
  });

  it('copies each template byte for byte, whatever its formatting', () => {
    const text = `\r\n  ${JSON.stringify(template('kit'), null, 1).replaceAll('\n', '\r\n')}   \n\n`;
    writeFileSync(join(source, 'kit.json'), text);
    assert.equal(build('--templates', source).status, 0);
    assert.deepEqual(readFileSync(join(out, 'templates/v1/kit.json')), Buffer.from(text));
  });

  it('copies each fixture byte for byte', () => {
    assert.equal(build('--templates', SITE_FIXTURES).status, 0);
    for (const fileName of readdirSync(SITE_FIXTURES)) {
      assert.deepEqual(
        readFileSync(join(out, 'templates/v1', fileName)),
        readFileSync(join(SITE_FIXTURES, fileName)),
        fileName,
      );
    }
  });

  it('fails on an invalid template, and writes nothing', () => {
    writeFileSync(join(source, 'kit.json'), JSON.stringify(template('other')));
    const result = build('--templates', source);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^kit\.json: id: must equal the file name/m);
    assert.equal(existsSync(out), false);
  });

  it('fails on a missing templates folder', () => {
    const result = build('--templates', join(work, 'missing'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not exist/);
  });

  it('removes files from an earlier build', () => {
    buildFrom(template('old-kit'));
    rmSync(join(source, 'old-kit.json'));
    buildFrom(template('new-kit'));
    assert.deepEqual(readdirSync(join(out, 'templates/v1')).sort(), ['catalog.json', 'new-kit.json']);
  });
});

describe('checkCatalog (2.2)', () => {
  const entry = (id, itemCount = 1) => ({ id, version: 1, itemCount, name: {}, description: {} });
  const catalog = (entries, format = 'kitkeep-catalog') => JSON.stringify({ format, templates: entries });
  const paths = (text) => checkCatalog(text).map((problem) => problem.path);

  it('accepts a sorted catalog', () => {
    assert.deepEqual(checkCatalog(catalog([entry('a'), entry('b')])), []);
  });
  it('rejects another format', () => {
    assert.deepEqual(paths(catalog([], 'other')), ['format']);
  });
  it('rejects entries out of order', () => {
    assert.deepEqual(paths(catalog([entry('b'), entry('a')])), ['templates[1].id']);
  });
  it('rejects a duplicate id', () => {
    assert.deepEqual(paths(catalog([entry('a'), entry('a')])), ['templates[1].id']);
  });
  it('rejects an itemCount of 0', () => {
    assert.deepEqual(paths(catalog([entry('a', 0)])), ['templates[0].itemCount']);
  });
  it('rejects a missing field', () => {
    const { name, ...incomplete } = entry('a');
    assert.deepEqual(paths(catalog([incomplete])), ['templates[0].name']);
  });
});
