"use strict";
/**
 * lib/templates.js - loads the report templates from the kit's templates/
 * folder. A missing or malformed template is an error, never a fallback.
 */

const fs = require("fs");
const path = require("path");
const { isGapText } = require("./text");

class TemplateError extends Error {}

function readTemplate(dir, name) {
  const file = path.join(dir, name);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new TemplateError(`template missing: templates/${name} (the kit is incomplete; copy the whole kit/ folder again)`);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readJsonTemplate(dir, name) {
  const text = readTemplate(dir, name);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new TemplateError(`template unreadable: templates/${name} is not valid JSON`);
  }
}

/**
 * Section list from sections.json / compare-sections.json. It must name exactly
 * the sections the engine knows, each once, with a title.
 */
function readSections(dir, name, knownIds) {
  const doc = readJsonTemplate(dir, name);
  const list = doc && Array.isArray(doc.sections) ? doc.sections : null;
  if (!list) throw new TemplateError(`template unreadable: templates/${name} has no "sections" list`);
  const seen = new Set();
  for (const s of list) {
    if (!s || typeof s.id !== "string" || typeof s.title !== "string" || !s.title.trim()) {
      throw new TemplateError(`template unreadable: templates/${name} has a section without an id and a title`);
    }
    if (!knownIds.includes(s.id)) throw new TemplateError(`template unreadable: templates/${name} lists an unknown section "${s.id}"`);
    if (seen.has(s.id)) throw new TemplateError(`template unreadable: templates/${name} lists "${s.id}" twice`);
    seen.add(s.id);
  }
  for (const id of knownIds) {
    if (!seen.has(id)) throw new TemplateError(`template unreadable: templates/${name} is missing the "${id}" section`);
  }
  return list.map((s) => ({ id: s.id, title: s.title.trim() }));
}

/** The [GAP ...] text shown for an empty section, per report kind. */
function readDefaults(dir, kind, ids) {
  const name = "section-defaults.json";
  const doc = readJsonTemplate(dir, name);
  const block = doc && doc[kind];
  if (!block || typeof block !== "object") throw new TemplateError(`template unreadable: templates/${name} has no "${kind}" block`);
  const out = {};
  for (const id of ids) {
    if (!isGapText(block[id])) {
      throw new TemplateError(`template unreadable: templates/${name} ${kind}.${id} must be one line shaped [GAP ...]`);
    }
    out[id] = block[id];
  }
  return out;
}

/** Single-pass {{name}} substitution; inserted values are never scanned again. */
function renderTemplate(tmpl, vars, name) {
  if (!tmpl.includes("{{sections}}")) throw new TemplateError(`template unreadable: templates/${name} has no {{sections}} placeholder`);
  return tmpl.replace(/\{\{([a-z_]+)\}\}/g, (m, key) => (Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""));
}

const BRIEF_FILES = ["brief.md.tmpl", "brief.html.tmpl", "sections.json", "section-defaults.json"];
const COMPARE_FILES = ["compare.md.tmpl", "compare.html.tmpl", "compare-sections.json", "section-defaults.json"];

/** Loads everything one report kind needs, before anything is written. */
function loadKit(dir, kind, knownIds, gapIds) {
  const files = kind === "brief" ? BRIEF_FILES : COMPARE_FILES;
  for (const f of files) readTemplate(dir, f); // fail on the first missing file
  const kit = {
    md: readTemplate(dir, files[0]),
    html: readTemplate(dir, files[1]),
    mdName: files[0],
    htmlName: files[1],
    sections: readSections(dir, files[2], knownIds),
    defaults: readDefaults(dir, kind, gapIds),
  };
  for (const [tmpl, name] of [[kit.md, kit.mdName], [kit.html, kit.htmlName]]) {
    if (!tmpl.includes("{{sections}}")) throw new TemplateError(`template unreadable: templates/${name} has no {{sections}} placeholder`);
  }
  return kit;
}

module.exports = { TemplateError, loadKit, renderTemplate, readTemplate, BRIEF_FILES, COMPARE_FILES };
