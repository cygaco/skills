'use strict';
const os = require('os');
function ok() { return typeof os.tmpdir() === 'string'; }
function never() { return require('../../../../outside.js'); }
function alsoNever() { return require('../../../../.pack-meta/pack.json'); }
module.exports = { ok, never, alsoNever };
