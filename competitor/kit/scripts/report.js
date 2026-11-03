#!/usr/bin/env node
"use strict";
/**
 * report.js - the /competitor kit's only command-line tool. It checks targets
 * and URLs, and renders reports from draft files. It makes no network calls
 * and starts no processes: the research happens in Claude's own web tools.
 *
 *   node report.js check --target "<name or URL>"
 *   node report.js check-url "<url>" ["<url>" ...]
 *   node report.js brief --draft <draft.json> [--repo-root <dir>]
 *   node report.js compare --draft <compare.json> --brief <draft.json> [--repo-root <dir>]
 *
 * Exit codes: 0 done; 2 refused, bad draft or usage error; 1 unexpected error
 * (a missing or broken template is one, and nothing is written).
 *
 * Reports are written only to <repo>/competitor/<slug>/; the repo root is the
 * current folder unless --repo-root says otherwise. Templates are read from the
 * templates/ folder next to this scripts/ folder.
 */

const fs = require("fs");
const path = require("path");
const { checkUrl } = require("./lib/guard");
const { normalizeSlug, refuseSlug, refuseName, slugFromHost } = require("./lib/slug");
const { mdText, htmlText, printable, shownUrl } = require("./lib/text");
const { TemplateError, loadKit, renderTemplate } = require("./lib/templates");
const { mdInline, htmlInline, renderSectionsMd, renderSectionsHtml } = require("./lib/blocks");
const { RefusedError, OUT_FOLDER, prepareOutput } = require("./lib/confine");
const { DraftError, readJsonFile, analyzeDraft } = require("./lib/draft");
const { BRIEF_IDS, buildBrief } = require("./lib/brief");
const { COMPARE_IDS, COMPARE_GAP_IDS, buildCompare } = require("./lib/compare");

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

const USAGE = [
  "usage:",
  '  node report.js check --target "<name or URL>"',
  '  node report.js check-url "<url>" ["<url>" ...]',
  "  node report.js brief --draft <draft.json> [--repo-root <dir>]",
  "  node report.js compare --draft <compare.json> --brief <draft.json> [--repo-root <dir>]",
  "exit codes: 0 done; 2 refused, bad draft or usage error; 1 unexpected error (nothing written)",
].join("\n");

class UsageError extends Error {}

const SPEC = {
  check: { flags: ["target"], required: ["target"], positionals: false },
  "check-url": { flags: [], required: [], positionals: true },
  brief: { flags: ["draft", "repo-root"], required: ["draft"], positionals: false },
  compare: { flags: ["draft", "brief", "repo-root"], required: ["draft", "brief"], positionals: false },
};

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd) throw new UsageError("no subcommand given");
  const spec = SPEC[cmd];
  if (!spec) throw new UsageError(`unknown subcommand: ${printable(cmd)}`);
  const flags = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (!spec.flags.includes(name)) throw new UsageError(`unknown flag for ${cmd}: --${printable(name)}`);
      if (Object.prototype.hasOwnProperty.call(flags, name)) throw new UsageError(`--${name} given twice`);
      let value;
      if (eq > 0) value = a.slice(eq + 1);
      else {
        if (i + 1 >= rest.length) throw new UsageError(`--${name} needs a value`);
        value = rest[++i];
      }
      flags[name] = value;
    } else if (spec.positionals) {
      positionals.push(a);
    } else {
      throw new UsageError(`unexpected argument for ${cmd}: ${printable(a)}`);
    }
  }
  for (const r of spec.required) {
    if (typeof flags[r] !== "string" || !flags[r].trim()) throw new UsageError(`${cmd} needs --${r}`);
  }
  if (spec.positionals && !positionals.length) throw new UsageError(`${cmd} needs at least one URL`);
  return { cmd, flags, positionals };
}

function repoRootOf(flags, cwd) {
  const root = path.resolve(cwd, flags["repo-root"] || ".");
  let st;
  try {
    st = fs.statSync(root);
  } catch (e) {
    throw new UsageError("--repo-root does not exist");
  }
  if (!st.isDirectory()) throw new UsageError("--repo-root is not a folder");
  return root;
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join("/");
const finish = (s) => s.replace(/\r\n/g, "\n").replace(/\n*$/, "\n");

// ---------------------------------------------------------------- check

function cmdCheck(flags, io) {
  const text = flags.target.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/\s/.test(text)) {
    const g = checkUrl(text);
    if (!g.ok) {
      io.out(`refused: ${g.reason}`);
      return 2;
    }
    const slug = slugFromHost(g.hostname);
    const why = refuseSlug(slug);
    if (why) {
      io.out(`refused: ${why}`);
      return 2;
    }
    io.out(`slug: ${slug}`);
    io.out(`url: ${g.href}`);
    return 0;
  }
  const whyName = refuseName(text);
  if (whyName) {
    io.out(`refused: ${whyName}`);
    return 2;
  }
  const slug = normalizeSlug(text.replace(/^www\./i, ""));
  const why = refuseSlug(slug);
  if (why) {
    io.out(`refused: ${why}`);
    return 2;
  }
  io.out(`slug: ${slug}`);
  return 0;
}

function cmdCheckUrl(positionals, io) {
  let refused = 0;
  for (const u of positionals) {
    const g = checkUrl(u);
    const shown = shownUrl(String(u)) || "(empty)";
    if (g.ok) io.out(`ok ${shown}`);
    else {
      refused++;
      io.out(`refused ${shown}: ${g.reason}`);
    }
  }
  return refused ? 2 : 0;
}

// ---------------------------------------------------------------- brief + compare

function draftFolderNote(draftAbs, root, slug, io) {
  const folder = path.basename(path.dirname(draftAbs));
  const parent = path.dirname(path.dirname(draftAbs));
  if (path.resolve(parent) === path.resolve(root, OUT_FOLDER) && folder !== slug) {
    io.err(`note: the draft is in ${OUT_FOLDER}/${folder}/ but its target gives the slug "${slug}"; set target.slug to "${folder}" to keep them together`);
  }
}

function writeOutputs(root, slug, names, contents) {
  const { files } = prepareOutput(root, slug, names);
  files.forEach((f, i) => fs.writeFileSync(f, finish(contents[i]), "utf8"));
  return files.map((f) => rel(root, f));
}

function metaInline(a, counts) {
  const { target } = a;
  const site = target.guard && target.guard.ok ? target.guard.href : target.urlText ? shownUrl(target.urlText) : "";
  return [
    { t: "strong", text: "Target:" },
    " ",
    target.name,
    site ? ` (${site})` : "",
    " - ",
    { t: "strong", text: "Brief date:" },
    ` ${a.generatedAt.date} - `,
    { t: "strong", text: "Sources:" },
    ` ${counts.fetched} fetched of ${a.recs.list.length} recorded`,
  ];
}

function cmdBrief(flags, io) {
  const root = repoRootOf(flags, io.cwd);
  const kit = loadKit(io.templatesDir, "brief", BRIEF_IDS, BRIEF_IDS.filter((id) => id !== "source_attribution_log"));
  const draftAbs = path.resolve(io.cwd, flags.draft);
  const a = analyzeDraft(readJsonFile(draftAbs, "draft", flags.draft), "draft");
  const model = buildBrief(a, kit);
  const slug = a.target.slug;
  for (const line of model.refusedLines) io.err(line);
  draftFolderNote(draftAbs, root, slug, io);

  const title = `${a.target.name} - competitor brief`;
  const meta = metaInline(a, model.counts);
  const common = { slug, generated_at: a.generatedAt.raw, brief_date: a.generatedAt.date, gap_count: String(model.counts.gaps) };
  const md = renderTemplate(kit.md, { ...common, title: mdText(title), meta: mdInline(meta), sections: renderSectionsMd(model.sections) }, kit.mdName);
  const html = renderTemplate(
    kit.html,
    { ...common, title: htmlText(title), meta: htmlInline(meta), sections: renderSectionsHtml(model.sections) },
    kit.htmlName,
  );
  const written = writeOutputs(root, slug, [`${slug}.competitor.md`, `${slug}.competitor.html`], [md, html]);
  const c = model.counts;
  io.out(`wrote ${written[0]}`);
  io.out(`wrote ${written[1]}`);
  io.out(`rows dropped: ${c.dropped}${c.dropped ? " (features and quotes need a fetched source; see the Source Attribution Log)" : ""}`);
  io.out(`records refused: ${c.refused}${c.refused ? " (fetched although the URL check refuses them; see the Source Attribution Log)" : ""}`);
  io.out(`gaps: ${c.gaps} [GAP] marker${c.gaps === 1 ? "" : "s"}`);
  io.out(`inferred, no source: ${c.inferred} row${c.inferred === 1 ? "" : "s"}`);
  return 0;
}

function cmdCompare(flags, io) {
  const root = repoRootOf(flags, io.cwd);
  const kit = loadKit(io.templatesDir, "compare", COMPARE_IDS, COMPARE_GAP_IDS);
  const cmp = readJsonFile(path.resolve(io.cwd, flags.draft), "compare.json", flags.draft);
  const briefAbs = path.resolve(io.cwd, flags.brief);
  const a = analyzeDraft(readJsonFile(briefAbs, "brief", flags.brief), "brief");
  const model = buildCompare(cmp, a, kit, root);
  const slug = a.target.slug;
  for (const line of model.refusedLines) io.err(line);
  draftFolderNote(briefAbs, root, slug, io);

  const title = `${a.target.name} - comparison with your project`;
  const common = { slug, generated_at: model.generatedAt.raw, brief_date: a.generatedAt.date, gap_count: String(model.counts.gaps) };
  const md = renderTemplate(
    kit.md,
    { ...common, title: mdText(title), brief_line: mdText(model.briefLine), sections: renderSectionsMd(model.sections) },
    kit.mdName,
  );
  const html = renderTemplate(
    kit.html,
    { ...common, title: htmlText(title), brief_line: htmlText(model.briefLine), sections: renderSectionsHtml(model.sections) },
    kit.htmlName,
  );
  const written = writeOutputs(root, slug, [`${slug}.compare.md`, `${slug}.compare.html`], [md, html]);
  const c = model.counts;
  io.out(`wrote ${written[0]}`);
  io.out(`wrote ${written[1]}`);
  io.out(model.briefShort);
  io.out(`your-side cites: ${c.cites.file} file${c.cites.file === 1 ? "" : "s"} verified, ${c.cites.said} you said, ${c.cites.unverified} unverified`);
  io.out(`rows dropped: ${c.dropped}`);
  io.out(`records refused: ${c.refused}${c.refused ? " (in the brief; see the Sources section)" : ""}`);
  return 0;
}

// ---------------------------------------------------------------- entry

/**
 * Runs one command. `io` may supply out/err line writers, the working folder
 * and the templates folder (the self-check uses these); the command line uses
 * the real streams, process.cwd() and the kit's own templates/.
 * Returns the exit code.
 */
function run(argv, ioIn) {
  const given = ioIn || {};
  const io = {
    out: given.out || ((s) => process.stdout.write(`${s}\n`)),
    err: given.err || ((s) => process.stderr.write(`${s}\n`)),
    cwd: given.cwd || process.cwd(),
    templatesDir: given.templatesDir || TEMPLATES_DIR,
  };
  try {
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help")) {
      io.out(USAGE);
      return 0;
    }
    const { cmd, flags, positionals } = parseArgs(argv);
    if (cmd === "check") return cmdCheck(flags, io);
    if (cmd === "check-url") return cmdCheckUrl(positionals, io);
    if (cmd === "brief") return cmdBrief(flags, io);
    return cmdCompare(flags, io);
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`usage error: ${e.message}`);
      io.err(USAGE);
      return 2;
    }
    if (e instanceof DraftError) {
      io.err(`bad draft: ${e.message}`);
      return 2;
    }
    if (e instanceof RefusedError) {
      io.out(`refused: ${e.message}`);
      return 2;
    }
    if (e instanceof TemplateError) {
      io.err(`error: ${e.message}`);
      return 1;
    }
    io.err(`error: unexpected failure (${e && e.code ? `${e.code}: ` : ""}${printable(e && e.message ? e.message : e)})`);
    return 1;
  }
}

module.exports = { run, parseArgs, USAGE, TEMPLATES_DIR };

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}
