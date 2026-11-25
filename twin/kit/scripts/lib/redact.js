'use strict';
/*
 * lib/redact.js: replace secrets and email addresses with [redacted] before anything is
 * written or printed. It is a pattern list, so a shape that is not on it is not
 * redacted; templates/formats.md says so, and asks you not to paste secrets.
 *
 * Hidden characters (control characters: U+0000-U+001F other than tab, line feed and
 * carriage return, and U+007F-U+009F; and every default-ignorable code point: zero-width
 * space, joiners, the word joiner, the soft hyphen, the byte-order mark, bidi controls,
 * variation selectors and the rest) can neither split a secret nor hide where one starts.
 * A text that holds one is redacted in three steps (JSON Web Tokens are first read
 * through the hidden characters and redacted whole): the rules run with the hidden
 * characters in place (where they mark the start of a name or a token, as in
 * x<U+200B>ghp_...); a redacted part that a hidden character touches takes the rest of
 * that word with it (the character may have split a secret whose first part was found);
 * then the hidden characters are removed and the rules run again (so
 * password=alpha<U+0001>bravo and pass<U+200B>word=alpha are redacted whole). The output
 * holds no hidden character. Callers redact before any tidying that turns a character
 * into a space, and again after it.
 *
 * Shapes, in the order they run:
 *   pem          private-key blocks (an unterminated BEGIN line redacts the rest of the
 *                 text); found by a linear scan, and the block keeps its line count
 *   url-password  the password in scheme://user:<password>@host (user and host stay; the
 *                 user runs to the first colon and may hold an @, the password to the last @)
 *   auth-header   everything after the colon (or =) of an Authorization header, to the
 *                 end of the line, whatever the scheme (Basic, Bearer, Digest, Custom...);
 *                 found by a linear scan
 *   basic         a Basic value of base64 characters, 4 or more with its padding, whose
 *                 decoded bytes hold a colon (user:pass, such as YTpi or Yjphamph), whatever
 *                 its length or its other bytes; or 6 or more that look encoded (a digit,
 *                 + / =, or a capital after the first letter); a value that stays is read
 *                 again as the word basic (a basic Basic <value>)
 *   bearer        a Bearer value of 8 or more characters
 *   jwt           eyJ header, a payload of 2 or more characters (e30 included) and the
 *                 signature; found by a linear scan, also through hidden characters
 *   sk-key, github-token, github-pat, aws-key-id, slack-token, google-key
 *   assignment    a password, secret, token, API key, credential or private/access key
 *                 assigned with = : := or =>, to a value of any length. An unquoted value
 *                 runs to the end of the line or to , ; & ) } ] (through any quote mark
 *                 or backtick, as in password: alpha"bravo, and through a marker an
 *                 earlier rule left, as in password=https://u:[redacted]@host); for
 *                 name=value with no
 *                 space after the =, to the next space or tab too, as in a shell (still
 *                 through quote marks: password=alpha"bravo). A quoted value (on its
 *                 line) is redacted whole, spaces included, and keeps its quotes; when
 *                 more of the value follows the closing quote with no space between
 *                 (password: "alpha"bravo, password="alpha"bravo), the quoted part and
 *                 that rest are redacted together, the rest ending by the same rule
 *   aws-secret    a 40-character base64 run near "aws" or "secret", or one that mixes
 *                 upper case, lower case and digits
 *   email         addresses: a local part of letters, digits, marks and every RFC 5322
 *                 atom character (! # $ % & ' * + / = ? ^ _ ` { | } ~ - and the dot), or
 *                 a quoted local part with backslash escapes (whatever comes before its
 *                 opening quote, a slash included); Unicode domains, punycode
 *                 top-level domains and IP-literal domains (name@1.2.3, pkg@latest,
 *                 user@localhost and @scope/name stay, and an address right after one
 *                 of them is still found: pkg@latest/alice@example.com); an unquoted
 *                 local part holds no hidden character
 *   long-run      a run of 41 or more base64 or hex characters that looks like a key (no
 *                 separator, or a digit and a part of 16 or more characters); a long path
 *                 or a hyphenated name stays
 *
 * Every rule is linear in the length of the text (no pattern backtracks over its own
 * output), so a hostile text up to the 1 MB input limit cannot stall a script.
 *
 * There is no shortcut for text that already holds the marker: a value that starts with
 * [redacted] is redacted whole again, so a planted marker cannot shield what follows it.
 * Text is always redacted before it is tidied or cut to length (excerpt, clip), so neither
 * can split a secret into a shape the rules no longer see; clip redacts again after it
 * collapses white space, so a collapse cannot join a name and its value either.
 */

const REDACTED = '[redacted]';

const keepLines = (s) => REDACTED + '\n'.repeat((s.match(/\n/g) || []).length);

// ------------------------------------------------------------------ private-key blocks

const PEM_BEGIN = /-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----/g;
const PEM_END = /-----END [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----/g;

// One pass: each BEGIN looks for the next END once; without one, the rest is redacted.
function redactPem(text) {
  let out = '';
  let at = 0;
  PEM_BEGIN.lastIndex = 0;
  for (;;) {
    const b = PEM_BEGIN.exec(text);
    if (!b) break;
    PEM_END.lastIndex = PEM_BEGIN.lastIndex;
    const e = PEM_END.exec(text);
    const stop = e ? PEM_END.lastIndex : text.length;
    out += text.slice(at, b.index) + keepLines(text.slice(b.index, stop));
    at = stop;
    if (!e) break;
    PEM_BEGIN.lastIndex = stop;
  }
  return at === 0 ? text : out + text.slice(at);
}

// ------------------------------------------------------------------ assignments

// The name parts that mark a secret (a name is split at _ . - and at a lower-to-upper
// change, so DB_PASSWORD, githubToken, client-secret and apiKey all count).
const SECRET_PARTS = new Set(['password', 'passwd', 'passphrase', 'secret', 'secrets', 'token', 'tokens', 'apikey', 'credential', 'credentials', 'pat']);
const KEY_AFTER = new Set(['api', 'private', 'access', 'secret', 'signing', 'encryption', 'client', 'master', 'auth']);

function secretName(name) {
  if (!/pass|secret|token|key|cred|pat/i.test(name)) return false;
  const parts = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_.-]+/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    if (SECRET_PARTS.has(parts[i])) return true;
    if (parts[i] === 'key' && i > 0 && KEY_AFTER.has(parts[i - 1])) return true;
    if (/^(?:apikey|privatekey|accesskey|secretkey)$/.test(parts[i])) return true;
  }
  return false;
}

// A name (a maximal run: the lookbehind keeps it from starting mid-run), an optional
// closing quote, then the = or : sign (or := or =>).
const ASSIGN = /(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+)(["'`]?)([ \t]*)(=>|:=|=|:)([ \t]*)/g;
const QUOTES = '"\'`';
// name: value and name = value run to the end of the line, through quote marks;
// name=value (one word, as in a shell) also stops at a space or a tab, still through
// quote marks. Both stop at these.
const STOP = ',;&)}]\n\r';

function redactAssignments(text) {
  const n = text.length;
  let out = '';
  let at = 0;
  ASSIGN.lastIndex = 0;
  for (;;) {
    const m = ASSIGN.exec(text);
    if (!m) break;
    if (!secretName(m[1])) {
      ASSIGN.lastIndex = m.index + m[1].length;
      continue;
    }
    let p = ASSIGN.lastIndex;
    out += text.slice(at, p);
    // name=value with nothing between: one word, as in a shell (PASSWORD=x npm start).
    // name: value, or name = value: the rest of the line, as in YAML or prose.
    const oneWord = m[4] !== ':' && m[5] === '';
    // Where an unquoted value that starts at i ends. A marker anywhere in the value, planted
    // or put there by an earlier rule (password=https://u:[redacted]@host), is part of the
    // value: its closing bracket is not a stop.
    const valueEnd = (i) => {
      while (i < n) {
        if (text.startsWith(REDACTED, i)) {
          i += REDACTED.length;
          continue;
        }
        if (STOP.includes(text[i]) || (oneWord && (text[i] === ' ' || text[i] === '\t'))) break;
        i++;
      }
      return i;
    };
    // Trailing spaces stay outside the redaction.
    const trimmed = (from, i) => {
      let j = i;
      while (j > from && (text[j - 1] === ' ' || text[j - 1] === '\t')) j--;
      return j;
    };
    if (p < n && QUOTES.includes(text[p])) {
      // A quoted value: up to the matching quote on the same line (a backslash escapes it).
      const q = text[p];
      let i = p + 1;
      while (i < n && text[i] !== q && text[i] !== '\n' && text[i] !== '\r') i += text[i] === '\\' ? 2 : 1;
      const closed = i < n && text[i] === q;
      const value = text.slice(p + 1, Math.min(i, n));
      const after = closed ? i + 1 : Math.min(i, n);
      // More of the value right after the closing quote, with no space between
      // (password: "alpha"bravo): the quoted part and the rest are redacted together, the
      // rest ending as an unquoted value does. Text after a space stays (a quoted value
      // followed by prose: secret: "a b" was set).
      const glued = closed && after < n && text[after] !== ' ' && text[after] !== '\t';
      const e = glued ? valueEnd(after) : after;
      const k = trimmed(after, e);
      if (k > after) {
        out += REDACTED + text.slice(k, e);
        p = e;
      } else {
        out += value ? `${q}${REDACTED}${closed ? q : ''}` : text.slice(p, after);
        p = after;
      }
    } else {
      const i = valueEnd(p);
      const j = trimmed(p, i);
      // A value that starts with the marker is redacted whole too: no shortcut.
      const value = text.slice(p, j);
      if (value) out += REDACTED + text.slice(j, i);
      else out += text.slice(p, i);
      p = i;
    }
    at = p;
    ASSIGN.lastIndex = p;
  }
  return at === 0 ? text : out + text.slice(at);
}

// ------------------------------------------------------------------ emails

// The local part: letters, digits, marks, the dot and every RFC 5322 atom character
// (! # $ % & ' * + / = ? ^ _ ` { | } ~ -). A quoted local part may hold backslash escapes.
const LOCAL = "\\p{L}\\p{N}\\p{M}.!#$%&'*+/=?^_`{|}~-";
const DOM = '\\p{L}\\p{N}\\p{M}-';
// The look-behind guards only the unquoted local part: a quoted one starts at its quote
// mark, whatever comes before it (docs/"alice smith"@example.com). An unquoted local part
// holds no hidden character (a variation selector is a mark): in "alice smith"<U+FE0F>@x
// the selector is not a local part of its own, so once it is removed the quoted address
// is found whole.
const EMAIL = new RegExp(`(?:"(?:[^"\\\\\\r\\n]|\\\\[^\\r\\n]){1,64}"|(?<![${LOCAL}])(?:(?!\\p{Default_Ignorable_Code_Point})[${LOCAL}])+)@(?:\\[(?:[Ii][Pp][Vv]6:)?[0-9A-Fa-f:.]{2,45}\\]|[${DOM}]+(?:\\.[${DOM}]+)*)`, 'gu');
const TLD = /^(?:\p{L}[\p{L}\p{M}]{1,62}|xn--[a-z0-9-]{1,59})$/iu;

function emailTo(m) {
  // The domain never holds an @, so the last @ is the one before it.
  const at = m.lastIndexOf('@');
  const domain = m.slice(at + 1);
  if (domain.startsWith('[')) return REDACTED;
  const labels = domain.split('.');
  for (let j = labels.length - 1; j >= 1; j--) {
    if (TLD.test(labels[j])) return REDACTED + (j < labels.length - 1 ? `.${labels.slice(j + 1).join('.')}` : '');
  }
  return m;
}

// Every address, in one pass. A match that is not an address (pkg@latest, name@1.2.3) is
// left as it is and the search goes on right after its @, so it cannot hide an address
// that starts inside it (pkg@latest/alice@example.com). Each character is read at most
// twice (once as a domain, once as a local part), so the pass stays linear.
function redactEmails(text) {
  let out = '';
  let at = 0;
  EMAIL.lastIndex = 0;
  for (;;) {
    const m = EMAIL.exec(text);
    if (!m) break;
    const to = emailTo(m[0]);
    if (to === m[0]) {
      EMAIL.lastIndex = m.index + m[0].lastIndexOf('@') + 1;
      continue;
    }
    out += text.slice(at, m.index) + to;
    at = m.index + m[0].length;
  }
  return at === 0 ? text : out + text.slice(at);
}

// A quoted-local-part address ("alice smith"@example.com), redacted before the
// assignment rule. An assignment inside the quotes ("Alice Smith token=secret"@example.com)
// would otherwise let the assignment rule cut the address first and leave the name behind.
// The general email rule still runs after assignment for unquoted local parts, and a real
// name=value@host assignment has no quoted local part, so this rule does not touch it.
const QEMAIL = new RegExp(`"(?:[^"\\\\\\r\\n]|\\\\[^\\r\\n]){1,64}"@(?:\\[(?:[Ii][Pp][Vv]6:)?[0-9A-Fa-f:.]{2,45}\\]|[${DOM}]+(?:\\.[${DOM}]+)*)`, 'gu');
function redactQuotedEmails(text) {
  let out = '';
  let at = 0;
  QEMAIL.lastIndex = 0;
  for (;;) {
    const m = QEMAIL.exec(text);
    if (!m) break;
    const to = emailTo(m[0]);
    if (to === m[0]) {
      QEMAIL.lastIndex = m.index + m[0].lastIndexOf('@') + 1;
      continue;
    }
    out += text.slice(at, m.index) + to;
    at = m.index + m[0].length;
  }
  return at === 0 ? text : out + text.slice(at);
}

// ------------------------------------------------------------------ long runs

function longRunTo(m) {
  if (!/[/_-]/.test(m)) return REDACTED;
  if (!/\d/.test(m)) return m;
  let longest = 0;
  for (const part of m.split(/[/_-]/)) longest = Math.max(longest, part.length);
  return longest >= 16 ? REDACTED : m;
}

function awsSecretTo(m, offset, whole) {
  const before = whole.slice(Math.max(0, offset - 200), offset);
  if (/aws|secret/i.test(before)) return REDACTED;
  return /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m) ? REDACTED : m;
}

// A Basic value is base64 of user:pass, so a value of 4 or more characters (padding
// included) whose decoded bytes hold a colon is redacted whatever its length and whatever
// the other bytes are, even when it reads like a word (Yjphamph is b:ajja, YTpi is a:b,
// YTo= is a:). A value of 6 or more characters is also redacted when it looks encoded: a
// digit, + / or =, or a capital after its first letter.
const decodesWithColon = (v) => Buffer.from(v, 'base64').includes(0x3a);
function basicTo(m, p1, p2) {
  if (p2.startsWith(REDACTED)) return p1 + REDACTED;
  if (p2.length < 4) return m;
  // A 6+ char value looks encoded with a digit, + / =, or a capital after the first
  // letter, as formats.md states.
  const looks = p2.length >= 6 && (/[\d+/=]/.test(p2) || /[A-Z]/.test(p2.slice(1)));
  return looks || decodesWithColon(p2) ? p1 + REDACTED : m;
}
// One pass: the word basic, then its value, looked at without being taken. A value that
// stays (a plain word, as in "a basic Basic <value>") is read again as the word basic, so
// it cannot hide the value after it. A value never holds a space, so the next "basic "
// starts at the end of it at the earliest, and each character is read a fixed number of
// times.
const BASIC = /\b(basic[ \t]+)(?=((?:\[redacted\])*[A-Za-z0-9+/]{2,}={0,2})(?![A-Za-z0-9+/=]))/gi;
function redactBasic(text) {
  let out = '';
  let at = 0;
  BASIC.lastIndex = 0;
  for (;;) {
    const m = BASIC.exec(text);
    if (!m) break;
    const to = basicTo(m[1] + m[2], m[1], m[2]);
    if (to === m[1] + m[2]) continue;
    out += text.slice(at, m.index) + to;
    at = m.index + m[1].length + m[2].length;
    BASIC.lastIndex = at;
  }
  return at === 0 ? text : out + text.slice(at);
}

// Authorization headers: from the colon (or =) after the word authorization to the end of
// the line, whatever the scheme. One pass with indexes: each character is looked at a
// fixed number of times, so a long run of spaces cannot stall it.
const AUTH_WORD = /authorization/gi;
const isWordChar = (c) => c !== undefined && /[A-Za-z0-9_]/.test(c);
function redactAuthHeaders(text) {
  let out = '';
  let at = 0;
  AUTH_WORD.lastIndex = 0;
  for (;;) {
    const m = AUTH_WORD.exec(text);
    if (!m) break;
    if (m.index > 0 && isWordChar(text[m.index - 1])) continue;
    let i = AUTH_WORD.lastIndex;
    if (text[i] === '"' || text[i] === "'") i++;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
    if (text[i] !== ':' && text[i] !== '=') continue;
    i++;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
    let e = i;
    while (e < text.length && text[e] !== '\n' && text[e] !== '\r') e++;
    let k = e;
    while (k > i && (text[k - 1] === ' ' || text[k - 1] === '\t')) k--;
    if (k > i) {
      out += text.slice(at, i) + REDACTED;
      at = k;
    }
    AUTH_WORD.lastIndex = e;
  }
  return at === 0 ? text : out + text.slice(at);
}

// JSON Web Tokens: eyJ and at least 8 more characters of header, a dot, a payload of at
// least 2 characters (e30 is the empty-claims payload), a dot, and the signature (any
// length, even none). One pass with indexes: a failed start skips the whole run it
// scanned (a later start inside that run would end at the same character and fail the
// same way), so a long run of "-eyJ" cannot stall it.
const isB64u = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;
const isWordCode = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
function redactJwts(text) {
  let out = '';
  let at = 0;
  for (const [p, k] of jwtSpans(text)) {
    out += text.slice(at, p) + REDACTED;
    at = k;
  }
  return at === 0 ? text : out + text.slice(at);
}
// Where each token starts and ends, as [start, end] pairs in text order.
function jwtSpans(text) {
  const n = text.length;
  const spans = [];
  let from = 0;
  for (;;) {
    const p = text.indexOf('eyJ', from);
    if (p < 0) break;
    if (p > 0 && isWordCode(text.charCodeAt(p - 1))) {
      from = p + 1;
      continue;
    }
    let i = p + 3;
    while (i < n && isB64u(text.charCodeAt(i))) i++;
    if (i - p < 11 || text[i] !== '.') {
      from = Math.max(i, p + 1);
      continue;
    }
    let j = i + 1;
    while (j < n && isB64u(text.charCodeAt(j))) j++;
    if (j - i - 1 < 2 || text[j] !== '.') {
      from = Math.max(j, p + 1);
      continue;
    }
    let k = j + 1;
    while (k < n && isB64u(text.charCodeAt(k))) k++;
    spans.push([p, k]);
    from = k;
  }
  return spans;
}

const regexRule = (name, re, to) => ({ name, run: (t) => t.replace(re, to === undefined ? REDACTED : to) });

const RULES = [
  { name: 'pem', run: redactPem },
  // The user name runs to the first colon and may hold an @ (scheme://a@b.c:<password>@host
  // is a valid URL whose password is <password>); the password runs to the last @.
  regexRule('url-password', /(?<![A-Za-z0-9+.-])([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s:/?#]*):([^\s/?#]*)@/g, (m, s, u, p) => (p === REDACTED ? m : `${s}${u}:${REDACTED}@`)),
  { name: 'auth-header', run: redactAuthHeaders },
  { name: 'basic', run: redactBasic },
  regexRule('bearer', /\b(bearer[ \t]+)((?:\[redacted\])*[A-Za-z0-9._~+/=-]{8,})/gi, (m, p1) => p1 + REDACTED),
  { name: 'jwt', run: redactJwts },
  regexRule('sk-key', /\bsk-[A-Za-z0-9_-]{16,}/g),
  regexRule('github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}/g),
  regexRule('github-pat', /\bgithub_pat_[A-Za-z0-9_]{20,}/g),
  regexRule('aws-key-id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g),
  regexRule('slack-token', /\bxox[abprs]-[A-Za-z0-9-]{8,}/g),
  regexRule('google-key', /\bAIza[0-9A-Za-z_-]{35}/g),
  { name: 'email-quoted', run: redactQuotedEmails },
  { name: 'assignment', run: redactAssignments },
  regexRule('aws-secret', /(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/]{40}(?![A-Za-z0-9+/=_-])/g, awsSecretTo),
  { name: 'email', run: redactEmails },
  regexRule('long-run', /(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/=_-]{41,}(?![A-Za-z0-9+/=_-])/g, longRunTo),
];

// ------------------------------------------------------------------ hidden characters

// Control characters (not tab, line feed or carriage return) and every default-ignorable
// code point (see the top of this file).
const HIDDEN_CLASS = '\\p{Default_Ignorable_Code_Point}\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f-\\x9f';
const HIDDEN = new RegExp(`[${HIDDEN_CLASS}]`, 'gu');
const HAS_HIDDEN = new RegExp(`[${HIDDEN_CLASS}]`, 'u');
const isHidden = (c) => {
  const k = c.codePointAt(0);
  if (k < 0x7f) return k <= 0x08 || k === 0x0b || k === 0x0c || (k >= 0x0e && k <= 0x1f);
  return HAS_HIDDEN.test(c);
};
const stripHidden = (text) => String(text === undefined || text === null ? '' : text).replace(HIDDEN, '');
// The characters that end the word a redacted part takes with it: white space, the stops
// of an assignment, brackets and quote marks.
const WORD_STOPS = ',;&()[]{}<>"\'`';
const endsWord = (c) => !isHidden(c) && (WORD_STOPS.includes(c) || /\s/.test(c));
// The whole character (a surrogate pair is one) at i, or the one before i.
const charAt = (t, i) => String.fromCodePoint(t.codePointAt(i));
function charBefore(t, i) {
  const lo = t.charCodeAt(i - 1);
  const hi = i >= 2 ? t.charCodeAt(i - 2) : 0;
  return lo >= 0xdc00 && lo <= 0xdfff && hi >= 0xd800 && hi <= 0xdbff ? t.slice(i - 2, i) : t[i - 1];
}

// A redacted part that a hidden character touches takes the rest of that word with it, on
// that side: the character may have split a secret whose first part a rule found
// (ghp_<20 characters><U+200B><the rest>). One pass with indexes: the walk back stops at
// the end of the last part taken and the walk forward at the next bracket, so each
// character is looked at a fixed number of times.
function absorbAtHidden(text) {
  let out = '';
  let at = 0;
  for (;;) {
    const p = text.indexOf(REDACTED, at);
    if (p < 0) break;
    let a = p;
    let gap = false;
    while (a > at && isHidden(charBefore(text, a))) {
      a -= charBefore(text, a).length;
      gap = true;
    }
    if (gap) while (a > at && !endsWord(charBefore(text, a))) a -= charBefore(text, a).length;
    else a = p;
    const end = p + REDACTED.length;
    let b = end;
    gap = false;
    while (b < text.length && isHidden(charAt(text, b))) {
      b += charAt(text, b).length;
      gap = true;
    }
    if (gap) while (b < text.length && !endsWord(charAt(text, b))) b += charAt(text, b).length;
    else b = end;
    out += text.slice(at, a) + REDACTED;
    at = b;
  }
  return at === 0 ? text : out + text.slice(at);
}

// JSON Web Tokens read through hidden characters, before the first step: the tokens of the
// text with its hidden characters removed are redacted in the text itself, each from its
// first character to its last, the hidden characters inside it included. A hidden
// character inside a token (eyJ<17 characters><U+200B><the rest of the header>.<payload>)
// would otherwise let the long-run rule take the rest of the header on its own in the
// first step, leaving the payload and the signature for no rule to see. One pass to remove
// them (keeping where each kept character came from), one token scan: linear.
function jwtsThroughHidden(text) {
  const from = new Int32Array(text.length + 1);
  let s = '';
  for (let i = 0; i < text.length;) {
    const c = charAt(text, i);
    if (!isHidden(c)) {
      for (let x = 0; x < c.length; x++) from[s.length + x] = i + x;
      s += c;
    }
    i += c.length;
  }
  const spans = jwtSpans(s);
  if (!spans.length) return text;
  let out = '';
  let at = 0;
  for (const [p, k] of spans) {
    // A token is made of ASCII characters only, so its last one is one code unit long.
    out += text.slice(at, from[p]) + REDACTED;
    at = from[k - 1] + 1;
  }
  return out + text.slice(at);
}

// The rules (those keep() lets through) over a text: once, or for a text that holds a
// hidden character, in the three steps described at the top of this file (JSON Web
// Tokens read through the hidden characters first).
function runRules(text, keep) {
  let t = text;
  for (const r of RULES) if (keep(r)) t = r.run(t);
  return t;
}
const JWT_RULE = RULES.find((r) => r.name === 'jwt');
function redactWith(text, keep) {
  const t = String(text === undefined || text === null ? '' : text);
  if (!HAS_HIDDEN.test(t)) return runRules(t, keep);
  const first = keep(JWT_RULE) ? jwtsThroughHidden(t) : t;
  return runRules(absorbAtHidden(runRules(first, keep)).replace(HIDDEN, ''), keep);
}

const ALL_RULES = () => true;
function redact(text) {
  return redactWith(text, ALL_RULES);
}

// The chat-history folder path the kit computes for this repository is shown so you can
// confirm it. It goes through every rule except the long-run rule, which would hide a long
// project folder name (an email or a key in the path is still redacted).
function redactPath(text) {
  return redactWith(text, (r) => r.name !== 'long-run');
}

// Full redaction, except that each literal in keep (such a computed folder path) gets
// redactPath instead, wherever it appears in the text.
function redactKeeping(text, keep) {
  const t = String(text === undefined || text === null ? '' : text);
  const lits = (Array.isArray(keep) ? keep : []).filter((k) => typeof k === 'string' && k.length > 0);
  if (!lits.length) return redact(t);
  const [first, ...rest] = lits;
  return t.split(first).map((piece) => redactKeeping(piece, rest)).join(redactPath(first));
}

// One named rule on its own, so a test can check each shape without another
// rule (such as the long-run rule) hiding a gap.
function redactOne(name, text) {
  const r = RULES.find((x) => x.name === name);
  if (!r) throw new Error(`no redaction rule named ${name}`);
  return r.run(String(text));
}

// ------------------------------------------------------------------ excerpts

const CUT = '[cut]';

// Already-redacted text cut to max characters, ending with marker when cut (never in the
// middle of a surrogate pair). Cutting redacted text only removes characters, so it can
// never bring a secret back.
function cutRedacted(t, max, marker) {
  if (t.length <= max) return t;
  let n = Math.max(0, max - marker.length);
  const c = t.charCodeAt(n - 1);
  if (c >= 0xd800 && c <= 0xdbff) n--;
  return t.slice(0, n) + marker;
}

// An excerpt: the whole text redacted first, then trimmed and cut to max characters
// (default 400); a cut text ends with [cut].
function excerpt(text, max) {
  return cutRedacted(redact(text).trim(), max || 400, CUT);
}

// A short label for a message (an argument, a field value, a matched phrase): redacted
// first, its white space collapsed, redacted again (a collapsed line break can join a name
// and its value: password<LF>=alpha), then cut to max characters followed by "...".
function clip(text, max) {
  const t = redact(redact(text).replace(/\s+/g, ' ').trim());
  return t.length > max ? cutRedacted(t, max + 3, '...') : t;
}

module.exports = { redact, redactPath, redactKeeping, redactOne, excerpt, clip, cutRedacted, stripHidden, REDACTED, RULE_NAMES: RULES.map((r) => r.name) };
