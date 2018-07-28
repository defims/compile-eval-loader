# compile-eval-loader

evaluate the module with webpack child compiler at compile time

## example

test.jsx compile to test.html

#### test.jsx

```javascript
import React from 'react';
import ReactDOMServer from 'react-dom/server';
export default ReactDOMServer.renderToStaticMarkup(
  <html>
  <head>
    <title>compile-eval-loader</title>
  </head>
  <body>
    compile-eval-loader
  </body>
  </html>
)
```

#### webpack.config.js

```javascript
module.exports = {
  entry: "./test.jsx",
  output: {
    path: "./",
    filename: "test.html"
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

#### test.html
```html
<html>
<head>
  <title>compile-eval-loader</title>
</head>
<body>
  compile-eval-loader
</body>
</html>
```