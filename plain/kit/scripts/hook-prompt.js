#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook. Adds at most one short block of context: the skill the user named
// without its slash (name layer), or up to three candidates when the local ranker is
// confident (hint layer). Otherwise it adds nothing. It keeps no record for the ask-first
// guard: that guard denies every ask-first Skill call whatever the message said.
// Never blocks a prompt: any error, a missing index or PLAIN_OFF=1 exits 0 with no output.
const MAX_STDIN = 4 << 20;

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

async function main() {
  if (process.env.PLAIN_OFF === '1') return;
  const { s, over } = await readStdin();
  let event = null;
  if (!over) { try { event = JSON.parse(s); } catch { event = null; } }
  if (!event || typeof event !== 'object') return;
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const prompt = String(event.prompt || '');
  const core = require('./lib/core.js');
  const misslog = require('./lib/misslog.js');
  const stored = core.load(root);
  const cfg = core.readConfig(root);
  const r = stored ? core.route(stored, prompt, cfg) : { layer: null, slugs: [], text: '' };
  misslog.settleAndRecord(root, event.transcript_path, prompt, r);
  if (r.text) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: r.text } }));
  }
}

main().catch(() => {}).then(() => process.exit(0));
