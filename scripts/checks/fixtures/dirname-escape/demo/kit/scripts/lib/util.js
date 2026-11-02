'use strict';
const os = require('os');
const path = require('path');
function ok() { return typeof os.tmpdir() === 'string'; }
function never() { return path.join(__dirname, '..', '..', '..', '..', 'outside'); }
module.exports = { ok, never };
