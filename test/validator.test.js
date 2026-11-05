import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MAX_FILE_BYTES, validateTemplate } from '../scripts/validator.js';

// The example in domain rules 2.3 is the valid fixture, so the rules and the
// validator can't drift apart. Each case below changes one thing about it.
function domainRulesExample() {
  const rules = readFileSync(new URL('../docs/domain-rules.md', import.meta.url), 'utf8');
  const blocks = [...rules.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);
  const block = blocks.find((text) => text.includes('"kitkeep-template"'));
  assert.ok(block, 'domain rules 2.3 holds a template example');
  return block;
}

const EXAMPLE = domainRulesExample();

function check(text, fileName = 'winter-car.json') {
  return validateTemplate(fileName, Buffer.from(text, 'utf8')).problems;
}

function mutated(change) {
  const template = JSON.parse(EXAMPLE);
  change(template);
  return JSON.stringify(template);
}

function assertValid(text, fileName) {
  assert.deepEqual(check(text, fileName), []);
}

function assertProblem(input, path, messagePart) {
  const problems = Buffer.isBuffer(input)
    ? validateTemplate('winter-car.json', input).problems
    : check(input);
  assert.ok(
    problems.some((problem) => problem.path === path && problem.message.includes(messagePart)),
    `expected "${messagePart}" at "${path}", got ${JSON.stringify(problems)}`,
  );
}

function letters(count) {
  return 'a'.repeat(count);
}

function item(index) {
  return {
    id: `item-${index}`,
    importance: 'optional',
    name: { en: 'Thing', ru: 'Вещь', pl: 'Rzecz', uk: 'Річ' },
  };
}

describe('the domain-rules example', () => {
  it('passes', () => assertValid(EXAMPLE));
});

describe('file size and encoding (2.1)', () => {
  // Pads with whitespace after the JSON, which keeps the content valid.
  const padded = (size) => {
    const bytes = Buffer.alloc(size, ' ');
    Buffer.from(EXAMPLE, 'utf8').copy(bytes);
    return bytes;
  };

  it('accepts a file of exactly the limit', () => {
    assert.equal(MAX_FILE_BYTES, 262144);
    assert.deepEqual(validateTemplate('winter-car.json', padded(262144)).problems, []);
  });
  it('rejects a file one byte over the limit', () => {
    assertProblem(padded(262145), '', 'over the limit');
  });
  it('rejects invalid UTF-8', () => {
    const bytes = Buffer.from(EXAMPLE, 'utf8');
    bytes[bytes.indexOf('Winter')] = 0xff;
    assertProblem(bytes, '', 'not valid UTF-8');
  });
  it('rejects a byte-order mark', () => {
    assertProblem(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(EXAMPLE)]), '', 'byte-order mark');
  });
  it('still reports other problems when there is a byte-order mark', () => {
    const text = mutated((t) => { t.format = 'other'; });
    assertProblem(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]), 'format', 'kitkeep-template');
  });
  it('rejects broken JSON with its position', () => {
    assertProblem('{\n  "format": ,\n}', '', 'line 2, column');
  });
  it('rejects text after the JSON value', () => {
    assertProblem(`${EXAMPLE} {}`, '', 'after the JSON value');
  });
  it('rejects JSON nested too deeply without crashing', () => {
    assertProblem('['.repeat(5000), '', 'levels deep');
  });
  it('rejects a file that is not an object', () => {
    assertProblem('[]', '', 'must hold a JSON object');
  });
});

describe('template fields (2.3)', () => {
  for (const field of ['format', 'id', 'version', 'name', 'description', 'items']) {
    it(`requires ${field}`, () => {
      assertProblem(mutated((t) => { delete t[field]; }), field, 'required field is missing');
    });
  }
  it('rejects another format', () => {
    assertProblem(mutated((t) => { t.format = 'kitkeep-catalog'; }), 'format', 'kitkeep-template');
  });
  it('rejects an id that differs from the file name', () => {
    assertProblem(mutated((t) => { t.id = 'summer-car'; }), 'id', 'must equal the file name');
  });
  it('accepts a retired template', () => {
    assertValid(mutated((t) => { t.retired = true; }));
  });
  it('accepts retired: false', () => {
    assertValid(mutated((t) => { t.retired = false; }));
  });
  it('rejects a retired value that is not a boolean', () => {
    assertProblem(mutated((t) => { t.retired = 'yes'; }), 'retired', 'true or false');
  });
});

describe('version (2.3)', () => {
  const withVersion = (literal) => EXAMPLE.replace('"version": 2', `"version": ${literal}`);

  it('accepts 1 and 2147483647', () => {
    assertValid(withVersion('1'));
    assertValid(withVersion('2147483647'));
  });
  for (const literal of ['3.0', '3e0', '3E0', '0', '-1', '2147483648', '1.5']) {
    it(`rejects ${literal}`, () => assertProblem(withVersion(literal), 'version', 'must be'));
  }
  it('rejects a string', () => {
    assertProblem(withVersion('"3"'), 'version', 'whole number');
  });
});

describe('items (2.3)', () => {
  for (const field of ['id', 'importance', 'name']) {
    it(`requires ${field}`, () => {
      assertProblem(mutated((t) => { delete t.items[0][field]; }), `items[0].${field}`, 'required field is missing');
    });
  }
  it('rejects another importance', () => {
    assertProblem(mutated((t) => { t.items[0].importance = 'critical'; }), 'items[0].importance', 'essential');
  });
  it('rejects a retired value that is not a boolean', () => {
    assertProblem(mutated((t) => { t.items[0].retired = 1; }), 'items[0].retired', 'true or false');
  });
  it('rejects a repeated item id', () => {
    assertProblem(mutated((t) => { t.items[1].id = t.items[0].id; }), 'items[1].id', 'more than once');
  });
  it('rejects an item that is not an object', () => {
    assertProblem(mutated((t) => { t.items[0] = 'scraper'; }), 'items[0]', 'must be an object');
  });
  it('rejects items that are not an array', () => {
    assertProblem(mutated((t) => { t.items = {}; }), 'items', 'must be an array');
  });
  it('rejects no items', () => {
    assertProblem(mutated((t) => { t.items = []; }), 'items', '1 to 100');
  });
  it('accepts 100 items, retired ones included', () => {
    assertValid(mutated((t) => {
      t.items = Array.from({ length: 100 }, (_, index) => ({ ...item(index), retired: index > 0 }));
    }));
  });
  it('rejects 101 items', () => {
    assertProblem(mutated((t) => { t.items = Array.from({ length: 101 }, (_, index) => item(index)); }), 'items', '1 to 100');
  });
  it('rejects every item retired', () => {
    assertProblem(mutated((t) => { for (const entry of t.items) entry.retired = true; }), 'items', 'not retired');
  });
  it('applies text rules to retired items', () => {
    assertProblem(mutated((t) => { t.items[3].name.pl = ' Ogrzewacze'; }), 'items[3].name.pl', 'whitespace');
  });
});

describe('unknown fields (section 3)', () => {
  it('rejects a misspelled field on an item', () => {
    assertProblem(mutated((t) => { t.items[0].recomendation = t.items[1].recommendation; }), 'items[0].recomendation', 'unknown field');
  });
  it('rejects an unknown top-level field', () => {
    assertProblem(mutated((t) => { t.author = 'me'; }), 'author', 'unknown field');
  });
});

describe('JSON rules (2.4)', () => {
  it('rejects null anywhere', () => {
    assertProblem(mutated((t) => { t.items[1].recommendation = null; }), 'items[1].recommendation', 'null is not allowed');
    assertProblem(mutated((t) => { t.name.en = null; }), 'name.en', 'null is not allowed');
    assertProblem(mutated((t) => { t.retired = null; }), 'retired', 'null is not allowed');
  });
  it('rejects a repeated key', () => {
    assertProblem(EXAMPLE.replace('"version": 2,', '"version": 2,\n  "version": 2,'), 'version', 'repeated');
  });
  it('rejects a key repeated through an escape', () => {
    assertProblem(EXAMPLE.replace('"version": 2,', '"version": 2,\n  "\\u0076ersion": 2,'), 'version', 'repeated');
  });
  it('treats __proto__ as an ordinary key', () => {
    assertProblem(EXAMPLE.replace('"version": 2,', '"version": 2,\n  "__proto__": 1,'), '__proto__', 'unknown field');
  });
});

describe('ids (2.5)', () => {
  it('accepts 40 characters', () => {
    assertValid(mutated((t) => { t.items[0].id = letters(40); }));
  });
  it('rejects 41 characters', () => {
    assertProblem(mutated((t) => { t.items[0].id = letters(41); }), 'items[0].id', 'at most 40');
  });
  for (const bad of ['Ice-scraper', 'ice_scraper', '-ice', 'ice-', 'ice--scraper', '']) {
    it(`rejects "${bad}"`, () => {
      assertProblem(mutated((t) => { t.items[0].id = bad; }), 'items[0].id', 'kebab-case');
    });
  }
  it('checks the template id against the rule too', () => {
    assert.ok(check(mutated((t) => { t.id = 'Bad_Id'; }), 'Bad_Id.json').some(
      (problem) => problem.path === 'id' && problem.message.includes('kebab-case'),
    ));
  });
});

describe('languages (2.6)', () => {
  for (const language of ['en', 'ru', 'pl', 'uk']) {
    it(`requires ${language}`, () => {
      assertProblem(mutated((t) => { delete t.description[language]; }), `description.${language}`, 'required language');
    });
  }
  it('accepts extra lowercase BCP 47 tags', () => {
    assertValid(mutated((t) => { t.name.de = 'Winterset'; t.name['pt-br'] = 'Kit de inverno'; }));
  });
  it('rejects a tag that is not lowercase', () => {
    assertProblem(mutated((t) => { t.name['pt-BR'] = 'Kit'; }), 'name.pt-BR', 'lowercase BCP 47');
  });
  it('rejects a key that is not a tag', () => {
    assertProblem(mutated((t) => { t.name.not_a_language = 'x'; }), 'name.not_a_language', 'BCP 47');
  });
  it('applies text rules to extra languages', () => {
    assertProblem(mutated((t) => { t.name.de = ' Winterset'; }), 'name.de', 'whitespace');
  });
  it('rejects a text that is not an object or not a string', () => {
    assertProblem(mutated((t) => { t.name = 'Winter car kit'; }), 'name', 'object of language codes');
    assertProblem(mutated((t) => { t.name.en = 5; }), 'name.en', 'must be a string');
  });
});

describe('lengths (2.6)', () => {
  const cases = [
    ['template name', 60, (t, text) => { t.name.en = text; }, 'name.en'],
    ['description', 300, (t, text) => { t.description.en = text; }, 'description.en'],
    ['item name', 80, (t, text) => { t.items[0].name.en = text; }, 'items[0].name.en'],
    ['recommendation', 200, (t, text) => { t.items[1].recommendation.en = text; }, 'items[1].recommendation.en'],
  ];
  for (const [label, limit, set, path] of cases) {
    it(`accepts a ${label} of ${limit}`, () => {
      assertValid(mutated((t) => set(t, letters(limit))));
    });
    it(`rejects a ${label} of ${limit + 1}`, () => {
      assertProblem(mutated((t) => set(t, letters(limit + 1))), path, `1 to ${limit}`);
    });
    it(`rejects an empty ${label}`, () => {
      assertProblem(mutated((t) => set(t, '')), path, `1 to ${limit}`);
    });
  }
  it('counts an emoji as 2 units', () => {
    assertValid(mutated((t) => { t.name.en = `${letters(58)}🧯`; }));
    assertProblem(mutated((t) => { t.name.en = `${letters(59)}🧯`; }), 'name.en', 'but is 61');
  });
});

describe('whitespace and NFC (2.6)', () => {
  const withEn = (text) => mutated((t) => { t.name.en = text; });

  for (const [label, space] of [['a space', ' '], ['U+00A0', ' '], ['U+3000', '　']]) {
    it(`rejects ${label} at the start and at the end`, () => {
      assertProblem(withEn(`${space}Kit`), 'name.en', 'whitespace');
      assertProblem(withEn(`Kit${space}`), 'name.en', 'whitespace');
    });
    it(`rejects ${label} repeated inside`, () => {
      assertProblem(withEn(`Winter ${space}kit`), 'name.en', 'in a row');
    });
  }
  it('accepts single whitespace inside, including U+00A0', () => {
    assertValid(withEn('Winter car kit'));
  });
  it('rejects a decomposed character', () => {
    assertProblem(withEn('Café'), 'name.en', 'NFC');
  });
  it('accepts the composed form', () => {
    assertValid(withEn('Café'));
  });
});

describe('forbidden characters (2.6)', () => {
  const forbidden = {
    'U+0000': '\u0000', 'U+0009 (tab)': '\u0009', 'U+000A (line break)': '\n', 'U+001F': '\u001F',
    'U+007F': '\u007F', 'U+0085': '\u0085', 'U+009F': '\u009F',
    'U+2028': ' ', 'U+2029': ' ',
    'U+202A': '‪', 'U+202E': '‮', 'U+2066': '⁦', 'U+2069': '⁩',
    'U+200E': '‎', 'U+200F': '‏', 'U+061C': '؜',
    'U+200B': '​', 'U+2060': '⁠', 'U+FEFF': '﻿', 'U+00AD': '­',
    'a lone high surrogate': '\uD800', 'a lone low surrogate': '\uDC00',
    'U+FDD0': '﷐', 'U+FDEF': '﷯', 'U+FFFE': '￾', 'U+FFFF': '￿',
    'U+1FFFE': '\u{1FFFE}', 'U+10FFFF': '\u{10FFFF}',
    'U+E000': '', 'U+F8FF': '', 'U+F0000': '\u{F0000}', 'U+100000': '\u{100000}',
  };
  for (const [label, character] of Object.entries(forbidden)) {
    it(`rejects ${label}`, () => {
      assertProblem(mutated((t) => { t.name.en = `Win${character}ter`; }), 'name.en', 'forbidden');
    });
  }
  it('rejects a lone surrogate written as a JSON escape', () => {
    assertProblem(EXAMPLE.replace('"Winter car kit"', '"Winter \\uD800 kit"'), 'name.en', 'lone surrogate');
  });
  it('allows U+200C, U+200D and emoji sequences', () => {
    assertValid(mutated((t) => { t.name.en = 'a‌b'; t.name.ru = '👩‍🚒'; }));
  });
  it('accepts a real surrogate pair written as JSON escapes', () => {
    assertValid(EXAMPLE.replace('"Winter car kit"', '"Winter \\uD83E\\uDDEF kit"'));
  });
  it('allows the characters just outside the forbidden ranges', () => {
    assertValid(mutated((t) => { t.name.en = '¡¬®﷏ﷰ�'; }));
  });
});

describe('translation markup (2.6)', () => {
  for (const markup of ['{{', '}}', '$t(']) {
    it(`rejects ${markup}`, () => {
      assertProblem(mutated((t) => { t.items[1].recommendation.uk = `a ${markup} b`; }), 'items[1].recommendation.uk', markup);
    });
  }
  it('allows single braces and text that looks like markup', () => {
    assertValid(mutated((t) => { t.name.en = '{a} $t <5 kg *b*'; }));
  });
});

describe('reporting', () => {
  it('reports every problem in a file, not just the first', () => {
    const problems = check(mutated((t) => {
      t.format = 'x';
      t.version = 0;
      t.name.en = ' a';
      t.items[2].name.pl = '';
    }));
    const paths = problems.map((problem) => problem.path);
    for (const path of ['format', 'version', 'name.en', 'items[2].name.pl']) {
      assert.ok(paths.includes(path), `${path} in ${paths}`);
    }
  });
});
