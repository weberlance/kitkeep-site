import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WINTER_CAR = join(ROOT, 'templates/v1/winter-car.json');

function runCheck(...args) {
  return spawnSync(process.execPath, ['scripts/check.js', ...args], { cwd: ROOT, encoding: 'utf8' });
}

describe('npm run check', () => {
  let folder;
  beforeEach(() => { folder = mkdtempSync(join(tmpdir(), 'kitkeep-check-')); });
  afterEach(() => { rmSync(folder, { recursive: true, force: true }); });

  it('passes on the repository templates by default', () => {
    const result = runCheck();
    assert.equal(result.status, 0, result.stderr);
  });

  it('passes on a folder of valid templates', () => {
    copyFileSync(WINTER_CAR, join(folder, 'winter-car.json'));
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 template file/);
  });

  it('passes on an empty folder', () => {
    assert.equal(runCheck('--templates', folder).status, 0);
  });

  it('fails on a missing folder', () => {
    const result = runCheck('--templates', join(folder, 'missing'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not exist/);
  });

  it('fails on an unknown option', () => {
    assert.equal(runCheck('--nope').status, 2);
  });

  it('rejects catalog.json', () => {
    writeFileSync(join(folder, 'catalog.json'), '{}');
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /catalog\.json: \$: the catalog is generated/);
  });

  it('rejects a subfolder', () => {
    mkdirSync(join(folder, 'drafts'));
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /drafts: \$: only <id>\.json/);
  });

  it('rejects another kind of file', () => {
    writeFileSync(join(folder, 'notes.txt'), 'x');
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.txt: \$: only <id>\.json/);
  });

  it('rejects a file name that is not a valid id', () => {
    copyFileSync(WINTER_CAR, join(folder, 'Winter_Car.json'));
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Winter_Car\.json: \$: the file name must be <id>\.json/);
  });

  it('reports every problem in every file as <file>: <path>: <message>', () => {
    writeFileSync(join(folder, 'broken.json'), '{ "format": "kitkeep-template", "id": "broken", "version": 3.0 }');
    writeFileSync(join(folder, 'other.json'), '{ "id": "other", "version": 1, "extra": null }');
    const result = runCheck('--templates', folder);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^broken\.json: version: must be written without a decimal point/m);
    assert.match(result.stderr, /^broken\.json: items: this required field is missing/m);
    assert.match(result.stderr, /^other\.json: extra: null is not allowed/m);
    assert.match(result.stderr, /^other\.json: extra: unknown field/m);
    assert.match(result.stderr, /^other\.json: format: this required field is missing/m);
  });
});
