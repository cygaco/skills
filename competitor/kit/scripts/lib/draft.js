"use strict";
/**
 * lib/draft.js - reads draft.json and applies the cite rule per row type.
 *
 *   features, voc            a valid cite is REQUIRED (evidence_url / source_url
 *                            must match an "ok" source record whose URL passes
 *                            the URL check); otherwise the row is dropped and
 *                            the drop is logged.
 *   jtbds, gaps,             cites are optional; a row with no valid cite is
 *   opportunities            kept and labelled "inferred, no source".
 *                            Opportunities may also cite row ids (F2, G1, ...).
 *   product_identity         needs a cite to an ok page from the product's own
 *                            site (source_class product, landing or devdocs);
 *                            otherwise the section shows a [GAP ...] marker.
 *
 * A source record whose URL fails the URL check is never rendered as a source
 * and never counts as a cite. Unless the record says status "refused" (the
 * check refused it before any fetch, as the command requires), it is reported
 * loudly: it means a fetch happened that should not have.
 *
 * Size: a draft file over 5 MB is refused unread, and every string in it is cut
 * to MAX_FIELD characters as it is read, before anything looks at it. A cut
 * string carries a trailing NUL mark, so it can never pass a check (a URL, a
 * status, a slug or a path) that its full text would have failed.
 */

const { checkUrl, citeKey } = require("./guard");
const { cleanText, printable, shownUrl, clip, MAX_FIELD } = require("./text");
const { refuseSlug } = require("./slug");
const { readCapped } = require("./confine");

class DraftError extends Error {}

const MAX_DRAFT_BYTES = 5 * 1024 * 1024;
const CUT_MARK = String.fromCharCode(0);

const STATUSES = ["ok", "failed", "refused"];
const SOURCE_CLASSES = ["product", "landing", "devdocs", "review", "appimg"];
const FIRST_PARTY = ["product", "landing", "devdocs"];
const COMPLEXITY = ["S", "M", "L", "XL"];
const SEVERITY = ["low", "medium", "high"];
const ROW_ID_RE = /^([JFQGO])(\d{1,4})$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** Cuts every string in a parsed document to MAX_FIELD characters, in place. No recursion. */
function clampStrings(doc) {
  const stack = [doc];
  while (stack.length) {
    const x = stack.pop();
    for (const k of Array.isArray(x) ? x.keys() : Object.keys(x)) {
      const v = x[k];
      if (typeof v === "string") {
        if (v.length > MAX_FIELD) x[k] = clip(v, MAX_FIELD) + CUT_MARK;
      } else if (v && typeof v === "object") stack.push(v);
    }
  }
  return doc;
}

function readJsonFile(file, label, shownAs) {
  const got = readCapped(file, MAX_DRAFT_BYTES);
  if (!got.ok && got.why === "too-big") {
    throw new DraftError(`${label} is larger than 5 MB; a draft holds text and URLs only, so trim it: ${printable(shownAs || file)}`);
  }
  if (!got.ok) throw new DraftError(`${label} not found or unreadable: ${printable(shownAs || file)}`);
  let text = got.buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new DraftError(`${label} is not valid JSON (${printable(e.message)})`);
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new DraftError(`${label} must be a JSON object`);
  return clampStrings(doc);
}

/** A non-text value as short display text, without serialising it. */
function describeValue(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "(a list)";
  if (typeof v === "object") return "(an object)";
  return printable(String(v));
}

function parseGeneratedAt(value, label) {
  const raw = typeof value === "string" ? value.trim() : "";
  const ms = Date.parse(raw);
  if (!raw || !ISO_RE.test(raw) || !Number.isFinite(ms)) {
    throw new DraftError(`${label}.generated_at must be a UTC ISO 8601 time such as 2026-11-01T09:30:00Z`);
  }
  return { raw, ms, date: new Date(ms).toISOString().slice(0, 10) };
}

/** A list field: absent means empty; anything but a list of objects (or strings, when allowed) is a bad draft. */
function listField(doc, key, label, opts) {
  const v = doc[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new DraftError(`${label}.${key} must be a list`);
  v.forEach((x, i) => {
    const okObj = x && typeof x === "object" && !Array.isArray(x);
    const okStr = opts && opts.strings && typeof x === "string";
    if (!okObj && !okStr) throw new DraftError(`${label}.${key}[${i}] must be ${opts && opts.strings ? "text or an object" : "an object"}`);
  });
  return v;
}

function citeList(v) {
  if (v === undefined || v === null) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v;
  return [v];
}

// ---------------------------------------------------------------- target + slug

function readTarget(doc, label) {
  const t = doc.target;
  if (!t || typeof t !== "object" || Array.isArray(t)) throw new DraftError(`${label}.target must be an object with a name or a url`);
  const name = cleanText(t.name, 200);
  const urlText = typeof t.url === "string" ? t.url.trim() : "";
  if (!name && !urlText) throw new DraftError(`${label}.target needs a name or a url`);
  const guard = urlText ? checkUrl(urlText) : null;
  if (t.slug === undefined || t.slug === null || t.slug === "") {
    throw new DraftError(`${label}.target.slug is required: copy the slug that report.js check printed`);
  }
  if (typeof t.slug !== "string") throw new DraftError(`${label}.target.slug must be text`);
  const why = refuseSlug(t.slug);
  if (why) throw new DraftError(`${label}.target.slug: ${printable(why)}`);
  const slug = t.slug;
  return { name: name || (guard && guard.ok ? guard.hostname.replace(/^www\./, "") : slug), urlText, guard, resolvedVia: cleanText(t.resolved_via, 200), slug };
}

// ---------------------------------------------------------------- source records

function vetRecords(list) {
  const recs = list.map((r, i) => {
    const status = typeof r.status === "string" ? r.status.trim().toLowerCase() : "";
    const g = checkUrl(r.url);
    const rec = {
      id: `S${i + 1}`,
      urlText: typeof r.url === "string" ? r.url.trim() : "",
      status: STATUSES.includes(status) ? status : status ? `unknown (${cleanText(status, 20)})` : "missing",
      sourceClass: cleanText(r.source_class, 40) || "unstated",
      knownClass: SOURCE_CLASSES.includes(String(r.source_class || "").trim().toLowerCase()),
      reason: cleanText(r.failure_reason, 300),
      length: Number.isFinite(r.length) ? String(Math.round(r.length)) : cleanText(r.length, 20),
      retrievedAt: cleanText(r.retrieved_at, 60),
      guardOk: g.ok,
      guardReason: g.ok ? "" : g.reason,
      href: g.ok ? g.href : null,
      key: g.ok ? citeKey(g.href) : null,
    };
    rec.ok = g.ok && rec.status === "ok";
    rec.loud = !g.ok && rec.status !== "refused";
    return rec;
  });
  const okByKey = new Map();
  const anyByKey = new Map();
  for (const rec of recs) {
    if (!rec.key) continue;
    if (rec.ok && !okByKey.has(rec.key)) okByKey.set(rec.key, rec);
    if (!anyByKey.has(rec.key)) anyByKey.set(rec.key, rec);
  }
  return { list: recs, okByKey, anyByKey, loud: recs.filter((r) => r.loud) };
}

/** Resolves a URL cite to an ok source record, or says why it is not one. */
function resolveUrl(raw, recs) {
  if (typeof raw !== "string" || !raw.trim()) return { why: "no URL given" };
  const g = checkUrl(raw);
  if (!g.ok) return { why: `refused by the URL check (${g.reason})` };
  const key = citeKey(raw);
  const rec = recs.okByKey.get(key);
  if (rec) return { rec };
  const other = recs.anyByKey.get(key);
  if (other) return { why: `its source record ${other.id} has status ${other.status}, not ok` };
  return { why: "not a page fetched in this run (no ok source record has this URL)" };
}

// ---------------------------------------------------------------- rows

function short(s, n) {
  const t = cleanText(s);
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

function pickEnum(v, allowed, upper) {
  const s = typeof v === "string" ? (upper ? v.trim().toUpperCase() : v.trim().toLowerCase()) : "";
  return allowed.includes(s) ? s : "unrated";
}

function pickCore(v) {
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? String(n) : "unrated";
}

/**
 * Applies the cite rule to every row. Returns the kept rows per type, a map of
 * kept rows by id, and the log of dropped rows and ignored cites.
 */
function buildRows(doc, recs, label) {
  const log = { dropped: [], ignored: [] };
  const byId = new Map();
  const drop = (id, why) => log.dropped.push({ row: id, why });
  const ignore = (id, cite, why) => log.ignored.push({ row: id, cite: typeof cite === "string" ? shownUrl(cite) : describeValue(cite), why });

  const urlSources = (id, cites) => {
    const out = [];
    for (const c of citeList(cites)) {
      if (typeof c !== "string") {
        ignore(id, c, "a cite must be text");
        continue;
      }
      const r = resolveUrl(c, recs);
      if (r.rec) {
        if (!out.includes(r.rec)) out.push(r.rec);
      } else ignore(id, c, r.why);
    }
    return out;
  };
  const keep = (row) => {
    byId.set(row.id, row);
    return row;
  };

  const jtbds = [];
  listField(doc, "jtbds", label).forEach((r, i) => {
    const id = `J${i + 1}`;
    const job = cleanText(r.job);
    if (!job) return drop(id, "no job text");
    jtbds.push(keep({ id, job, why: cleanText(r.why), sources: urlSources(id, r.cites) }));
  });

  const features = [];
  listField(doc, "features", label).forEach((r, i) => {
    const id = `F${i + 1}`;
    const name = cleanText(r.name, 200);
    if (!name) return drop(id, "no feature name");
    const res = resolveUrl(r.evidence_url, recs);
    if (!res.rec) return drop(`${id} (${short(name, 60)})`, `evidence_url: ${res.why}`);
    features.push(keep({
      id,
      name,
      description: cleanText(r.description),
      complexity: pickEnum(r.complexity, COMPLEXITY, true),
      coreness: pickCore(r.coreness),
      sources: [res.rec],
    }));
  });

  const voc = [];
  listField(doc, "voc", label).forEach((r, i) => {
    const id = `Q${i + 1}`;
    const quote = cleanText(r.quote);
    if (!quote) return drop(id, "no quote text");
    const res = resolveUrl(r.source_url, recs);
    if (!res.rec) return drop(`${id} ("${short(quote, 40)}")`, `source_url: ${res.why}`);
    voc.push(keep({
      id,
      quote,
      sentiment: cleanText(r.sentiment, 40) || "unstated",
      retrieved: cleanText(r.retrieved, 60) || res.rec.retrievedAt,
      sources: [res.rec],
    }));
  });

  const gaps = [];
  listField(doc, "gaps", label).forEach((r, i) => {
    const id = `G${i + 1}`;
    const gap = cleanText(r.gap);
    if (!gap) return drop(id, "no gap text");
    gaps.push(keep({ id, gap, severity: pickEnum(r.severity, SEVERITY, false), sources: urlSources(id, r.cites) }));
  });

  // Opportunities last, so their row-id cites can see every other kept row.
  const opportunities = [];
  listField(doc, "opportunities", label).forEach((r, i) => {
    const id = `O${i + 1}`;
    const text = cleanText(r.opportunity);
    if (!text) return drop(id, "no opportunity text");
    const sources = [];
    const buildsOn = [];
    let sourcedRow = false;
    for (const c of citeList(r.cites)) {
      const m = typeof c === "string" ? ROW_ID_RE.exec(c.trim()) : null;
      if (m) {
        const rid = `${m[1].toUpperCase()}${Number(m[2])}`;
        const row = byId.get(rid);
        if (!row || rid[0] === "O") {
          ignore(id, c, row ? "an opportunity cannot cite another opportunity" : "not a kept row of this brief");
          continue;
        }
        if (!buildsOn.includes(rid)) buildsOn.push(rid);
        if (row.sources.length) sourcedRow = true;
        continue;
      }
      if (typeof c !== "string") {
        ignore(id, c, "a cite must be text");
        continue;
      }
      const res = resolveUrl(c, recs);
      if (res.rec) {
        if (!sources.includes(res.rec)) sources.push(res.rec);
      } else ignore(id, c, res.why);
    }
    opportunities.push({ id, text, buildsOn, sources, sourced: sources.length > 0 || sourcedRow });
  });

  return { jtbds, features, voc, gaps, opportunities, byId, log };
}

/** The product identity: shown only with a cite to an ok first-party page. */
function readIdentity(doc, recs, label, log) {
  const pi = doc.product_identity;
  if (pi === undefined || pi === null) return { summary: "", sources: [], missing: "no product identity in the draft", absent: true };
  if (typeof pi !== "object" || Array.isArray(pi)) throw new DraftError(`${label}.product_identity must be an object`);
  const summary = cleanText(pi.summary);
  const sources = [];
  for (const c of citeList(pi.cites)) {
    if (typeof c !== "string") {
      log.ignored.push({ row: "identity", cite: describeValue(c), why: "a cite must be text" });
      continue;
    }
    const res = resolveUrl(c, recs);
    if (!res.rec) {
      log.ignored.push({ row: "identity", cite: shownUrl(c), why: res.why });
      continue;
    }
    if (!FIRST_PARTY.includes(res.rec.sourceClass.toLowerCase())) {
      log.ignored.push({ row: "identity", cite: shownUrl(c), why: `source_class ${res.rec.sourceClass} is not a page from the product's own site` });
      continue;
    }
    if (!sources.includes(res.rec)) sources.push(res.rec);
  }
  if (!summary) return { summary: "", sources, missing: "the product identity has no summary" };
  if (!sources.length) return { summary: "", sources, missing: "no fetched page from the product's own site is cited, so the summary is not shown" };
  return { summary, sources, missing: "" };
}

/** Everything the renderers need from one draft.json. */
function analyzeDraft(doc, label) {
  const generatedAt = parseGeneratedAt(doc.generated_at, label);
  const target = readTarget(doc, label);
  const recs = vetRecords(listField(doc, "source_records", label));
  const rows = buildRows(doc, recs, label);
  const identity = readIdentity(doc, recs, label, rows.log);
  return { generatedAt, target, recs, rows, identity };
}

module.exports = {
  DraftError,
  FIRST_PARTY,
  SOURCE_CLASSES,
  MAX_DRAFT_BYTES,
  readJsonFile,
  clampStrings,
  describeValue,
  parseGeneratedAt,
  listField,
  citeList,
  vetRecords,
  resolveUrl,
  analyzeDraft,
  ROW_ID_RE,
};
