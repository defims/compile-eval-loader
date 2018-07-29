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

exports.default = function loader() {}

exports.pitch = function pitch(request) {
  const options = loaderUtils.getOptions(this) || {};

  validateOptions({
    name: loaderName,
    schema: {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "inline": {
          "type": "boolean"
        },
        "fallback": {
          "type": "boolean"
        },
        "publicPath": {
          "type": "string"
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

  //output module's filename should be match current loader rule
  const filename = loaderUtils.interpolateName(
    this,
    options.name || "[hash]." + loaderName + "." + (request.match(/\.(\w+)$/im)
      ? RegExp.$1
      : 'jsx'
    ),
    {
      context: options.context || this.rootContext || this.options.context,
      regExp: options.regExp,
    }
  );

  const childCompiler = {};

  childCompiler.outputOptions = Object.create(this._compiler.options.output);
  childCompiler.outputOptions.libraryTarget = "commonjs2"; 
  //commonjs2 type module can be eval no matter webpack config mode is production or development
  //output filename needed, otherwise output options will be ignored

  childCompiler.compiler = this._compilation.createChildCompiler(
    loaderName + " " + request,
    childCompiler.outputoptions,
    //(this._compiler.options.plugins || [])
  )

  //function createChildCompiler will apply plugins with a compiler whose options is empty object first, and some plugin need the options, so pass no plugins above and execute now
  //https://github.com/webpack/webpack/blob/master/lib/Compiler.js#L432 
  for(const plugin of (this._compiler.options.plugins || [])) {
    plugin.apply(childCompiler.compiler)
  }

  if (this.target !== 'webworker' && this.target !== 'web') {
    new NodeTargetPlugin().apply(childCompiler.compiler);
  }

  new SingleEntryPlugin(this.context, '!!' + request, 'main').apply(
    childCompiler.compiler
  );

  const subCache = 'subcache ' + __dirname + ' ' + request;

  childCompiler.compilation = (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) {
        compilation.cache[subCache] = {};
      }

      compilation.cache = compilation.cache[subCache];
    }
  };

  if (childCompiler.compiler.hooks) {
    const plugin = { name: loaderName };

    childCompiler.compiler.hooks.compilation.tap(
      plugin,
      childCompiler.compilation
    );
  } else {
    childCompiler.compiler.plugin('compilation', childCompiler.compilation);
  }

  childCompiler.compiler.runAsChild((err, entries, childCompilation) => {
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
      delete this._compilation.assets[file];
      delete childCompilation.assets[file];

      return cb(null, source)
    }

    return cb(null, null)
  })
}