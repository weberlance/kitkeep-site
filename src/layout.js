// The shared page layout: head, header and footer.

export const BASE_PATH = '/kitkeep-site/';

// Every template text goes through this before it reaches a page.
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// `title` is plain text; `main` is already HTML.
export function renderPage({ title, main }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${BASE_PATH}assets/style.css">
</head>
<body>
<header>
<a class="brand" href="${BASE_PATH}">KitKeep</a>
<nav><a href="${BASE_PATH}gallery/">Templates</a></nav>
</header>
<main>
${main}
</main>
<footer>
<p>Templates are suggestions from the KitKeep community, not professional safety advice.</p>
</footer>
</body>
</html>
`;
}
