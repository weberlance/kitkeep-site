import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// A raw request, because fetch() would clean up a path such as /../.
function get(port, path) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port, path }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

describe('npm run serve', () => {
  let work;
  let out;
  let server;
  let port;

  before(async () => {
    work = mkdtempSync(join(tmpdir(), 'kitkeep-serve-'));
    out = join(work, 'dist');
    writeFileSync(join(work, 'secret.txt'), 'outside');
    const built = spawnSync(process.execPath, ['scripts/build.js', '--out', out], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(built.status, 0, built.stderr);

    server = spawn(process.execPath, ['scripts/serve.js', '--out', out, '--port', '0'], { cwd: ROOT });
    port = await new Promise((resolve, reject) => {
      server.stdout.on('data', (data) => {
        const match = String(data).match(/127\.0\.0\.1:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
      server.on('exit', () => reject(new Error('the server exited early')));
    });
  });

  after(() => {
    server.removeAllListeners('exit');
    server.kill();
    rmSync(work, { recursive: true, force: true });
  });

  it('serves the home page under the base path', async () => {
    const response = await get(port, '/kitkeep-site/');
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/html/);
  });

  it('serves a template page', async () => {
    const response = await get(port, '/kitkeep-site/gallery/winter-car/');
    assert.equal(response.status, 200);
    assert.match(String(response.body), /Ice scraper/);
  });

  it('serves the data files as JSON, byte for byte', async () => {
    const response = await get(port, '/kitkeep-site/templates/v1/winter-car.json');
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.deepEqual(response.body, readFileSync(join(ROOT, 'templates/v1/winter-car.json')));
  });

  it('redirects a folder without its slash, and / to the base path', async () => {
    const folder = await get(port, '/kitkeep-site/gallery');
    assert.equal(folder.status, 301);
    assert.equal(folder.headers.location, '/kitkeep-site/gallery/');
    const home = await get(port, '/');
    assert.equal(home.status, 302);
    assert.equal(home.headers.location, '/kitkeep-site/');
  });

  it('returns 404 for a missing page and for paths outside the base', async () => {
    assert.equal((await get(port, '/kitkeep-site/gallery/nope/')).status, 404);
    assert.equal((await get(port, '/gallery/')).status, 404);
  });

  it('never serves a file outside the output folder', async () => {
    for (const path of ['/kitkeep-site/../secret.txt', '/kitkeep-site/%2e%2e/secret.txt', '/kitkeep-site/..%2fsecret.txt']) {
      assert.equal((await get(port, path)).status, 404, path);
    }
  });

  it('answers a malformed path with 400', async () => {
    assert.equal((await get(port, '/kitkeep-site/%E0%A4%A')).status, 400);
  });
});
