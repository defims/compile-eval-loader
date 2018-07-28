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
  throw error;
}

exports.default = function loader() {}

exports.pitch = function pitch(request,a ,b, c,d) {
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

  childCompiler.options = {
    filename,//filename needed, or output will be ignored
    chunkFilename: `[id].${filename}`,
    namedChunkFilename: null,
    libraryTarget: "commonjs2",//commonjs2 type module can be eval no matter webpack config mode is production or development
  }

  childCompiler.compiler = this._compilation.createChildCompiler(
    loaderName,
    childCompiler.options
  )

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
      childCompiler.file = entries[0].files[0];
      var source = childCompilation.assets[childCompiler.file].source();
      try {
        source = eval(source).default;
      }
      catch(err) {
        throwError(err.message);
      }
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

      //ignore childCompiler asset
      delete this._compilation.assets[childCompiler.file];
      delete childCompilation.assets[childCompiler.file];

      return cb(
        null,
        'module.exports = "' + source+ '";'
      )
    }

    return cb(null, null)
  })
}