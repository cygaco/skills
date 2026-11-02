'use strict';
// Fixture control selfcheck. Every require here is either a builtin or inside the pack.
const fs = require('fs');
const path = require('node:path');
const util = require('./lib/util');
const name = 'util';
const again = require(`./lib/${name}`);
const guide = path.join(__dirname, '..', 'guides', 'guide.md');

// Text that only looks like code is not code: the walk must not count these.
const decoy = 'require("left-pad") and path.join(__dirname, "..", "..", "..", "..")';
const decoyRe = /require\("left-pad"\)|path\.join\(__dirname, '\.\.'\)/;

if (!fs.existsSync(guide) || util.ok() !== true || again !== util || !decoy || !decoyRe.test(decoy)) {
  console.error('selfcheck: FAIL');
  process.exit(1);
}
console.log('selfcheck: ok');
