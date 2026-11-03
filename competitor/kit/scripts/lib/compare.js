"use strict";
/**
 * lib/compare.js - turns compare.json plus its brief (draft.json) into the
 * comparison's sections.
 *
 * Their side cites pages fetched for the brief (ok source records that pass
 * the URL check), or the brief's row ids (F2, G1, ...). A feature row's
 * competitor status is shown only with a valid evidence_url: without one the
 * Them column reads "— (no source)", the user's side is kept, and the drop is
 * listed under Dropped rows and counted.
 *
 * Your side cites a repo-relative file path that exists inside the repository,
 * or the literal "you said". A path that is absolute, has a drive letter,
 * climbs with "..", names a .env file or does not exist renders as
 * "unverified". Openings, risks and next steps may cite such paths too (a risk
 * grounded in your own code), with the same checks: a valid one renders as a
 * verified file cite, never as "inferred, no source".
 */

const { cleanText, printable, shownUrl, INFERRED, GAP_DASH } = require("./text");
const { countGaps } = require("./blocks");
const { verifyCite } = require("./confine");
const { DraftError, parseGeneratedAt, listField, citeList, resolveUrl, describeValue, ROW_ID_RE } = require("./draft");
const { recordTables, logTables, sourcesOrLabel, sourceCell } = require("./brief");

const COMPARE_IDS = ["features", "jobs_overlap", "openings", "pricing", "positioning", "risks", "next_steps", "your_side", "unanswered", "sources"];
const COMPARE_GAP_IDS = COMPARE_IDS.filter((id) => id !== "unanswered" && id !== "sources");
const STATUS = ["yes", "no", "partial"];
const OVERLAP = ["full", "partial", "none"];
const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SOURCE = `${GAP_DASH} (no source)`;

const pick = (v, allowed) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return allowed.includes(s) ? s : "unrated";
};
const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const short = (s, n) => (s.length > n ? `${s.slice(0, n)}...` : s);

/**
 * True for a cite to check as a URL; false for a path into the user's
 * repository ("src/app.ts", "README.md:12", "you said"). A one-letter scheme
 * is a drive letter, and "name:12" is a path with a line locator.
 */
function isUrlCite(s) {
  if (/^[A-Za-z]:/.test(s)) return false;
  if (/^[^:]*:\d+(?:-\d+)?$/.test(s)) return false;
  return /^[a-z][a-z0-9+.-]+:/i.test(s);
}

/**
 * Builds the comparison. `cmp` is the parsed compare.json, `a` the analysed
 * brief, `repoRoot` the folder path cites are checked against.
 */
function buildCompare(cmp, a, kit, repoRoot) {
  const label = "compare.json";
  const generatedAt = parseGeneratedAt(cmp.generated_at, label);
  const { recs, rows: briefRows } = a;
  const log = { dropped: [], ignored: [] };
  const unverified = [];
  const tally = { file: 0, said: 0, unverified: 0 };
  const cited = new Set();

  /** One cite into the user's repository, as an inline node. */
  const yourCite = (row, raw) => {
    const v = verifyCite(raw, repoRoot);
    if (v.kind === "said") {
      tally.said++;
      return { t: "said" };
    }
    if (v.kind === "file") {
      tally.file++;
      return { t: "file", text: v.text };
    }
    tally.unverified++;
    unverified.push({ row, cite: printable(v.text) || "(none)", why: v.reason });
    return { t: "unverified", text: printable(v.text), reason: v.reason };
  };

  /**
   * URL cites, brief row ids and, with opts.paths, cites into the user's
   * repository. Returns { sources, buildsOn, repo, sourced }.
   */
  const citesOf = (row, cites, opts) => {
    const sources = [];
    const buildsOn = [];
    const repo = [];
    let sourcedRow = false;
    for (const c of citeList(cites)) {
      if (typeof c !== "string") {
        log.ignored.push({ row, cite: describeValue(c), why: "a cite must be text" });
        continue;
      }
      const s = c.trim();
      const m = ROW_ID_RE.exec(s);
      if (m) {
        const rid = `${m[1].toUpperCase()}${Number(m[2])}`;
        const r = briefRows.byId.get(rid);
        if (!r) {
          log.ignored.push({ row, cite: shownUrl(c), why: "not a kept row of the brief" });
          continue;
        }
        if (!buildsOn.includes(rid)) buildsOn.push(rid);
        if (r.sources.length) {
          sourcedRow = true;
          r.sources.forEach((src) => cited.add(src.id));
        }
        continue;
      }
      if (opts && opts.paths && !isUrlCite(s)) {
        repo.push(yourCite(row, c));
        continue;
      }
      const res = resolveUrl(c, recs);
      if (res.rec) {
        if (!sources.includes(res.rec)) sources.push(res.rec);
        cited.add(res.rec.id);
      } else log.ignored.push({ row, cite: shownUrl(c), why: res.why });
    }
    const repoBacked = repo.some((n) => n.t === "file" || n.t === "said");
    return { sources, buildsOn, repo, sourced: sources.length > 0 || sourcedRow || repoBacked };
  };

  /** The cites of one row, inline. With opts.noLabel a row with no cite shows nothing extra. */
  const citedInline = (c, opts) => {
    const inl = [];
    if (c.buildsOn.length) inl.push(`(builds on ${c.buildsOn.join(", ")}) `);
    if (c.sources.length) inl.push(...sourcesOrLabel(c.sources));
    c.repo.forEach((n, i) => {
      inl.push(i ? ", " : " ");
      inl.push(n);
    });
    if (!c.sourced && !c.repo.length && !(opts && opts.noLabel)) inl.push({ t: "label", text: INFERRED, kind: "inferred" });
    return inl;
  };

  const titles = Object.fromEntries(kit.sections.map((s) => [s.id, s.title]));
  const gap = (id) => ({ t: "p", inl: [{ t: "gap", text: kit.defaults[id] }] });
  const body = {};

  // features side by side: their status only with a fetched page behind it
  const featureRows = [];
  listField(cmp, "features", label).forEach((r, i) => {
    const id = `C${i + 1}`;
    const name = cleanText(r.name, 200);
    if (!name) return log.dropped.push({ row: id, why: "no feature name" });
    const them = asObj(r.them);
    const you = asObj(r.you);
    const ev = them.evidence_url;
    let rec = null;
    let why = "";
    if (ev === undefined || ev === null) why = "no evidence_url; their status needs a page fetched for the brief";
    else if (typeof ev !== "string") why = `evidence_url ${describeValue(ev)} is not text`;
    else {
      const res = resolveUrl(ev, recs);
      if (res.rec) rec = res.rec;
      else why = `evidence_url ${shownUrl(ev) || "(empty)"}: ${res.why}`;
    }
    let themStatus = NO_SOURCE;
    let evidence = GAP_DASH;
    if (rec) {
      themStatus = pick(them.status, STATUS);
      evidence = sourceCell([rec]);
      cited.add(rec.id);
    } else {
      log.dropped.push({ row: `${id} (${short(name, 60)}), their status`, why });
    }
    featureRows.push([id, name, themStatus, evidence, pick(you.status, STATUS), [yourCite(id, you.cite)]]);
  });
  body.features = featureRows.length
    ? [{ t: "table", head: ["ID", "Feature", "Them", "Their evidence", "You", "Your cite"], rows: featureRows }]
    : [gap("features")];

  // overlapping jobs
  const jobs = listField(cmp, "jobs_overlap", label, { strings: true })
    .map((r, i) => {
      const o = typeof r === "string" ? { job: r } : r;
      const job = cleanText(o.job);
      if (!job) {
        log.dropped.push({ row: `jobs_overlap ${i + 1}`, why: "no job text" });
        return null;
      }
      return [job, pick(o.overlap, OVERLAP), cleanText(o.note) || " "];
    })
    .filter(Boolean);
  body.jobs_overlap = jobs.length ? [{ t: "table", head: ["Job", "Overlap", "Note"], rows: jobs }] : [gap("jobs_overlap")];

  // openings and risks: text plus cites (their side, or a file in your repository)
  const citedList = (key, field, prefix) =>
    listField(cmp, key, label, { strings: true })
      .map((r, i) => {
        const o = typeof r === "string" ? { [field]: r } : r;
        const id = `${prefix}${i + 1}`;
        const text = cleanText(o[field]);
        if (!text) {
          log.dropped.push({ row: id, why: `no ${field} text` });
          return null;
        }
        return [{ t: "strong", text: `${id}.` }, " ", text, " ", ...citedInline(citesOf(id, o.cites, { paths: true }))];
      })
      .filter(Boolean);
  const openings = citedList("openings", "opening", "P");
  body.openings = openings.length ? [{ t: "ul", items: openings }] : [gap("openings")];

  // pricing
  if (cmp.pricing === undefined || cmp.pricing === null) {
    body.pricing = [gap("pricing")];
  } else {
    if (typeof cmp.pricing !== "object" || Array.isArray(cmp.pricing)) throw new DraftError(`${label}.pricing must be an object with "them" and "you"`);
    const them = asObj(cmp.pricing.them);
    const you = asObj(cmp.pricing.you);
    const themText = cleanText(them.summary);
    const youText = cleanText(you.summary);
    body.pricing = [{
      t: "ul",
      items: [
        [{ t: "strong", text: "Them:" }, " ", themText || "not found on the fetched pages", " ", ...(themText ? citedInline(citesOf("pricing (them)", them.cites)) : [])],
        youText
          ? [{ t: "strong", text: "You:" }, " ", youText, " ", yourCite("pricing (you)", you.cite)]
          : [{ t: "strong", text: "You:" }, " ", { t: "label", text: "not answered", kind: "note" }],
      ],
    }];
  }

  // positioning: advice, as plain text
  const textList = (key) =>
    listField(cmp, key, label, { strings: true })
      .map((r) => cleanText(typeof r === "string" ? r : r.text))
      .filter(Boolean);
  const positioning = textList("positioning");
  body.positioning = positioning.length ? [{ t: "ol", items: positioning.map((s) => [s]) }] : [gap("positioning")];

  const risks = citedList("risks", "risk", "R");
  body.risks = risks.length ? [{ t: "ul", items: risks }] : [gap("risks")];

  // next steps: advice; an object step may carry cites like a risk
  const steps = listField(cmp, "next_steps", label, { strings: true })
    .map((r, i) => {
      const o = typeof r === "string" ? { text: r } : r;
      const text = cleanText(o.text);
      if (!text) return null;
      if (o.cites === undefined || o.cites === null) return [text];
      return [text, " ", ...citedInline(citesOf(`next step ${i + 1}`, o.cites, { paths: true }), { noLabel: true })];
    })
    .filter(Boolean);
  body.next_steps = steps.length
    ? [{ t: "p", inl: [{ t: "em", text: "Advice only. Nothing here has been done for you." }] }, { t: "ol", items: steps }]
    : [gap("next_steps")];

  // your side
  const facts = [];
  listField(cmp, "your_side", label).forEach((r, i) => {
    const id = `Y${i + 1}`;
    const fact = cleanText(r.fact);
    if (!fact) return log.dropped.push({ row: id, why: "no fact text" });
    facts.push([{ t: "strong", text: `${id}.` }, " ", fact, " ", yourCite(id, r.cite)]);
  });
  body.your_side = facts.length ? [{ t: "ul", items: facts }] : [gap("your_side")];

  // unanswered questions
  const open = textList("unanswered");
  body.unanswered = open.length
    ? [{ t: "ul", items: open.map((q) => [{ t: "label", text: "not answered", kind: "note" }, " ", q]) }]
    : [{ t: "p", inl: ["Every question was answered."] }];

  // sources
  const briefDate = a.generatedAt;
  const srcBlocks = [
    {
      t: "note",
      inl: [
        { t: "strong", text: "Note:" },
        ` competitor facts cite pages fetched for the brief dated ${briefDate.date} (generated_at ${briefDate.raw}). Your-side facts cite files in this repository, or what you said; the report checks that each cited file exists, not what it says.`,
      ],
    },
    ...recordTables(recs, { only: cited, fetchedTitle: "Brief pages cited here" }),
  ];
  if (unverified.length) {
    srcBlocks.push({ t: "h3", text: "Unverified your-side cites" });
    srcBlocks.push({ t: "table", head: ["Row", "Cite", "Why it is unverified"], rows: unverified.map((u) => [u.row, u.cite, u.why]) });
  }
  srcBlocks.push(...logTables(log));
  body.sources = srcBlocks;

  const sections = kit.sections.map((s) => ({ id: s.id, title: titles[s.id], blocks: body[s.id] }));
  const days = Math.floor((generatedAt.ms - briefDate.ms) / DAY_MS);
  const age =
    days < 0 ? "dated after this comparison; check the two dates" : days === 0 ? "the same day as this comparison" : `${days} day${days === 1 ? "" : "s"} before this comparison`;
  return {
    sections,
    generatedAt,
    briefLine: `Compared against the brief dated ${briefDate.date} (generated_at ${briefDate.raw}), ${age}.`,
    briefShort: `brief: dated ${briefDate.date} (${age})`,
    counts: {
      dropped: log.dropped.length,
      refused: recs.loud.length,
      gaps: countGaps(sections, ["sources", "unanswered"]),
      cites: tally,
    },
    refusedLines: recs.loud.map((r) => `REFUSED SOURCE RECORD ${shownUrl(r.urlText) || "(no URL)"}: ${r.guardReason}`),
  };
}

module.exports = { COMPARE_IDS, COMPARE_GAP_IDS, NO_SOURCE, isUrlCite, buildCompare };
