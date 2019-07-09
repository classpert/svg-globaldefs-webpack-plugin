const path = require('path');
const SVGSpritemapPlugin = require('svg-spritemap-webpack-plugin');
const SVGGlobalDefsWebpackPlugin = require('../../src/index.js');

module.exports = {
  entry: path.join(__dirname, 'src/index.js'),
  mode: 'development',
  output: {
    path: path.join(__dirname, 'example_dist'),
    filename: '[name].chunk.js',
  },
  plugins: [
    new SVGSpritemapPlugin(path.join(__dirname, 'src/assets/*.svg'), {
      output: {
        filename: path.join(__dirname, 'src/assets/sprite.svg')
      }
    }),
    new SVGGlobalDefsWebpackPlugin({
      files: path.join(__dirname, 'src/assets/sprite.svg')
    })
  ]
};
