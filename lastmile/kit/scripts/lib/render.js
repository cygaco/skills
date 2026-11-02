"use strict";
/**
 * lib/render.js — tiny template renderer + file writer for review.js / plan.js.
 *
 * Templates ship in the kit at templates/<basename>.tmpl.md (installed as
 * .claude/lastmile/templates/). Each template uses a small fixed variable set
 * ({{title}}, {{generated_at}}, {{profile}}, {{summary}}, {{body}}) so the
 * templates stay trivial and stable while the scripts own the content.
 *
 * A missing or unreadable template is an ERROR, never a silent substitute: the
 * kit is incomplete and the user should reinstall it. The calling script turns
 * the thrown error into exit code 1 with a one-line message.
 */

const fs = require("fs");
const path = require("path");

// scripts/lib → the kit root is two levels up (kit/scripts/lib → kit).
const KIT_ROOT = path.join(__dirname, "..", "..");
const TEMPLATE_DIR = path.join(KIT_ROOT, "templates");

class TemplateMissingError extends Error {}

function templatePath(basename) {
  return path.join(TEMPLATE_DIR, `${basename}.tmpl.md`);
}

function fillTemplate(basename, vars) {
  const file = templatePath(basename);
  let tmpl;
  try {
    tmpl = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new TemplateMissingError(
      `template missing: templates/${basename}.tmpl.md was not found in the kit (${e.code || e.message}). ` +
        "Reinstall the kit folder to .claude/lastmile/ and run again.",
    );
  }
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

// Write a document to an absolute path, creating its folder.
function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, "utf8");
  return absPath;
}

// A forward-slash relative link from the folder holding `fromFile` to `toFile`.
function relLink(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
  return rel || path.basename(toFile);
}

function nowIso() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  fillTemplate,
  writeFile,
  relLink,
  nowIso,
  templatePath,
  TemplateMissingError,
  TEMPLATE_DIR,
  KIT_ROOT,
};
