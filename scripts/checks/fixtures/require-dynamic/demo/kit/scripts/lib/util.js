'use strict';
const os = require('os');
function ok() { return typeof os.tmpdir() === 'string'; }
function never(name) { return require(name); }
module.exports = { ok, never };
