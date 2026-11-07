import assert from 'node:assert/strict';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sameJson } from '../scripts/base.js';
import { readJson } from '../scripts/json-reader.js';
import { createRepo } from './helpers/git-repo.js';

const FIXTURES = fileURLToPath(new URL('fixtures/base/', import.meta.url));

// Domain rules 2.7 and 3. Each case has a base folder, committed as
// origin/main, and a changed folder, checked against it.
const FAILING = {
  'deleted-template': /^kit\.json: \$: this template is on origin\/main and must not be deleted; set "retired": true/m,
  'removed-item': /^kit\.json: items: item "second-item" is on origin\/main and must not be removed or renamed/m,
  'changed-without-version': /^kit\.json: version: the file differs from origin\/main, so it must be higher than 1$/m,
  'lower-version': /^kit\.json: version: must not be lower than 2, the version on origin\/main$/m,
  'unretired-item': /^kit\.json: items\[1\]\.retired: item "second-item" is retired on origin\/main, and retiring can't be undone$/m,
  'unretired-template': /^kit\.json: retired: the template is retired on origin\/main, and retiring can't be undone$/m,
};
const PASSING = ['reformatted', 'reordered-keys', 'new-template', 'bumped-edit'];

describe('npm run check: changes since origin/main', () => {
  let repo;
  beforeEach(() => { repo = createRepo(); });
  afterEach(() => { repo.remove(); });

  function checkCase(name) {
    repo.setTemplates(join(FIXTURES, name, 'base'));
    repo.commitAsMain();
    repo.setTemplates(join(FIXTURES, name, 'changed'));
    return repo.check();
  }

  for (const [name, expected] of Object.entries(FAILING)) {
    it(`fails: ${name}`, () => {
      const result = checkCase(name);
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, expected);
      // The changed folder meets section 2, so the comparison is the only problem.
      assert.match(result.stderr, /\n1 problem\(s\) found/);
    });
  }

  for (const name of PASSING) {
    it(`passes: ${name}`, () => {
      const result = checkCase(name);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /match the rules for changes since origin\/main/);
    });
  }

  it('fails, without skipping, when the base ref is missing, and says how to fetch it', () => {
    repo.setTemplates(join(FIXTURES, 'new-template', 'changed'));
    const result = repo.check();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^origin\/main: \$: the base ref does not exist.*git fetch origin main/m);
  });

  it('compares with another ref given by --base', () => {
    repo.setTemplates(join(FIXTURES, 'removed-item', 'base'));
    repo.commitAsMain();
    repo.setTemplates(join(FIXTURES, 'removed-item', 'changed'));
    assert.equal(repo.check('--base', 'HEAD').status, 1);
    const named = repo.check('--base', 'origin/other');
    assert.match(named.stderr, /git fetch origin other/);
  });

  it('refuses a base ref that git would read as an option', () => {
    repo.setTemplates();
    repo.commitAsMain();
    const result = repo.check('--base=--output=x');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /the base ref must be a branch, tag or commit/);
  });

  it('reports a missing item and an un-retired one together, in file order', () => {
    repo.setTemplates(join(FIXTURES, 'unretired-item', 'base'));
    repo.commitAsMain();
    copyFileSync(join(FIXTURES, 'unretired-item', 'base', 'kit.json'), join(repo.templates, 'other.json'));
    repo.setTemplates(join(FIXTURES, 'unretired-item', 'changed'));
    writeFileSync(join(repo.templates, 'kit.json'), '{"format":"kitkeep-template","id":"kit","version":3,"name":{"en":"a","ru":"a","pl":"a","uk":"a"},"description":{"en":"a","ru":"a","pl":"a","uk":"a"},"items":[{"id":"second-item","importance":"optional","name":{"en":"a","ru":"a","pl":"a","uk":"a"}}]}');
    const result = repo.check();
    assert.equal(result.status, 1);
    const lines = result.stderr.split('\n').filter((line) => line.startsWith('kit.json'));
    assert.deepEqual(lines, [
      'kit.json: items: item "first-item" is on origin/main and must not be removed or renamed; set "retired": true on it instead',
      'kit.json: items[0].retired: item "second-item" is retired on origin/main, and retiring can\'t be undone',
    ]);
  });
});

describe('sameJson', () => {
  const parse = (text) => readJson(Buffer.from(text)).value;

  it('ignores object key order and whitespace', () => {
    assert.equal(sameJson(parse('{"a":1,"b":{"c":[1,2]}}'), parse('{ "b": { "c": [1, 2] }, "a": 1 }')), true);
  });

  it('keeps array order', () => {
    assert.equal(sameJson(parse('[1,2]'), parse('[2,1]')), false);
  });

  it('tells a missing key, an extra key and a changed value apart from equal', () => {
    assert.equal(sameJson(parse('{"a":1}'), parse('{"a":1,"b":2}')), false);
    assert.equal(sameJson(parse('{"a":1,"b":2}'), parse('{"a":1,"c":2}')), false);
    assert.equal(sameJson(parse('{"a":"x"}'), parse('{"a":"y"}')), false);
    assert.equal(sameJson(parse('{"a":[]}'), parse('{"a":{}}')), false);
  });
});
