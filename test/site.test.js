import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = join(ROOT, 'test/fixtures/site');
const APP_STORE = 'https://apps.apple.com/app/id1';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=x&hl=en';
const FOOTER = 'Templates are suggestions from the KitKeep community, not professional safety advice.';

let work;
let configCount = 0;

function build(storeLinks = {}, templates = FIXTURES) {
  configCount += 1;
  const out = join(work, `out-${configCount}`);
  const config = join(work, `config-${configCount}.json`);
  writeFileSync(config, JSON.stringify({ appStoreUrl: null, googlePlayUrl: null, supportEmail: null, ...storeLinks }));
  const result = spawnSync(
    process.execPath,
    ['scripts/build.js', '--out', out, '--config', config, '--templates', templates],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return out;
}

function allFiles(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function positions(text, ...parts) {
  return parts.map((part) => {
    const index = text.indexOf(part);
    assert.notEqual(index, -1, `"${part}" is on the page`);
    return index;
  });
}

function assertInOrder(text, ...parts) {
  const found = positions(text, ...parts);
  assert.deepEqual(found, [...found].sort((a, b) => a - b), `in order: ${parts}`);
}

function languageBlock(page, language) {
  const match = page.match(new RegExp(`<section lang="${language}">([\\s\\S]*?)</section>`));
  assert.ok(match, `the ${language} block is on the page`);
  return match[1];
}

before(() => { work = mkdtempSync(join(tmpdir(), 'kitkeep-site-')); });
after(() => { rmSync(work, { recursive: true, force: true }); });

describe('the built pages', () => {
  let out;
  const page = (path) => readFileSync(join(out, path), 'utf8');
  before(() => { out = build(); });

  it('writes every page as <path>/index.html', () => {
    for (const path of ['index.html', 'gallery/index.html', 'gallery/winter-car/index.html', 'gallery/retired-kit/index.html']) {
      assert.ok(existsSync(join(out, path)), path);
    }
  });

  it('describes KitKeep on the home page and links to the gallery', () => {
    const home = page('index.html');
    assert.match(home, /emergency/i);
    assert.match(home, /expir/i);
    assert.match(home, /offline/i);
    assert.match(home, /no account/i);
    assert.ok(home.includes('href="/kitkeep-site/gallery/"'));
  });

  it('lists the gallery by English name, with description and item count', () => {
    const gallery = page('gallery/index.html');
    assertInOrder(gallery, 'Alpha &lt;first&gt; kit', 'Multilingual kit', 'Winter car kit');
    assert.ok(gallery.includes('For cold-weather trips'));
    assert.ok(gallery.includes('href="/kitkeep-site/gallery/winter-car/"'));
    assert.ok(gallery.includes('1 item<'));
    assert.ok(gallery.includes('3 items<'));
  });

  it('shows only English in the gallery, and no extra languages', () => {
    const gallery = page('gallery/index.html');
    assert.ok(!gallery.includes('Зимний набор'));
    assert.ok(!gallery.includes('Mehrsprachiges'));
  });

  it('leaves a retired template out of the gallery but keeps its page', () => {
    assert.ok(!page('gallery/index.html').includes('Retired kit'));
    const retired = page('gallery/retired-kit/index.html');
    assert.ok(retired.includes('This template is no longer offered in the app'));
    assert.ok(retired.includes('Old thing'));
  });

  it('shows no retirement notice on a live template', () => {
    assert.ok(!page('gallery/winter-car/index.html').includes('no longer offered'));
  });

  it('hides retired items and counts only the others', () => {
    const winter = page('gallery/winter-car/index.html');
    assert.ok(!winter.includes('Hand warmers'));
    assert.ok(!winter.includes('Грелки'));
    assert.ok(languageBlock(winter, 'en').includes('3 items'));
  });

  it('groups items as Essential then Optional, in file order within each', () => {
    const block = languageBlock(page('gallery/zulu-first/index.html'), 'en');
    assertInOrder(block, 'Essential', 'First essential', 'Second essential', 'Optional', 'Spare rope');
  });

  it('leaves out a group with no items', () => {
    assert.ok(!languageBlock(page('gallery/extra-languages/index.html'), 'en').includes('Optional'));
  });

  it('shows no version and no instructions for finding the template', () => {
    const winter = page('gallery/winter-car/index.html');
    assert.doesNotMatch(winter, /version/i);
    assert.ok(!winter.includes('More templates'));
  });

  it('holds one block per app language, English first', () => {
    const winter = page('gallery/winter-car/index.html');
    assertInOrder(winter, '<section lang="en">', '<section lang="ru">', '<section lang="pl">', '<section lang="uk">');
    assert.ok(languageBlock(winter, 'en').includes('Ice scraper'));
    assert.ok(languageBlock(winter, 'ru').includes('Скребок для льда'));
    assert.ok(languageBlock(winter, 'pl').includes('Skrobaczka do szyb'));
    assert.ok(languageBlock(winter, 'uk').includes('Скребок для льоду'));
    assert.ok(languageBlock(winter, 'ru').includes('1 на каждое место'));
  });

  it('keeps the site\'s own labels in English inside a language block', () => {
    const russian = languageBlock(page('gallery/winter-car/index.html'), 'ru');
    assert.ok(russian.includes('<h2 lang="en">Essential</h2>'));
    assert.ok(russian.includes('<h2 lang="en">Optional</h2>'));
  });

  it('has four language buttons, hidden until the script reveals them', () => {
    const winter = page('gallery/winter-car/index.html');
    assert.ok(winter.includes('<div class="language-switch" hidden>'));
    assertInOrder(winter, '>English</button>', '>Русский</button>', '>Polski</button>', '>Українська</button>');
    assert.ok(winter.includes('<script>'));
  });

  it('shows every block by default, so the page works without JavaScript', () => {
    assert.doesNotMatch(page('gallery/winter-car/index.html'), /<section[^>]*\shidden/);
  });

  it('does not remember the language or put it in the URL', () => {
    const script = page('gallery/winter-car/index.html').match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.doesNotMatch(script, /localStorage|sessionStorage|cookie|location|history/);
  });

  it('does not show extra languages', () => {
    const multi = page('gallery/extra-languages/index.html');
    assert.ok(!multi.includes('Mehrsprachiges'));
    assert.ok(!multi.includes('Taschenlampe'));
    assert.ok(!multi.includes('Kit multilíngue'));
    assert.doesNotMatch(multi, /<section lang="(de|pt-br)">/);
  });

  it('escapes HTML special characters in template texts', () => {
    const zulu = page('gallery/zulu-first/index.html');
    assert.ok(zulu.includes('Alpha &lt;first&gt; kit'));
    assert.ok(zulu.includes('Tom &amp; Jerry&#39;s &quot;light&quot; kit, &lt;5 kg.'));
    assert.ok(zulu.includes('First essential &lt;b&gt;'));
    assert.ok(zulu.includes('Under 5 kg &amp; &quot;dry&quot;'));
    assert.ok(!zulu.includes('<first>'));
    assert.ok(!zulu.includes('First essential <b>'));
    assert.ok(page('gallery/index.html').includes('Alpha &lt;first&gt; kit'));
  });

  it('has the footer on every page', () => {
    const pages = allFiles(out).filter((file) => file.endsWith('.html'));
    assert.equal(pages.length, 6);
    for (const file of pages) {
      assert.ok(readFileSync(file, 'utf8').includes(FOOTER), relative(out, file));
    }
  });

  it('builds every internal link under /kitkeep-site/, and each one exists', () => {
    for (const file of allFiles(out).filter((name) => name.endsWith('.html'))) {
      const html = readFileSync(file, 'utf8');
      for (const [, url] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
        if (/^https:\/\//.test(url)) continue;
        assert.ok(url.startsWith('/kitkeep-site/'), `${relative(out, file)}: ${url}`);
        const target = join(out, url.slice('/kitkeep-site/'.length));
        assert.ok(
          existsSync(url.endsWith('/') ? join(target, 'index.html') : target),
          `${relative(out, file)}: ${url} exists`,
        );
      }
    }
  });

  it('keeps pages out of /templates/', () => {
    const data = readdirSync(join(out, 'templates/v1'));
    assert.deepEqual(data.filter((name) => !name.endsWith('.json')), []);
  });
});

describe('store buttons', () => {
  const pagesWithButtons = ['index.html', 'gallery/winter-car/index.html'];
  const read = (out, path) => readFileSync(join(out, path), 'utf8');

  it('shows none when neither link is set', () => {
    const out = build();
    for (const path of pagesWithButtons) {
      assert.ok(!read(out, path).includes('store-buttons'), path);
      assert.ok(!read(out, path).includes('badges/'), path);
    }
  });

  it('shows only the App Store badge when only its link is set', () => {
    const out = build({ appStoreUrl: APP_STORE });
    for (const path of pagesWithButtons) {
      assert.ok(read(out, path).includes(`href="${APP_STORE}"`), path);
      assert.ok(read(out, path).includes('badges/app-store.svg'), path);
      assert.ok(!read(out, path).includes('badges/google-play.png'), path);
    }
  });

  it('shows only the Google Play badge when only its link is set, with the URL escaped', () => {
    const out = build({ googlePlayUrl: GOOGLE_PLAY });
    for (const path of pagesWithButtons) {
      assert.ok(read(out, path).includes('details?id=x&amp;hl=en"'), path);
      assert.ok(read(out, path).includes('badges/google-play.png'), path);
      assert.ok(!read(out, path).includes('badges/app-store.svg'), path);
    }
  });

  it('shows both when both links are set, and not on the gallery list', () => {
    const out = build({ appStoreUrl: APP_STORE, googlePlayUrl: GOOGLE_PLAY });
    for (const path of pagesWithButtons) {
      assert.ok(read(out, path).includes('badges/app-store.svg'), path);
      assert.ok(read(out, path).includes('badges/google-play.png'), path);
    }
    assert.ok(!read(out, 'gallery/index.html').includes('store-buttons'));
    assert.ok(existsSync(join(out, 'assets/badges/app-store.svg')));
    assert.ok(existsSync(join(out, 'assets/badges/google-play.png')));
  });

  it('fails the build on a store link that is not https', () => {
    const config = join(work, 'bad-config.json');
    writeFileSync(config, JSON.stringify({ appStoreUrl: 'http://example.com', googlePlayUrl: null, supportEmail: null }));
    const result = spawnSync(process.execPath, ['scripts/build.js', '--out', join(work, 'bad'), '--config', config, '--templates', FIXTURES], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /appStoreUrl: must be an https:\/\/ URL or null/);
  });

  it('fails the build on a missing configuration file', () => {
    const result = spawnSync(process.execPath, ['scripts/build.js', '--out', join(work, 'bad'), '--config', join(work, 'nope.json'), '--templates', FIXTURES], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /can't be read/);
  });
});

describe('an empty templates folder', () => {
  it('builds a gallery that says there are no templates', () => {
    const empty = join(work, 'empty');
    mkdirSync(empty);
    const out = build({}, empty);
    assert.ok(readFileSync(join(out, 'gallery/index.html'), 'utf8').includes('No templates yet'));
  });
});

describe('third-party resources', () => {
  // With both store links set, so that every page and badge is included. Only
  // resources are checked: ordinary <a href> links may point anywhere.
  it('loads nothing from another host, in pages, stylesheets or images', () => {
    const out = build({ appStoreUrl: APP_STORE, googlePlayUrl: GOOGLE_PLAY });
    const files = allFiles(out).filter((file) => /\.(html|css|svg)$/.test(file));
    assert.ok(files.some((file) => file.endsWith('.css')));
    assert.ok(files.some((file) => file.endsWith('.svg')));

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const urls = [
        ...[...text.matchAll(/\ssrc=["']([^"']*)["']/g)].map((match) => match[1]),
        ...[...text.matchAll(/<link\b[^>]*\shref=["']([^"']*)["']/g)].map((match) => match[1]),
        ...[...text.matchAll(/url\(\s*["']?([^"')]*)/g)].map((match) => match[1]),
        ...[...text.matchAll(/@import\s+["']([^"']*)/g)].map((match) => match[1]),
      ];
      for (const url of urls) {
        assert.ok(url.startsWith('/kitkeep-site/'), `${relative(out, file)}: ${url}`);
      }
    }
  });

  it('sets no cookies and has no analytics', () => {
    const out = build();
    for (const file of allFiles(out).filter((name) => name.endsWith('.html'))) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /document\.cookie|gtag|analytics/i);
    }
  });
});
