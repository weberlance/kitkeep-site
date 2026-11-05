import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Pipeline security from domain rules, section 3. The address in 2.1 is built
// into the app and the catalog isn't signed, so these must not quietly regress.
function workflow(name) {
  return readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
}

const NAMES = ['checks.yml', 'publish.yml'];

describe('GitHub workflows', () => {
  for (const name of NAMES) {
    it(`${name} pins every action to a full commit SHA, with the version in a comment`, () => {
      const uses = [...workflow(name).matchAll(/uses:\s*(.+)/g)].map((match) => match[1]);
      assert.ok(uses.length > 0);
      for (const use of uses) {
        assert.match(use, /^[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
      }
    });

    it(`${name} uses no secrets and runs the Validation Commands in order`, () => {
      const text = workflow(name);
      assert.doesNotMatch(text, /secrets\./);
      const commands = [...text.matchAll(/- run: (.+)/g)].map((match) => match[1]);
      assert.deepEqual(commands, ['npm ci', 'npm test', 'npm run check', 'npm run build']);
    });

    it(`${name} takes the Node version from .nvmrc`, () => {
      assert.match(workflow(name), /node-version-file: \.nvmrc/);
    });
  }

  it('checks.yml runs on pull_request with a read-only token', () => {
    const text = workflow('checks.yml');
    assert.doesNotMatch(text, /pull_request_target/);
    assert.match(text, /^on:\n {2}pull_request:/m);
    assert.match(text, /^permissions:\n {2}contents: read\n\n/m);
  });

  it('publish.yml deploys through github-pages, one at a time, with only the permissions it needs', () => {
    const text = workflow('publish.yml');
    assert.match(text, /branches: \[main\]/);
    assert.match(text, /^permissions:\n {2}contents: read\n\n/m);
    assert.match(text, /permissions:\n {6}pages: write\n {6}id-token: write\n/);
    assert.match(text, /name: github-pages/);
    assert.match(text, /concurrency:\n {2}group: pages\n {2}cancel-in-progress: false/);
    assert.match(text, /path: dist/);
  });
});
