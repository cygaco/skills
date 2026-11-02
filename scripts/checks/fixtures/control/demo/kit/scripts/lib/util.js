'use strict';
const os = require('os');
function ok() { return typeof os.tmpdir() === 'string'; }
module.exports = { ok };
