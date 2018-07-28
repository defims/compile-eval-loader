# compile-eval-loader

evaluate the module with webpack child compiler at compile time

## example

compile test.jsx which dependent module dependency.js to test.js

#### test.jsx

```javascript
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import Dependency from './dependency.js';
export default ReactDOMServer.renderToStaticMarkup(
  <html>
  <head>
    <title>compile-eval-loader</title>
  </head>
  <body>
    compile-eval-loader
    <Dependency>dependency</Dependency>
  </body>
  </html>
)
```

#### dependency.js

```javascript
import React from 'react';
export const Dependency = ({children}) => <div>{children}</div>;
export default Dependency;
```

#### webpack.config.js

```javascript
module.exports = {
  entry: "./test.jsx",
  output: {
    path: "./",
    filename: "test.js"
  }
  module: {
    rules: {
      test: /\.jsx$/,
      use: [{
        loader: 'compile-eval-loader',
      }, {
        loader: 'babel-loader',
        options: {
          "presets": [
              "env",
              "stage-0",
              "react"
          ]
        }
      }]
    }
  }
}
```

#### test.js
```html
!function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=0)}([function(e,t,r){e.exports=r(1)},function(e,t){
  e.exports="<html><head><title>compile-eval-loader</title></head><body>compile-eval-loader<div>dependency</div></body></html>"
}]);
```