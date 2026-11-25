'use strict';
// Text helpers shared by the ranker, the name layer and the map. No dependencies.

const STOP = new Set(
  ('a an the and or but if then so to of in on at by for with from into onto about as is are was were be been being am ' +
    'do does did done have has had having i me my we us our you your it its this that these those there here please can ' +
    'could would should will shall may might must just also really very quite some any all now go let lets okay ok um uh ' +
    'like want need hey yeah').split(' '),
);
// Words a dictation tool writes for punctuation that typing would have dropped.
const SPOKEN = new Set(['slash', 'colon', 'dash', 'hyphen', 'underscore']);

function words(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !SPOKEN.has(w));
}

function stem(t) {
  if (t.length <= 3) return t;
  const rules = [['ing', 5], ['ies', 4], ['ied', 4], ['ed', 4], ['es', 4], ['ly', 4], ['s', 3]];
  for (const [suf, min] of rules) {
    if (t.endsWith(suf) && t.length - suf.length >= min - 1) {
      let r = t.slice(0, -suf.length);
      if (suf === 'ies' || suf === 'ied') r += 'y';
      return r;
    }
  }
  return t;
}

function wordTokens(text) {
  return words(text).filter((w) => !STOP.has(w)).map(stem);
}

// Character trigrams over the words joined with no spaces, so "road map" and "roadmap"
// share their grams and a single dropped or swapped letter costs only a few of them.
function charGrams(text, n = 3) {
  const s = words(text).join('');
  const out = [];
  for (let i = 0; i + n <= s.length; i++) out.push(s.slice(i, i + n));
  return out;
}

function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// A conservative token estimate. Measured on skill names and short descriptions, real
// counts run 2.4 to 3.1 characters per token; dividing by 2.3 keeps budgets above them.
const estimateTokens = (s) => Math.ceil(String(s || '').length / 2.3);

module.exports = { STOP, SPOKEN, words, stem, wordTokens, charGrams, editDistance, estimateTokens };
