const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
module.exports = function projectModule(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    let absolute = path.resolve(root, file);
    if (!fs.existsSync(absolute) && fs.existsSync(absolute + '.ts')) absolute += '.ts';
    const key = path.relative(root, absolute).replaceAll('\\', '/');
    if (key in overrides) return overrides[key];
    if (cache.has(absolute)) return cache.get(absolute);
    if (absolute.endsWith('.json')) return JSON.parse(fs.readFileSync(absolute, 'utf8'));
    if (absolute.endsWith('.mjs')) return require(absolute);
    const exports = {}; cache.set(absolute, exports);
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(output, { exports, require: name => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name));
      throw new Error(`Unexpected dependency: ${name}`);
    }, setTimeout, clearTimeout, AbortController, URL, Date, Error, ...globals }, { filename: key });
    return exports;
  }
  return load;
};
