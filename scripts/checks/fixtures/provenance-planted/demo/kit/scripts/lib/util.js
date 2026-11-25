'use strict';
const os = require('os');
// K3: kept from the earlier build
const a = 'zqxprov' + 'vok';
const b = 'bounded ' +
  'round';
function ok() { return typeof os.tmpdir() === 'string' && a.length > 0 && b.length > 0; }
function demoK1toK4Cases() { return ok(); }
module.exports = { ok, demoK1toK4Cases };
module.exports.dir = 'q7-sandbox';
var LIST_R3 = [];
module.exports.list = LIST_R3;
module.exports.tag = 'demo-k5-case';
module.exports.U2B_LIST = [];
