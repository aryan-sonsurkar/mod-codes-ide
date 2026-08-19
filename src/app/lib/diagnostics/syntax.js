const DELIMITERS = {
  "(": { close: ")", key: "paren" },
  "[": { close: "]", key: "bracket" },
  "{": { close: "}", key: "brace" },
};

const CLOSERS = {
  ")": "(",
  "]": "[",
  "}": "{",
};

const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "await",
  "yield",
  "do",
  "else",
]);

function isRegexStart(content, index) {
  let cursor = index - 1;

  while (cursor >= 0 && /[ \t\r\n]/.test(content[cursor])) {
    cursor -= 1;
  }

  if (cursor < 0) {
    return true;
  }

  const previous = content[cursor];

  if (/[A-Za-z0-9_$)\]}"'`]/.test(previous)) {
    let start = cursor;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(content[start])) {
      start -= 1;
    }
    const word = content.slice(start + 1, cursor + 1);
    return REGEX_PRECEDING_KEYWORDS.has(word);
  }

  return true;
}

function skipRegex(content, index) {
  let cursor = index + 1;
  let inClass = false;

  while (cursor < content.length) {
    const c = content[cursor];

    if (c === "\\") {
      cursor += 2;
      continue;
    }

    if (c === "[") {
      inClass = true;
      cursor += 1;
      continue;
    }

    if (c === "]") {
      inClass = false;
      cursor += 1;
      continue;
    }

    if (c === "/" && !inClass) {
      return cursor;
    }

    cursor += 1;
  }

  return content.length - 1;
}

export function scanSyntax(content) {
  const lines = content.split("\n");
  const depths = {
    paren: new Array(lines.length).fill(0),
    bracket: new Array(lines.length).fill(0),
    brace: new Array(lines.length).fill(0),
  };
  const unexpectedClosers = [];
  const openRemainders = [];
  const counters = { paren: 0, bracket: 0, brace: 0 };

  let line = 0;
  let column = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;

  const recordDepth = () => {
    depths.paren[line] = counters.paren;
    depths.bracket[line] = counters.bracket;
    depths.brace[line] = counters.brace;
  };

  recordDepth();

  for (let i = 0; i < content.length; i += 1) {
    const c = content[i];
    const next = content[i + 1];

    if (c === "\n") {
      line += 1;
      column = 0;
      inLineComment = false;
      recordDepth();
      continue;
    }

    column += 1;

    if (inLineComment) {
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
        column += 1;
      }
      continue;
    }

    if (inString) {
      if (c === "\\") {
        i += 1;
        column += 1;
        continue;
      }
      if (c === inString) {
        inString = null;
      }
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      column += 1;
      continue;
    }

    if (c === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      column += 1;
      continue;
    }

    if (c === "/" && next !== "/" && next !== "*") {
      if (isRegexStart(content, i)) {
        const end = skipRegex(content, i);
        const literal = content.slice(i, end + 1);
        const parts = literal.split("\n");

        if (parts.length > 1) {
          line += parts.length - 1;
          column = parts[parts.length - 1].length;
        } else {
          column += end - i;
        }

        i = end;
        continue;
      }
    }

    if (c === '"' || c === "'" || c === "`") {
      inString = c;
      continue;
    }

    if (DELIMITERS[c]) {
      counters[DELIMITERS[c].key] += 1;
      recordDepth();
      continue;
    }

    if (CLOSERS[c]) {
      const open = CLOSERS[c];
      const key = DELIMITERS[open].key;
      if (counters[key] <= 0) {
        unexpectedClosers.push({ char: c, line: line + 1, column });
      } else {
        counters[key] -= 1;
        recordDepth();
      }
      continue;
    }
  }

  recordDepth();

  for (const openChar of ["(", "[", "{"]) {
    const info = DELIMITERS[openChar];
    if (counters[info.key] > 0) {
      openRemainders.push({
        open: openChar,
        close: info.close,
        count: counters[info.key],
      });
    }
  }

  return {
    lineCount: lines.length,
    braceDepths: depths.brace,
    parenDepths: depths.paren,
    bracketDepths: depths.bracket,
    unexpectedClosers,
    openRemainders,
  };
}