/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Long Wei
*/
//TODO devtool: hidden-source-map support
const loaderUtils = require('loader-utils');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const packageJson = require('./package.json');
const loaderName = packageJson.name || "compile-eval-loader";

function throwError(message) {
  const error = new Error()
  error.name = loaderName;
  error.message = error.name + '\n\n' + message + '\n';
  error.stack = false;
  console.error(error);
}

//https://github.com/webpack/webpack/issues/2090
function findEntry(mod) {
  if (mod.reasons.length > 0
    && mod.reasons[0].module
    && mod.reasons[0].module.resource
  ) {
    return findEntry(mod.reasons[0].module)
  }
  return mod;
}

function getEntryName(compiler, mod) {
  var entryName = "main";
  try {
    const optionsEntries = compiler.options.entry;
    const entryRawRequest = findEntry(mod).rawRequest;
    entryName = Object
      .keys(optionsEntries)
      .filter(key => {
        const value = optionsEntries[key];
        return typeof(value) === "string"
          ? value === entryRawRequest
          : Array.isArray(value)
          ? value.filter(item => item === entryRawRequest).length
          : false
      })[0] || entryName;
  }
  catch(e) {}
  return entryName
}

exports.pitch = function pitch(request) {
  if (!this.webpack) {
    throwError('This loader is only usable with webpack');
  }

  this.cacheable(false);

  const options = loaderUtils.getOptions(this) || {};
  const cb = this.async();
  const compiler = this._compiler;
  const compilation = this._compilation
  const childCompiler = compilation.createChildCompiler(
    loaderName,
    {
      //filename: childFilename,//filename is needed for singleton
      libraryTarget: "commonjs2", 
      //commonjs2 type module can be eval no matter webpack config mode is production or development
    },
    //(compiler.options.plugins || [])
  )
  //function createChildCompiler will apply plugins with a compiler whose options is empty object first, and some plugin need the options, so pass no plugins above and execute now
  //https://github.com/webpack/webpack/blob/master/lib/Compiler.js#L432 
  //since this loader will create child compiler immediately，entry info is missing, plugin will get a local name variable
  //if you want entry chunk name, set in options
  for(const plugin of (compiler.options.plugins || [])) {
    plugin.apply(childCompiler)
  }

  if (this.target !== 'webworker' && this.target !== 'web') {
    new NodeTargetPlugin().apply(childCompiler);
  }

  new SingleEntryPlugin(
    this.context,
    '!!' + request,
    //pass entryName, so [name] can be parsed as entryName
    getEntryName(childCompiler, this._module)
  ).apply(childCompiler);

  const entries = [];
  const subCache = 'subcache ' + __dirname + ' ' + request;
  childCompiler.hooks.compilation.tap(loaderName, childCompilation => {
    if (childCompilation.cache) {
      if (!childCompilation.cache[subCache]) {
        childCompilation.cache[subCache] = {};
      }
      childCompilation.cache = childCompilation.cache[subCache];
    }

    //store all entries
    childCompilation.mainTemplate.hooks.renderWithEntry.tap(
      loaderName,
      (source, chunk) => {
        entries.push({ source, chunk })
      }
    )
  })

  //it's different from compiler.runAsChild, no assets will be added to parent compiler
  //https://github.com/webpack/webpack/blob/master/lib/Compiler.js#L280
  childCompiler.compile((err, childCompilation) => {
    if (err) return cb(err);

    compilation.children.push(childCompilation);

    const currentChunk = childCompilation.chunks[0];
    const entry = entries.filter(entry => entry.chunk === currentChunk)[0];
    var entrySource = entry.source;

    if(entry.chunk) {
      try {
        entrySource = eval(entrySource.source()).default;

        if(typeof(entrySource) === "string") {
          entrySource = entrySource
            .replace(/'/gim, "\\\'")
            .replace(/"/gim, "\\\"")
            .replace(/\r/gim, '\\r')
            .replace(/\n/gim, '\\n')
        }
        else if(typeof(entrySource) === "object") {
          entrySource = JSON.stringify(entrySource)
        }

        entrySource = 'module.exports = "' + entrySource + '";'
      }
      catch(err) {
        throwError(err.message);
        return cb(null, null)
      }

      return cb(null, entrySource)
    }

    return cb(null, null)
  })
}