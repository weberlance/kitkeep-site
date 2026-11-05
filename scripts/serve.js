// `npm run serve`: previews the built site under /kitkeep-site/, as GitHub Pages does.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { BASE_PATH } from '../src/layout.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function readOptions() {
  try {
    return parseArgs({
      options: {
        out: { type: 'string', default: 'dist' },
        port: { type: 'string', default: '8080' },
      },
    }).values;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

function statOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function send(response, status, text, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  response.end(text);
}

const options = readOptions();
const root = resolve(options.out);

const server = createServer((request, response) => {
  const pathname = request.url.split('?')[0];
  if (pathname === '/') {
    send(response, 302, 'Moved\n', { Location: BASE_PATH });
    return;
  }
  if (!pathname.startsWith(BASE_PATH)) {
    send(response, 404, 'Not found\n');
    return;
  }

  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(BASE_PATH.length));
  } catch {
    send(response, 400, 'Bad request\n');
    return;
  }
  let file = resolve(join(root, relative));
  // Never serve anything outside the output folder.
  if (file !== root && !file.startsWith(root + sep)) {
    send(response, 404, 'Not found\n');
    return;
  }

  let stat = statOrNull(file);
  if (stat?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      send(response, 301, 'Moved\n', { Location: `${pathname}/` });
      return;
    }
    file = join(file, 'index.html');
    stat = statOrNull(file);
  }
  if (!stat?.isFile()) {
    send(response, 404, 'Not found\n');
    return;
  }
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
});

// Local only: this is a preview, not a server to expose.
server.listen(Number(options.port), '127.0.0.1', () => {
  console.log(`Serving ${options.out} at http://127.0.0.1:${server.address().port}${BASE_PATH}`);
});
