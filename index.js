/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Long Wei
*/
const loaderUtils = require('loader-utils');
const validateOptions = require('@webpack-contrib/schema-utils');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const packageJson = require('./package.json');
const loaderName = packageJson.name || "child-compiler-loader";

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

exports.pitch = function pitch(request) {
  const options = loaderUtils.getOptions(this) || {};

  validateOptions({
    name: loaderName,
    schema: {
      "type": "object",
      "properties": {
        "name": {
          "anyOf": [
            {"type": "string"},
            {"instanceof": "Function"}
          ]
        }
      },
      "additionalProperties": false
    },
    target: options
  });

  if (!this.webpack) {
    throwError('This loader is only usable with webpack');
  }

  this.cacheable(false);

  const cb = this.async();

  const compiler = this._compiler;
  const compilation = this._compilation
  const outputOptions = Object.create(compiler.options.output);
  outputOptions.libraryTarget = "commonjs2"; 
  //commonjs2 type module can be eval no matter webpack config mode is production or development

  const childCompiler = compilation.createChildCompiler(
    loaderName + " " + request,
    outputOptions,
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

  //get entry name
  var entryName = "main";
  try {
    var entry = compiler.options.entry;
    var rawRequest = findEntry(this._module).rawRequest;
    var matchEntry = Object
      .keys(entry)
      .filter(key => {
        var value = entry[key];
        return typeof(value) === "string"
          ? value === rawRequest
          : Array.isArray(value)
          ? value.filter(item => item === rawRequest).length
          : false
      })[0];
    entryName = matchEntry ? matchEntry : entryName
  }
  catch(e) {}

  new SingleEntryPlugin(this.context, '!!' + request, entryName).apply(childCompiler);

  const subCache = 'subcache ' + __dirname + ' ' + request;

  if (childCompiler.hooks) {
    const plugin = { name: loaderName };

    childCompiler.hooks.compilation.tap(plugin, compilation => {
      if (compilation.cache) {
        if (!compilation.cache[subCache]) {
          compilation.cache[subCache] = {};
        }

        compilation.cache = compilation.cache[subCache];
      }
    });
  } else {
    childCompiler.plugin('compilation', childCompiler.compilation);
  }

  childCompiler.runAsChild((err, entries, childCompilation) => {
    if(err) return cb(err);

    if(entries[0]) {
      var files = entries[0].files;
      var file = files[files.length - 1];//only need to eval the entry file
      var source = childCompilation.assets[file].source();
      try {
        source = eval(source).default;

        if(typeof(source) === "string") {
          source = source
            .replace(/'/gim, "\\\'")
            .replace(/"/gim, "\\\"")
            .replace(/\r/gim, '\\r')
            .replace(/\n/gim, '\\n')
        }
        else if(typeof(source) === "object") {
          source = JSON.stringify(source)
        }

        source = 'module.exports = "' + source+ '";'
      }
      catch(err) {
        throwError(err.message);
      }

      //ignore childCompiler asset
      delete compilation.assets[file];
      delete childCompilation.assets[file];

      return cb(null, source)
    }

    return cb(null, null)
  })
}