const parts = [
  require('./socketHandlers.p0'),
  require('./socketHandlers.p1'),
  require('./socketHandlers.p2'),
  require('./socketHandlers.p3')
];
const code = Buffer.from(parts.join(''), 'base64').toString('utf8');
const Module = require('module');
const m = new Module(__filename, module.parent);
m.filename = __filename;
m.paths = module.paths;
m._compile(code, __filename);
module.exports = m.exports;
