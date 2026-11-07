import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRepo } from './helpers/git-repo.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WINTER_CAR = join(ROOT, 'test/fixtures/site/winter-car.json');

// Each test runs in a temporary repository whose origin/main has no templates,
// so only the section 2 and folder rules apply. The comparison with the base
// is tested in base-check.test.js.
describe('npm run check', () => {
  let repo;
  let folder;
  beforeEach(() => {
    repo = createRepo();
    repo.commitAsMain();
    folder = repo.templates;
    repo.setTemplates();
  });
  afterEach(() => { repo.remove(); });

  it('reads templates/v1 in the working folder by default', () => {
    copyFileSync(WINTER_CAR, join(folder, 'winter-car.json'));
    const valid = repo.check();
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /1 template file\(s\) in templates\/v1 are valid/);

    writeFileSync(join(folder, 'notes.txt'), 'x');
    assert.equal(repo.check().status, 1);
  });

  it('passes on a folder of valid templates', () => {
    copyFileSync(WINTER_CAR, join(folder, 'winter-car.json'));
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 template file/);
  });

  it('passes on an empty folder', () => {
    assert.equal(repo.check('--templates', folder).status, 0);
  });

  it('fails on a missing folder', () => {
    const result = repo.check('--templates', join(folder, 'missing'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not exist/);
  });

  it('fails on an unknown option', () => {
    assert.equal(repo.check('--nope').status, 2);
  });

  it('rejects catalog.json', () => {
    writeFileSync(join(folder, 'catalog.json'), '{}');
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /catalog\.json: \$: the catalog is generated/);
  });

  it('rejects a subfolder', () => {
    mkdirSync(join(folder, 'drafts'));
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /drafts: \$: only <id>\.json/);
  });

  it('rejects another kind of file', () => {
    writeFileSync(join(folder, 'notes.txt'), 'x');
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.txt: \$: only <id>\.json/);
  });

  it('rejects a file name that is not a valid id', () => {
    copyFileSync(WINTER_CAR, join(folder, 'Winter_Car.json'));
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Winter_Car\.json: \$: the file name must be <id>\.json/);
  });

  it('reports every problem in every file as <file>: <path>: <message>', () => {
    writeFileSync(join(folder, 'broken.json'), '{ "format": "kitkeep-template", "id": "broken", "version": 3.0 }');
    writeFileSync(join(folder, 'other.json'), '{ "id": "other", "version": 1, "extra": null }');
    const result = repo.check('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^broken\.json: version: must be written without a decimal point/m);
    assert.match(result.stderr, /^broken\.json: items: this required field is missing/m);
    assert.match(result.stderr, /^other\.json: extra: null is not allowed/m);
    assert.match(result.stderr, /^other\.json: extra: unknown field/m);
    assert.match(result.stderr, /^other\.json: format: this required field is missing/m);
  });
});
