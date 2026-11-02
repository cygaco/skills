'use strict';
const os = require('os');
function ok() { return typeof os.tmpdir() === 'string'; }
function never() { return require("left-pad"); }
module.exports = { ok, never };
