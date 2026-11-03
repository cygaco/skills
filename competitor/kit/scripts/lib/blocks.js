"use strict";
/**
 * lib/blocks.js - one structured model of a report, rendered to Markdown and to
 * HTML. Neither renderer parses the other's output, so nothing is escaped twice
 * and no draft text is ever read as markup.
 *
 * Inline nodes: a plain string (draft or engine text), or
 *   { t: "link", label, href }     href already passed the URL check
 *   { t: "gap", text }             a [GAP ...] marker
 *   { t: "label", text, kind }     a visible label such as "inferred, no source"
 *   { t: "strong", text } / { t: "em", text }
 *   { t: "file", text }            a verified repo-relative file cite
 *   { t: "said" }                  a "you said" cite
 *   { t: "unverified", text, reason }
 * Block nodes:
 *   { t: "p", inl } { t: "note", inl } { t: "h3", text }
 *   { t: "ul", items: [inl] } { t: "ol", items: [inl] }
 *   { t: "table", head: [text], rows: [[inl]] }
 */

const { mdText, htmlText, htmlEscape, mdLink, htmlLink, mdCode, GAP_DASH, UNVERIFIED } = require("./text");

const asList = (inl) => (Array.isArray(inl) ? inl : [inl]);

function keepSpaces(raw, rendered) {
  const lead = /^\s/.test(raw) ? " " : "";
  const trail = /\s$/.test(raw) ? " " : "";
  if (!rendered) return lead || trail ? " " : "";
  return lead + rendered + trail;
}

// ---------------------------------------------------------------- Markdown

function mdNode(n, first) {
  if (n == null) return "";
  if (typeof n === "string") return keepSpaces(n, mdText(n, first));
  switch (n.t) {
    case "link":
      return mdLink(n.label, n.href);
    case "gap":
      return n.text;
    case "label":
      return `*${mdText(n.text)}*`;
    case "strong":
      return `**${mdText(n.text)}**`;
    case "em":
      return `*${mdText(n.text)}*`;
    case "file":
      return `file ${mdCode(n.text)}`;
    case "said":
      return "*you said*";
    case "unverified":
      return `**${UNVERIFIED}** ${mdText(n.text) || "(no cite)"}${n.reason ? ` (${mdText(n.reason)})` : ""}`;
    default:
      return "";
  }
}

function mdInline(inl) {
  return asList(inl).map((n, i) => mdNode(n, i === 0)).join("").replace(/ {2,}/g, " ").trim();
}

function mdBlock(b) {
  switch (b.t) {
    case "p":
      return mdInline(b.inl);
    case "note":
      return `> ${mdInline(b.inl)}`;
    case "h3":
      return `### ${mdText(b.text)}`;
    case "ul":
      return b.items.map((it) => `- ${mdInline(it)}`).join("\n");
    case "ol":
      return b.items.map((it, i) => `${i + 1}. ${mdInline(it)}`).join("\n");
    case "table": {
      const head = `| ${b.head.map((h) => mdText(h)).join(" | ")} |`;
      const sep = `|${b.head.map(() => "---").join("|")}|`;
      const rows = b.rows.map((r) => `| ${r.map((c) => mdInline(c) || " ").join(" | ")} |`);
      return [head, sep].concat(rows).join("\n");
    }
    default:
      return "";
  }
}

function renderSectionsMd(sections) {
  return sections
    .map((sec, i) => {
      const num = String(i + 1).padStart(2, "0");
      const body = sec.blocks.map(mdBlock).filter(Boolean).join("\n\n");
      return `## ${num} ${GAP_DASH} ${mdText(sec.title)}\n\n${body}\n`;
    })
    .join("\n");
}

// ---------------------------------------------------------------- HTML

function htmlNode(n) {
  if (n == null) return "";
  if (typeof n === "string") return keepSpaces(n, htmlText(n));
  switch (n.t) {
    case "link":
      return htmlLink(n.label, n.href);
    case "gap":
      return `<span class="gap-marker">${htmlEscape(n.text)}</span>`;
    case "label":
      return `<span class="label label-${htmlEscape(n.kind || "note")}">${htmlText(n.text)}</span>`;
    case "strong":
      return `<strong>${htmlText(n.text)}</strong>`;
    case "em":
      return `<em>${htmlText(n.text)}</em>`;
    case "file":
      return `<span class="cite cite-file">file <code>${htmlText(n.text)}</code></span>`;
    case "said":
      return '<span class="cite cite-said">you said</span>';
    case "unverified":
      return `<span class="label label-unverified">${UNVERIFIED}</span> <span class="cite cite-bad">${htmlText(n.text) || "(no cite)"}</span>${n.reason ? ` <span class="cite-reason">(${htmlText(n.reason)})</span>` : ""}`;
    default:
      return "";
  }
}

function htmlInline(inl) {
  return asList(inl).map(htmlNode).join("").replace(/ {2,}/g, " ").trim();
}

// Ported in spirit from the original generator: a table from header and body rows.
function renderTableHtml(head, rows) {
  const thead = `<thead><tr>${head.map((h) => `<th>${htmlText(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${htmlInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function htmlBlock(b) {
  switch (b.t) {
    case "p":
      return `<p>${htmlInline(b.inl)}</p>`;
    case "note":
      return `<p class="note">${htmlInline(b.inl)}</p>`;
    case "h3":
      return `<h3>${htmlText(b.text)}</h3>`;
    case "ul":
      return `<ul>${b.items.map((it) => `<li>${htmlInline(it)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol>${b.items.map((it) => `<li>${htmlInline(it)}</li>`).join("")}</ol>`;
    case "table":
      return renderTableHtml(b.head, b.rows);
    default:
      return "";
  }
}

function renderSectionsHtml(sections) {
  return sections
    .map((sec, i) => {
      const num = String(i + 1).padStart(2, "0");
      return [
        `<section id="${htmlEscape(sec.id)}">`,
        `  <div class="section-label">${num} &middot; ${htmlText(sec.title)}</div>`,
        `  <h2>${htmlText(sec.title)}</h2>`,
        ...sec.blocks.map((b) => `  ${htmlBlock(b)}`),
        "</section>",
      ].join("\n");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------- counting

function countGaps(sections, skipIds) {
  let n = 0;
  const visit = (x) => {
    if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === "object") {
      if (x.t === "gap") n++;
      for (const k of ["inl", "items", "rows"]) if (x[k]) visit(x[k]);
    }
  };
  for (const s of sections) if (!skipIds.includes(s.id)) visit(s.blocks);
  return n;
}

module.exports = { mdInline, htmlInline, mdBlock, htmlBlock, renderTableHtml, renderSectionsMd, renderSectionsHtml, countGaps };
