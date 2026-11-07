// Renders the site's pages (domain rules, section 4).

import { readFileSync } from 'node:fs';
import { BASE_PATH, escapeHtml, renderPage } from '../src/layout.js';
import { isRetired } from './catalog.js';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'uk', label: 'Українська' },
];

// Shows English on load and the chosen block on click. The buttons stay hidden
// without JavaScript, when all four blocks are shown.
const LANGUAGE_SCRIPT = `<script>
(function () {
  var sections = document.querySelectorAll('section[lang]');
  var buttons = document.querySelectorAll('.language-switch button');
  function show(language) {
    sections.forEach(function (section) { section.hidden = section.lang !== language; });
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () { show(button.dataset.language); });
  });
  document.querySelector('.language-switch').hidden = false;
  show('en');
})();
</script>`;

function storeButtons(config) {
  const buttons = [];
  if (config.appStoreUrl !== null) {
    buttons.push(`<a href="${escapeHtml(config.appStoreUrl)}"><img src="${BASE_PATH}assets/badges/app-store.svg" alt="Download on the App Store"></a>`);
  }
  if (config.googlePlayUrl !== null) {
    buttons.push(`<a href="${escapeHtml(config.googlePlayUrl)}"><img class="google-play" src="${BASE_PATH}assets/badges/google-play.png" alt="Get it on Google Play"></a>`);
  }
  return buttons.length === 0 ? '' : `<div class="store-buttons">${buttons.join('')}</div>`;
}

function itemCountText(count) {
  return count === 1 ? '1 item' : `${count} items`;
}

function activeItems(template) {
  return template.items.filter((item) => !isRetired(item));
}

function homePage(config) {
  return renderPage({
    title: 'KitKeep',
    main: `<h1>Keep your emergency kits ready</h1>
<p>KitKeep helps you put together and look after emergency backpacks and other kits: what to pack, what's already packed, and when each thing expires.</p>
<ul>
<li>Start a kit from a template.</li>
<li>Track expiry dates, with reminders on your phone.</li>
<li>Works offline, with no account. Your kits stay on your phone.</li>
</ul>
${storeButtons(config)}
<p><a href="${BASE_PATH}gallery/">Browse the kit templates</a></p>`,
  });
}

function galleryPage(templates) {
  const collator = new Intl.Collator('en');
  const listed = templates
    .filter((template) => !isRetired(template))
    .sort((a, b) => collator.compare(a.name.en, b.name.en) || (a.id < b.id ? -1 : 1));

  const list = listed.map((template) => `<li>
<h2><a href="${BASE_PATH}gallery/${escapeHtml(template.id)}/">${escapeHtml(template.name.en)}</a></h2>
<p>${escapeHtml(template.description.en)}</p>
<p class="muted">${itemCountText(activeItems(template).length)}</p>
</li>`);

  return renderPage({
    title: 'Templates - KitKeep',
    main: `<h1>Templates</h1>
<p>Extra kit templates you can add in the KitKeep app.</p>
${listed.length === 0 ? '<p>No templates yet.</p>' : `<ul class="template-list">\n${list.join('\n')}\n</ul>`}`,
  });
}

function itemGroup(label, items, language) {
  if (items.length === 0) return '';
  const entries = items.map((item) => {
    const recommendation = item.recommendation === undefined
      ? ''
      : `<span class="item-recommendation">${escapeHtml(item.recommendation[language])}</span>`;
    return `<li><span class="item-name">${escapeHtml(item.name[language])}</span>${recommendation}</li>`;
  });
  return `<h2 lang="en">${label}</h2>\n<ul class="item-list">\n${entries.join('\n')}\n</ul>`;
}

function languageBlock(template, language) {
  const items = activeItems(template);
  return `<section lang="${language}">
<h1>${escapeHtml(template.name[language])}</h1>
<p>${escapeHtml(template.description[language])}</p>
<p class="muted" lang="en">${itemCountText(items.length)}</p>
${itemGroup('Essential', items.filter((item) => item.importance === 'essential'), language)}
${itemGroup('Optional', items.filter((item) => item.importance === 'optional'), language)}
</section>`;
}

function templatePage(template, config) {
  const buttons = LANGUAGES
    .map(({ code, label }) => `<button type="button" lang="${code}" data-language="${code}">${label}</button>`)
    .join('');
  const notice = isRetired(template)
    ? '<p class="notice">This template is no longer offered in the app</p>\n'
    : '';
  const blocks = LANGUAGES.map(({ code }) => languageBlock(template, code)).join('\n');
  return renderPage({
    title: `${template.name.en} - KitKeep`,
    main: `${notice}<div class="language-switch" hidden>${buttons}</div>
${blocks}
${storeButtons(config)}
${LANGUAGE_SCRIPT}`,
  });
}

const TEXT_PAGES = [
  { source: 'privacy.html', path: 'privacy/index.html' },
  { source: 'support.html', path: 'support/index.html' },
];

// Renders the hand-written pages in src/pages. Each starts with a plain-text
// <h1>, which also gives the page title. `{{supportEmail}}` is the only
// placeholder, and it needs supportEmail set in the site configuration.
// Returns { pages: [{ path, html }], problems: [{ file, path, message }] }.
export function renderTextPages(config) {
  const pages = [];
  const problems = [];
  for (const { source, path } of TEXT_PAGES) {
    const file = `src/pages/${source}`;
    const content = readFileSync(new URL(`../src/pages/${source}`, import.meta.url), 'utf8');
    const add = (message) => {
      if (!problems.some((problem) => problem.file === file && problem.message === message)) {
        problems.push({ file, path: '', message });
      }
    };
    const heading = /^<h1>([^<]+)<\/h1>/.exec(content);
    if (!heading) add('must start with a plain-text <h1>, which gives the page title');
    const main = content.trim().replace(/\{\{\s*([^}]*?)\s*\}\}/g, (placeholder, name) => {
      if (name !== 'supportEmail') {
        add(`uses the unknown placeholder ${placeholder}`);
      } else if (config.supportEmail === null) {
        add('uses {{supportEmail}}, but supportEmail is null in the site configuration');
      } else {
        return escapeHtml(config.supportEmail);
      }
      return placeholder;
    });
    if (heading) pages.push({ path, html: renderPage({ title: `${heading[1]} - KitKeep`, main }) });
  }
  return { pages, problems };
}

// `templates` holds the parsed template objects, retired ones included.
// Returns [{ path, html }], with each path relative to the output folder.
export function renderSite(templates, config) {
  return [
    { path: 'index.html', html: homePage(config) },
    { path: 'gallery/index.html', html: galleryPage(templates) },
    ...templates.map((template) => ({
      path: `gallery/${template.id}/index.html`,
      html: templatePage(template, config),
    })),
  ];
}
