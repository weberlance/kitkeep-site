// Reads and checks site.config.json.

import { readFileSync } from 'node:fs';

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Returns { config, problems }, where problems is [{ file, path, message }].
export function loadConfig(file) {
  let config;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { problems: [{ file, path: '', message: `can't be read: ${error.message}` }] };
  }
  const problems = [];
  const fields = ['appStoreUrl', 'googlePlayUrl', 'supportEmail'];
  for (const field of fields) {
    if (!Object.hasOwn(config, field)) {
      problems.push({ file, path: field, message: 'this required field is missing' });
    }
  }
  for (const field of Object.keys(config)) {
    if (!fields.includes(field)) problems.push({ file, path: field, message: 'unknown field' });
  }
  for (const field of ['appStoreUrl', 'googlePlayUrl']) {
    if (config[field] !== null && config[field] !== undefined && !isHttpsUrl(config[field])) {
      problems.push({ file, path: field, message: 'must be an https:// URL or null' });
    }
  }
  const email = config.supportEmail;
  if (email !== null && email !== undefined && !/^[^\s@]+@[^\s@]+$/.test(String(email))) {
    problems.push({ file, path: 'supportEmail', message: 'must be an email address or null' });
  }
  return { config, problems };
}
