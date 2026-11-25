#!/usr/bin/env node
'use strict';
/*
 * verdict.js: read a twin reply, or run the red-line screen on a question. Writes nothing.
 *
 *   node .claude/twin/scripts/verdict.js parse --file <inbox file>    {"reply": "..."}
 *   node .claude/twin/scripts/verdict.js screen --file <inbox file>   {"text": "..."}
 *
 * The input is one JSON object (templates/formats.md, "Input files"), from --file or
 * stdin; an inbox file is read once and then deleted. --file takes no other path: any
 * other is refused by its text (exit 2), never read or deleted.
 * parse prints the normalized fields (exit 0), or `unreadable: <reason>`
 * (exit 3). screen prints `pass` (exit 0), or `ask-user: <the phrase it matched>`
 * (exit 3).
 */

const { EXIT, NOT_ROOT, cliIo, normIo, atRoot, parseFlags, wantsHelp, readJsonInput, guarded } = require('./lib/cli');
const { parse } = require('./lib/verdict');
const { screen } = require('./lib/redlines');

const USAGE = `usage: node .claude/twin/scripts/verdict.js <command>

  parse --file <inbox file>       read a twin reply, {"reply": "..."}, and print its fields
  screen --file <inbox file>      run the red-line screen on {"text": "..."}

Claude runs ledger.js inbox and writes the inbox file it printed with its own
file-writing tool; the script reads that file once and deletes it (--file takes no
other path: any other is refused, exit 2). The same JSON is also read from stdin. Run it from your repository's
root folder. Apart from deleting the inbox file it read, it writes nothing.
Exit: 0 readable / pass, 2 usage error, 3 ask the user (an unreadable reply, or a
question the screen matched).`;

// Each command and the options it takes (the command text in commands/twin.md uses these).
const SPECS = { parse: { value: ['--file'] }, screen: { value: ['--file'] } };
// The key of each JSON input (templates/formats.md, "Input files").
const KEYS = { parse: ['reply'], screen: ['text'] };

function main(argv, ioIn) {
  const io = normIo(ioIn, __dirname);
  return guarded(io, () => {
    if (wantsHelp(argv)) {
      io.out(USAGE);
      return EXIT.OK;
    }
    const cmd = argv[0];
    if (!cmd || !Object.prototype.hasOwnProperty.call(SPECS, cmd)) {
      io.err(cmd ? `unknown command: ${cmd}` : 'no command given');
      io.err(USAGE);
      return EXIT.REFUSED;
    }
    const a = parseFlags(argv.slice(1), SPECS[cmd]);
    if (a.error) {
      io.err(`usage: ${a.error}`);
      return EXIT.REFUSED;
    }
    if (!atRoot(io)) {
      io.err(`refused: ${NOT_ROOT}`);
      return EXIT.REFUSED;
    }
    const input = readJsonInput(io, io.cwd, a.flags['--file'], KEYS[cmd]);
    if (cmd === 'screen') {
      const s = screen(input.text);
      io.out(s.ask ? `ask-user: ${s.term}` : 'pass');
      return s.ask ? EXIT.ASK : EXIT.OK;
    }
    const p = parse(input.reply);
    if (!p.ok) {
      io.out(`unreadable: ${p.reason}`);
      return EXIT.ASK;
    }
    // Every printed line is redacted by io.out (lib/cli.js).
    for (const [k, v] of Object.entries(p.fields)) io.out(`${k}: ${v.replace(/\n/g, '\n  ')}`);
    return EXIT.OK;
  });
}

module.exports = { main, SPECS, KEYS, USAGE };

if (require.main === module) process.exitCode = main(process.argv.slice(2), cliIo(__dirname));
