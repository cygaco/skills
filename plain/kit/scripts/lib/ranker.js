'use strict';
// Local skill ranker: cosine similarity over TF-IDF vectors of words and of character
// trigrams, averaged. Each skill has several units (its name, its name plus description,
// and phrases learned from past misses); a skill scores the best of its units.
const { wordTokens, charGrams } = require('./text');

const ALPHA = 0.5; // weight of the word channel; the rest goes to character trigrams

function tf(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function vec(tfm, idf, maxIdf) {
  const v = {};
  let norm = 0;
  for (const [t, f] of tfm) {
    const x = (1 + Math.log(f)) * (idf[t] != null ? idf[t] : maxIdf);
    v[t] = +x.toFixed(4);
    norm += x * x;
  }
  return { v, n: +(Math.sqrt(norm) || 1).toFixed(4) };
}

function cos(a, b) {
  const ka = Object.keys(a.v);
  const kb = Object.keys(b.v);
  const [s, l] = ka.length < kb.length ? [a, b] : [b, a];
  let dot = 0;
  for (const k in s.v) if (l.v[k] !== undefined) dot += s.v[k] * l.v[k];
  return dot / (a.n * b.n);
}

function slugText(slug) {
  return String(slug).replace(/[:\-_/]/g, ' ');
}

// skills: [{ slug, description, whenToUse, learned: [phrases] }]
function buildIndex(skills) {
  const units = [];
  skills.forEach((s, i) => {
    const st = slugText(s.slug);
    units.push({ s: i, k: 'name', text: st });
    units.push({ s: i, k: 'doc', text: [st, s.description || '', s.whenToUse || ''].join(' . ') });
    for (const p of s.learned || []) units.push({ s: i, k: 'learned', text: p });
  });
  const N = skills.length || 1;
  const dfW = new Map();
  const dfC = new Map();
  const perW = skills.map(() => new Set());
  const perC = skills.map(() => new Set());
  for (const u of units) {
    for (const t of wordTokens(u.text)) perW[u.s].add(t);
    for (const g of charGrams(u.text)) perC[u.s].add(g);
  }
  for (const set of perW) for (const t of set) dfW.set(t, (dfW.get(t) || 0) + 1);
  for (const set of perC) for (const g of set) dfC.set(g, (dfC.get(g) || 0) + 1);
  const idfW = {};
  const idfC = {};
  for (const [t, d] of dfW) idfW[t] = +Math.log((N + 1) / d).toFixed(4);
  for (const [g, d] of dfC) idfC[g] = +Math.log((N + 1) / d).toFixed(4);
  const maxIdf = +Math.log(N + 1).toFixed(4);
  return {
    N,
    idfW,
    idfC,
    maxIdf,
    units: units.map((u) => ({ s: u.s, k: u.k, w: vec(tf(wordTokens(u.text)), idfW, maxIdf), c: vec(tf(charGrams(u.text)), idfC, maxIdf) })),
  };
}

// Returns [{ i, score }] best first, one entry per skill index with a score above zero.
function rank(index, prompt, limit = 3) {
  const qw = vec(tf(wordTokens(prompt)), index.idfW, index.maxIdf);
  const qc = vec(tf(charGrams(prompt)), index.idfC, index.maxIdf);
  if (!Object.keys(qw.v).length && !Object.keys(qc.v).length) return [];
  const best = new Map();
  for (const u of index.units) {
    const s = ALPHA * cos(qw, u.w) + (1 - ALPHA) * cos(qc, u.c);
    if (s > (best.get(u.s) || 0)) best.set(u.s, s);
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([i, score]) => ({ i, score }));
}

module.exports = { buildIndex, rank, slugText, ALPHA };
