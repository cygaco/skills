"use strict";
/**
 * lib/brief.js - turns an analysed draft into the brief's sections (the block
 * model in lib/blocks.js), plus the counts report.js prints.
 */

const { INFERRED, GAP_DASH, shownUrl } = require("./text");
const { countGaps } = require("./blocks");
const { citeKey } = require("./guard");

const BRIEF_IDS = ["product_identity", "jtbds", "features", "voc", "gaps", "opportunities", "source_attribution_log"];

const CEILING = "every quote cites a page this session fetched; the engine cannot prove the quote is on that page.";

const link = (rec) => ({ t: "link", label: rec.id, href: rec.href });

/** "(sources: S1, S2)" as links, or the visible "inferred, no source" label. */
function sourcesOrLabel(sources) {
  if (!sources.length) return [{ t: "label", text: INFERRED, kind: "inferred" }];
  const out = ["(sources: "];
  sources.forEach((r, i) => {
    if (i) out.push(", ");
    out.push(link(r));
  });
  out.push(")");
  return out;
}

function sourceCell(sources) {
  if (!sources.length) return [{ t: "label", text: INFERRED, kind: "inferred" }];
  const out = [];
  sources.forEach((r, i) => {
    if (i) out.push(", ");
    out.push(link(r));
  });
  return out;
}

/** The target's site: a link only when it is an ok, checked source record. */
function siteInline(target, recs) {
  if (!target.urlText) return ["not stated"];
  if (!target.guard.ok) return [shownUrl(target.urlText), " ", { t: "label", text: "refused by the URL check", kind: "refused" }];
  const rec = recs.okByKey.get(citeKey(target.guard.href));
  if (rec) return [{ t: "link", label: target.guard.href, href: rec.href }];
  return [target.guard.href, " ", { t: "label", text: "not a fetched page", kind: "note" }];
}

/** The Source Attribution Log, shared in part with the comparison. */
function recordTables(recs, opts) {
  const blocks = [];
  const okRecs = recs.list.filter((r) => r.ok && (!opts.only || opts.only.has(r.id)));
  blocks.push({ t: "h3", text: opts.fetchedTitle || "Fetched" });
  if (okRecs.length) {
    blocks.push({
      t: "table",
      head: ["#", "Source", "Class", "Length", "Retrieved"],
      rows: okRecs.map((r) => [r.id, { t: "link", label: r.href, href: r.href }, r.sourceClass, r.length || " ", r.retrievedAt || " "]),
    });
  } else {
    blocks.push({ t: "p", inl: [opts.only ? "No fetched page is cited in this comparison." : "No page was fetched successfully."] });
  }
  if (!opts.only) {
    // Records that are not ok and not loud, split by what happened to them:
    // the URL check refused them before any fetch, the fetch itself failed
    // (an HTTP 403, a timeout), or the status is missing or not one we know.
    const quiet = recs.list.filter((r) => !r.ok && !r.loud);
    const groups = [
      ["Refused by the URL check (not fetched)", quiet.filter((r) => r.status === "refused"), false],
      ["Fetch failed", quiet.filter((r) => r.status === "failed"), true],
      ["Other records (status missing or not recognised)", quiet.filter((r) => r.status !== "refused" && r.status !== "failed"), true],
    ];
    for (const [title, list, linkable] of groups) {
      if (!list.length) continue;
      blocks.push({ t: "h3", text: title });
      blocks.push({
        t: "table",
        head: ["#", "URL", "Class", "Status", "Reason"],
        rows: list.map((r) => [
          r.id,
          linkable && r.guardOk ? { t: "link", label: r.href, href: r.href } : shownUrl(r.urlText) || "(no URL)",
          r.sourceClass,
          r.status,
          r.reason || (r.guardOk ? " " : `refused by the URL check: ${r.guardReason}`),
        ]),
      });
    }
  }
  if (recs.loud.length) {
    blocks.push({ t: "h3", text: "Refused source records" });
    blocks.push({
      t: "p",
      inl: [
        { t: "strong", text: "Warning:" },
        " these source records fail the URL check. They are not rendered as sources and no row may cite them. Each one means a fetch happened that should not have.",
      ],
    });
    blocks.push({
      t: "table",
      head: ["#", "URL (not a link)", "Status", "Why it is refused"],
      rows: recs.loud.map((r) => [r.id, shownUrl(r.urlText) || "(no URL)", r.status, r.guardReason]),
    });
  }
  return blocks;
}

function logTables(log) {
  const blocks = [];
  if (log.dropped.length) {
    blocks.push({ t: "h3", text: "Dropped rows" });
    blocks.push({ t: "table", head: ["Row", "Why it was dropped"], rows: log.dropped.map((d) => [d.row, d.why]) });
  }
  if (log.ignored.length) {
    blocks.push({ t: "h3", text: "Ignored cites" });
    blocks.push({ t: "table", head: ["Row", "Cite", "Why it does not count"], rows: log.ignored.map((d) => [d.row, d.cite, d.why]) });
  }
  return blocks;
}

/**
 * Builds the brief. `kit` holds the section titles and the [GAP] defaults.
 * Returns { sections, counts, refusedLines, vars }.
 */
function buildBrief(a, kit) {
  const { target, recs, rows, identity, generatedAt } = a;
  const titles = Object.fromEntries(kit.sections.map((s) => [s.id, s.title]));
  const gap = (id) => ({ t: "p", inl: [{ t: "gap", text: kit.defaults[id] }] });
  const body = {};

  // 01 product identity
  const idBlocks = [
    {
      t: "ul",
      items: [
        [{ t: "strong", text: "Name:" }, " ", target.name],
        [{ t: "strong", text: "Site:" }, " ", ...siteInline(target, recs)],
        [{ t: "strong", text: "Identified via:" }, " ", target.resolvedVia || "not stated"],
      ],
    },
  ];
  if (identity.absent) {
    idBlocks.push(gap("product_identity"));
  } else if (identity.missing) {
    idBlocks.push({ t: "p", inl: [{ t: "gap", text: `[GAP ${GAP_DASH} identity ${GAP_DASH} ${identity.missing}]` }] });
  } else {
    idBlocks.push({ t: "p", inl: [{ t: "strong", text: "Summary:" }, " ", identity.summary, " ", ...sourcesOrLabel(identity.sources)] });
  }
  body.product_identity = idBlocks;

  // 02 jobs to be done
  body.jtbds = rows.jtbds.length
    ? [{
      t: "ul",
      items: rows.jtbds.map((r) => [{ t: "strong", text: `${r.id}. ${r.job}` }, r.why ? ` ${GAP_DASH} ${r.why} ` : " ", ...sourcesOrLabel(r.sources)]),
    }]
    : [gap("jtbds")];

  // 03 features
  body.features = rows.features.length
    ? [{
      t: "table",
      head: ["ID", "Feature", "Description", "Complexity", "Core (1-5)", "Source"],
      rows: rows.features.map((r) => [r.id, r.name, r.description || " ", r.complexity, r.coreness, sourceCell(r.sources)]),
    }]
    : [gap("features")];

  // 04 voice of customer
  body.voc = rows.voc.length
    ? [{
      t: "table",
      head: ["ID", "Quote", "Sentiment", "Source", "Retrieved"],
      rows: rows.voc.map((r) => [r.id, `"${r.quote}"`, r.sentiment, sourceCell(r.sources), r.retrieved || " "]),
    }]
    : [gap("voc")];

  // 05 gaps
  body.gaps = rows.gaps.length
    ? [{
      t: "table",
      head: ["ID", "Gap", "Severity", "Source"],
      rows: rows.gaps.map((r) => [r.id, r.gap, r.severity, sourceCell(r.sources)]),
    }]
    : [gap("gaps")];

  // 06 opportunities
  body.opportunities = rows.opportunities.length
    ? [{
      t: "ul",
      items: rows.opportunities.map((r) => {
        const inl = [{ t: "strong", text: `${r.id}.` }, " ", r.text, " "];
        if (r.buildsOn.length) inl.push(`(builds on ${r.buildsOn.join(", ")}) `);
        if (r.sources.length) inl.push(...sourcesOrLabel(r.sources));
        else if (!r.sourced) inl.push({ t: "label", text: INFERRED, kind: "inferred" });
        return inl;
      }),
    }]
    : [gap("opportunities")];

  // 07 source attribution log
  const logBlocks = [{ t: "note", inl: [{ t: "strong", text: "Note:" }, ` ${CEILING}`] }];
  if (!recs.list.length) logBlocks.push({ t: "p", inl: ["No source records in the draft."] });
  else logBlocks.push(...recordTables(recs, {}));
  if (target.urlText && !target.guard.ok) {
    logBlocks.push({ t: "p", inl: [{ t: "strong", text: "Warning:" }, ` the target URL fails the URL check (${target.guard.reason}) and is shown as plain text.`] });
  }
  logBlocks.push(...logTables(rows.log));
  body.source_attribution_log = logBlocks;

  const sections = kit.sections.map((s) => ({ id: s.id, title: titles[s.id], blocks: body[s.id] }));
  const inferred =
    rows.jtbds.filter((r) => !r.sources.length).length +
    rows.gaps.filter((r) => !r.sources.length).length +
    rows.opportunities.filter((r) => !r.sourced).length;
  const counts = {
    dropped: rows.log.dropped.length,
    refused: recs.loud.length,
    gaps: countGaps(sections, ["source_attribution_log"]),
    inferred,
    fetched: recs.list.filter((r) => r.ok).length,
  };
  const refusedLines = recs.loud.map((r) => `REFUSED SOURCE RECORD ${shownUrl(r.urlText) || "(no URL)"}: ${r.guardReason}`);
  if (target.urlText && !target.guard.ok) refusedLines.push(`REFUSED TARGET URL ${shownUrl(target.urlText)}: ${target.guard.reason}`);
  return { sections, counts, refusedLines, generatedAt };
}

module.exports = { BRIEF_IDS, CEILING, buildBrief, recordTables, logTables, sourcesOrLabel, sourceCell };
