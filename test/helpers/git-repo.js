// A temporary git repository for running `npm run check` against a base ref.
// The user's git configuration is ignored, so signing or hooks set up on the
// machine can't change the result.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

export function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'kitkeep-repo-'));
  const templates = join(dir, 'templates/v1');

  function git(...args) {
    const result = spawnSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout;
  }
  git('init', '-q', '-b', 'main');

  return {
    dir,
    templates,
    // Replaces templates/v1 with the files in `source`, or leaves it empty.
    setTemplates(source) {
      rmSync(templates, { recursive: true, force: true });
      mkdirSync(templates, { recursive: true });
      if (source) cpSync(source, templates, { recursive: true });
    },
    // Commits the working tree and points origin/main at it, as CI's fetch does.
    commitAsMain() {
      git('add', '-A');
      git('commit', '-q', '--allow-empty', '-m', 'base');
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    },
    check(...args) {
      return spawnSync(process.execPath, [join(ROOT, 'scripts/check.js'), ...args], {
        cwd: dir,
        env: ENV,
        encoding: 'utf8',
      });
    },
    remove() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
