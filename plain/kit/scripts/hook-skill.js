#!/usr/bin/env node
'use strict';
// PreToolUse hook for the Skill tool: the ask-first guard. Deny-only: a Skill call for an
// ask-first skill (one that pushes, deletes, deploys or spends) is ALWAYS denied, whatever
// the user's message said. There is no allow path. The denial tells the model to give the
// user the exact /command to type: a command the user types is expanded by Claude Code
// itself and never reaches this hook, so typing it is how an ask-first skill runs.
// Ask-first is judged from disk at call time (lib/catalog.js askFirstLive: the skill's flag,
// full name and full description) plus the config's confirmFirst list. Every uncertain path
// denies too: an unreadable call, no skill name, an unreadable or broken config, an
// unreadable skill file, a guard error, and any unexpected failure of this process (exit 2,
// which Claude Code treats as a block). Skills that are not ask-first pass untouched when
// everything could be read. PLAIN_OFF=1 turns it off.
const MAX_STDIN = 4 << 20;
const SLUG_OK = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,63}$/;

// Any failure outside the decision itself blocks the call. Exit 2 with the reason on stderr
// is a block for a PreToolUse hook, and needs nothing else from this process to work.
const FATAL = 'The ask-first check could not run, so this skill call is blocked. Do not retry it. Tell the user to type the slash command themselves, or run /plain to check the pack.';
let settled = false;
function fatal() {
  if (settled) return;
  settled = true;
  try { process.stderr.write(`${FATAL}\n`); } catch { /* the exit code alone still blocks */ }
  process.exit(2);
}

function readStdin() {
  return new Promise((resolve) => {
    let s = '';
    let done = false;
    let over = false;
    const finish = () => { if (!done) { done = true; resolve({ s, over }); } };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { if (over) return; s += d; if (s.length > MAX_STDIN) { over = true; s = ''; } });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 3000);
  });
}

const deny = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
// The skill name is shown only when it is a plain identifier; anything else is not echoed.
const cmdOf = (slug) => (SLUG_OK.test(slug) ? `/${slug}` : 'the slash command');
const userTypes = (slug) => `Tell the user: plain language does not start ${cmdOf(slug)} (it changes something outside this project); to run it, type ${cmdOf(slug)} yourself, with your arguments.`;
const askText = (slug) => `${cmdOf(slug)} is an ask-first skill: it changes something outside this project, so it never starts from plain language. Do not retry it or another ask-first skill. ${userTypes(slug)}`;

function logDenial(root, slug, reason) {
  try { require('./lib/misslog.js').append(root, { ts: new Date().toISOString(), outcome: 'denied', skill: String(slug || '').slice(0, 64), reason: String(reason).slice(0, 200) }); } catch { /* logging never decides */ }
}

// null = no decision (the call proceeds); otherwise a deny object.
function decide(event, root) {
  if (!event || typeof event !== 'object' || event.tool_name !== 'Skill') return null;
  const slug = String((event.tool_input && event.tool_input.skill) || '').replace(/^\//, '').trim();
  if (!slug) { logDenial(root, '', 'no skill name'); return deny('The Skill call names no skill, so it is blocked. Ask the user which skill they want.'); }
  const core = require('./lib/core.js');
  const { askFirstLive } = require('./lib/catalog.js');
  let cfg;
  try { cfg = core.readConfigStrict(root); } catch {
    logDenial(root, slug, 'config unreadable');
    return deny(`The plain pack's settings file (.claude/plain/config.json) cannot be read, so skills are blocked. Do not retry. Tell the user to fix that file or run /plain; a skill they type themselves still runs.`);
  }
  const live = askFirstLive(root, slug);
  if (live.unreadable) {
    logDenial(root, slug, 'skill file unreadable');
    return deny(`The skill file for ${cmdOf(slug)} could not be read, so it is treated as ask-first and blocked. Do not retry it or another ask-first skill. ${userTypes(slug)}`);
  }
  const listed = Array.isArray(cfg.confirmFirst) && cfg.confirmFirst.map((x) => String(x).toLowerCase()).includes(slug.toLowerCase());
  if (!live.askFirst && !listed) return null;
  logDenial(root, slug, 'ask-first');
  return deny(askText(slug));
}

async function main() {
  if (process.env.PLAIN_OFF === '1') return;
  const { s, over } = await readStdin();
  let event = null;
  if (!over) { try { event = JSON.parse(s); } catch { event = null; } }
  const root = process.env.CLAUDE_PROJECT_DIR || (event && typeof event === 'object' && event.cwd) || process.cwd();
  let out;
  if (!event || typeof event !== 'object') {
    // this hook is installed for the Skill tool only: a call it cannot read is blocked
    out = deny('The Skill call could not be read, so it is blocked. Do not retry it. Tell the user to type the slash command themselves.');
    logDenial(root, '', 'call unreadable');
  } else {
    try { out = decide(event, root); } catch {
      out = deny('The ask-first check could not run, so this skill call is blocked. Do not retry it. Tell the user to type the slash command themselves, or run /plain to check the pack.');
      logDenial(root, event.tool_input && event.tool_input.skill, 'guard error');
    }
  }
  if (out) process.stdout.write(JSON.stringify(out));
}

if (require.main === module) {
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
  // PLAIN_FAULT=1 makes the process fail on purpose, so the self-check can prove a failure blocks.
  if (process.env.PLAIN_FAULT === '1') throw new Error('fault');
  main().then(() => { settled = true; process.exit(0); }, fatal);
}

module.exports = { decide };
