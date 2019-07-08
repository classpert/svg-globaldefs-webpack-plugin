# SVG Global defs Webpack Plugin

This [webpack](https://webpack.github.io/) plugin reformats SVG files to pull all inner `<symbol>`-bound graphical objects and put them into a global `<defs>` tag. Per [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/defs), `<defs>` tag is used to store graphical objects that can be referenced later (with an `<use>` tag, for example). They are not supposed to be rendered directly if they're inside `<defs>`. Ideally, all later-referenced graphical objects should be stored that way (it keeps your svg organized and saves memory, since many symbols may reference the same object). However, browsers for the most part render svgs correctly even if there's no such organization effort. Unfortunately, (that's not the case for Firefox)[https://bugzilla.mozilla.org/show_bug.cgi?id=353575]. This plugin mostly remedies this issue.

**Compatibility**  
This plugin is currently only compatible with webpack `^4.0.0`.

## Installation
```shell
npm install svg-globaldefs-webpack-plugin --save-dev
```

## Usage
**Webpack configuration**  
```js
const path = require('path');
const SVGGlobalDefsWebpackPlugin = require('svg-globaldefs-webpack-plugin');

module.exports = {
  // ...
  plugins: [
    new SVGGlobalDefsWebpackPlugin({
      files: [ 
        path.resolve(__dirname, 'svgs/icons/*.svg'), 
        path.resolve(__dirname, 'svgs/sprite.svg')
      ],
      attributes: ['linearGradient', 'mask', 'clipPath']
    })
  ]
}
```

## Testing
```shell
npm test
```

## License
This project is [licensed](LICENSE.md) under the [MIT](https://opensource.org/licenses/MIT) license.