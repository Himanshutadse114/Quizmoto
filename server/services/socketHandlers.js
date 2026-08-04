/* Auto-generated emergency restore loader — full handlers decoded from chunks */
const parts = [
  require('./socketHandlers.chunk0'),
  require('./socketHandlers.chunk1'),
  require('./socketHandlers.chunk2'),
  require('./socketHandlers.chunk3'),
  require('./socketHandlers.chunk4'),
  require('./socketHandlers.chunk5'),
  require('./socketHandlers.chunk6')
];
const code = Buffer.from(parts.join(''), 'base64').toString('utf8');
const Module = require('module');
const m = new Module(__filename, module.parent);
m.filename = __filename;
m.paths = module.paths;
m._compile(code, __filename);
module.exports = m.exports;
