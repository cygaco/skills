'use strict';
// Name layer: the person says a skill's name without the slash ("db migrate to twelve",
// "slash road map add the login bug"). Deterministic: the first words of the message must
// spell every word of one skill's name, in order. Dictation damage it heals: a spoken
// "slash" / "colon", lost punctuation, a compound split in two ("road map"), a plural, and
// one wrong letter in a word of five letters or more.
const { SPOKEN, editDistance } = require('./text');

const LEAD = new Set(['um', 'uh', 'ok', 'okay', 'so', 'hey', 'please', 'now', 'lets', 'go', 'and', 'then', 'run', 'do', 'use', 'start', 'invoke', 'the', 'a', 'can', 'you', 'could', 'would', 'skill', 'command']);
const MAX_LEAD = 3;

function nameWords(slug) {
  return String(slug).toLowerCase().split(/[:\-_/.]+/).filter(Boolean);
}

function sameWord(said, want) {
  if (said === want) return true;
  if (said === `${want}s` || `${said}s` === want) return true;
  if (want.length >= 5 && said.length >= 4 && editDistance(said, want, 1) <= 1) return true;
  return false;
}

// Build once per catalog: longest names first so "db migrate status" beats "db migrate".
function buildNames(slugs) {
  const vocab = new Set();
  const entries = slugs.map((slug) => {
    const w = nameWords(slug);
    w.forEach((x) => vocab.add(x));
    return { slug, w };
  });
  entries.sort((a, b) => b.w.length - a.w.length);
  return { entries, vocab: [...vocab] };
}

// Words with the character offset where each ends, spoken punctuation dropped.
function tokens(raw) {
  const out = [];
  const re = /[A-Za-z0-9À-ɏ'’]+/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const w = m[0].normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '');
    if (!w) continue;
    out.push({ w, end: m.index + m[0].length, spoken: SPOKEN.has(w) });
  }
  return out;
}

// Join neighbours whose concatenation is a name word ("road" + "map" -> "roadmap").
function heal(ts, vocab) {
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (i + 1 < ts.length && vocab.has(ts[i].w + ts[i + 1].w) && !vocab.has(ts[i].w)) {
      out.push({ w: ts[i].w + ts[i + 1].w, end: ts[i + 1].end });
      i++;
    } else out.push(ts[i]);
  }
  return out;
}

// Returns { slug, end } (end = character offset just after the name) or null.
// A one-word name needs a spoken "slash" before it, or must be the whole message.
function matchName(names, text) {
  const raw = String(text || '');
  if (/^\s*\//.test(raw)) return null; // a typed /skill is the harness's job, never ours
  const vocab = new Set(names.vocab);
  const all = tokens(raw);
  let i = 0;
  let spokenSlash = false;
  let lead = 0;
  while (i < all.length && (all[i].spoken || (lead < MAX_LEAD && LEAD.has(all[i].w) && !vocab.has(all[i].w)))) {
    if (all[i].w === 'slash') spokenSlash = true;
    if (!all[i].spoken) lead++;
    i++;
  }
  const ws = heal(all.slice(i).filter((t) => !t.spoken), vocab);
  for (const e of names.entries) {
    const n = e.w.length;
    if (ws.length < n) continue;
    if (!e.w.every((w, k) => sameWord(ws[k].w, w))) continue;
    if (n === 1 && !(spokenSlash || ws.length === 1)) continue;
    return { slug: e.slug, end: ws[n - 1].end };
  }
  return null;
}

// The words after the name, from the original text (case and punctuation kept).
function remainder(text, end) {
  return String(text || '').slice(end).replace(/^[\s:,.;\-]+/, '').trim();
}

// Words right after a name that turn it into a question or a report about the skill
// ("git push is failing, why?", "web deploy broke yesterday"), not a request to run it.
const REPORT = new Set('is was are were be been failed fails failing broke broken breaks keeps kept stuck hangs hung crashed crashes errored error errors issue issues problem problems why what how when where who not doesnt didnt isnt wasnt wont cant cannot never'.split(' '));

// A name match counts as a request to run the skill only when it is not a question or report.
function isRequest(text, end) {
  if (/\?/.test(String(text || ''))) return false;
  const after = remainder(text, end).toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean).slice(0, 3);
  return !after.some((w) => REPORT.has(w));
}

module.exports = { buildNames, matchName, remainder, nameWords, isRequest };
