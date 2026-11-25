#!/usr/bin/env node
'use strict';
// SessionStart hook (startup, resume, clear and compact). Rebuilds the index and map when
// a skill file changed or new misses were logged, then adds the compact skill map to the
// session once. With "map": false in .claude/plain/config.json it only refreshes the index.
// Never blocks: any error or PLAIN_OFF=1 exits 0 with no output.
const fs = require('fs');

function readStdin() {
  return new Promise((resolve) => {
    let s = '';
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(s); } };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { s += d; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 1000);
  });
}

async function main() {
  if (process.env.PLAIN_OFF === '1') return;
  const raw = await readStdin();
  let event = {};
  try { event = JSON.parse(raw) || {}; } catch { /* run with defaults */ }
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const core = require('./lib/core.js');
  const { readCatalog } = require('./lib/catalog.js');
  const misslog = require('./lib/misslog.js');
  let stored = core.load(root);
  const catalog = readCatalog(root);
  let logTime = 0;
  try { logTime = fs.statSync(misslog.logFile(root)).mtimeMs; } catch { /* no log yet */ }
  const cfg = core.readConfig(root);
  const stale = !stored || stored.fingerprint !== catalog.fingerprint || stored.configHash !== core.configHash(cfg) || (logTime && logTime > Date.parse(stored.builtAt));
  if (stale) stored = core.build(root, { catalog });
  if (cfg.map === false || !stored || !stored.map || !stored.map.text || !stored.skills.length) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: stored.map.text } }));
}

main().catch(() => {}).then(() => process.exit(0));
