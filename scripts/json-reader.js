// A JSON reader that sees the raw text. JSON.parse can't be used here: it hides
// a repeated key, turns `3.0` into `3`, and doesn't report a byte-order mark or
// invalid UTF-8 (domain rules, 2.1, 2.3 and 2.4).

// Deep enough for any template, and it keeps a hostile file from overflowing the stack.
const MAX_DEPTH = 64;

class JsonSyntaxError extends Error {}

export function joinKey(path, key) {
  return path === '' ? key : `${path}.${key}`;
}

// Returns:
// - value: the parsed value, in objects without a prototype so that a key such
//   as `__proto__` is an ordinary key. Undefined if `parsed` is false.
// - parsed: false if the bytes can't be read as JSON at all.
// - problems: [{ path, message }], where path '' means the whole file.
// - literals: a Map from JSON path to the raw text of each number.
export function readJson(bytes) {
  const problems = [];
  const literals = new Map();

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    problems.push({ path: '', message: 'the file is not valid UTF-8' });
    return { parsed: false, problems, literals };
  }

  let start = 0;
  if (text.startsWith('﻿')) {
    problems.push({ path: '', message: 'the file starts with a byte-order mark' });
    start = 1;
  }

  const parser = new Parser(text, start, problems, literals);
  try {
    return { parsed: true, value: parser.readDocument(), problems, literals };
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error;
    problems.push({ path: '', message: error.message });
    return { parsed: false, problems, literals };
  }
}

class Parser {
  constructor(text, start, problems, literals) {
    this.text = text;
    this.pos = start;
    this.problems = problems;
    this.literals = literals;
  }

  readDocument() {
    const value = this.readValue('', 0);
    this.skipWhitespace();
    if (this.pos < this.text.length) this.fail('unexpected text after the JSON value');
    return value;
  }

  fail(message) {
    const before = this.text.slice(0, this.pos);
    const line = before.split('\n').length;
    const column = this.pos - before.lastIndexOf('\n');
    throw new JsonSyntaxError(`invalid JSON at line ${line}, column ${column}: ${message}`);
  }

  skipWhitespace() {
    while (' \t\n\r'.includes(this.text[this.pos] ?? 'x')) this.pos += 1;
  }

  readValue(path, depth) {
    if (depth > MAX_DEPTH) this.fail(`nested more than ${MAX_DEPTH} levels deep`);
    this.skipWhitespace();
    const char = this.text[this.pos];
    if (char === '{') return this.readObject(path, depth);
    if (char === '[') return this.readArray(path, depth);
    if (char === '"') return this.readString();
    if (this.text.startsWith('true', this.pos)) return this.readWord('true', true);
    if (this.text.startsWith('false', this.pos)) return this.readWord('false', false);
    if (this.text.startsWith('null', this.pos)) {
      this.problems.push({ path, message: 'null is not allowed' });
      return this.readWord('null', null);
    }
    return this.readNumber(path);
  }

  readWord(word, value) {
    this.pos += word.length;
    return value;
  }

  readObject(path, depth) {
    const result = Object.create(null);
    this.pos += 1;
    this.skipWhitespace();
    if (this.text[this.pos] === '}') {
      this.pos += 1;
      return result;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text[this.pos] !== '"') this.fail('expected a key in double quotes');
      const key = this.readString();
      const keyPath = joinKey(path, key);
      if (Object.hasOwn(result, key)) {
        this.problems.push({ path: keyPath, message: 'the key is repeated in this object' });
      }
      this.skipWhitespace();
      if (this.text[this.pos] !== ':') this.fail('expected ":" after a key');
      this.pos += 1;
      result[key] = this.readValue(keyPath, depth + 1);
      this.skipWhitespace();
      const next = this.text[this.pos];
      this.pos += 1;
      if (next === '}') return result;
      if (next !== ',') {
        this.pos -= 1;
        this.fail('expected "," or "}" in an object');
      }
    }
  }

  readArray(path, depth) {
    const result = [];
    this.pos += 1;
    this.skipWhitespace();
    if (this.text[this.pos] === ']') {
      this.pos += 1;
      return result;
    }
    for (;;) {
      result.push(this.readValue(`${path}[${result.length}]`, depth + 1));
      this.skipWhitespace();
      const next = this.text[this.pos];
      this.pos += 1;
      if (next === ']') return result;
      if (next !== ',') {
        this.pos -= 1;
        this.fail('expected "," or "]" in an array');
      }
    }
  }

  readString() {
    this.pos += 1;
    let result = '';
    for (;;) {
      const char = this.text[this.pos];
      if (char === undefined) this.fail('the string is not closed');
      if (char === '"') {
        this.pos += 1;
        return result;
      }
      if (char < ' ') this.fail('a control character must be escaped in a string');
      if (char === '\\') {
        result += this.readEscape();
      } else {
        result += char;
        this.pos += 1;
      }
    }
  }

  readEscape() {
    const SIMPLE = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
    const code = this.text[this.pos + 1];
    if (code === 'u') {
      const hex = this.text.slice(this.pos + 2, this.pos + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail('invalid \\u escape');
      this.pos += 6;
      return String.fromCharCode(Number.parseInt(hex, 16));
    }
    if (code === undefined || !Object.hasOwn(SIMPLE, code)) this.fail('invalid escape');
    this.pos += 2;
    return SIMPLE[code];
  }

  readNumber(path) {
    const pattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    pattern.lastIndex = this.pos;
    const match = pattern.exec(this.text);
    if (match === null) this.fail('expected a JSON value');
    this.pos += match[0].length;
    this.literals.set(path, match[0]);
    return Number(match[0]);
  }
}
