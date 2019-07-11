const glob = require("glob");
const { RawSource } = require("webpack-sources");
const x2jParser = require("fast-xml-parser");
const j2xParser = require("fast-xml-parser").j2xParser;

module.exports = class SVGGlobalDefsWebpackPlugin {
  constructor({files, options}) {
    this.files = [];

    if (Array.isArray(files)) {
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        this.addFile(file);
      }
    } else {
      this.addFile(files);
    }

    this.options = Object.assign({
      attributes: ["linearGradient"],
      attributeNamePrefix: "@_"
    }, options || {});
  }

  transform(originalSvg) {
    const svgJson = x2jParser.parse(originalSvg, {
      ignoreAttributes: false,
      attributeNamePrefix: this.options.attributeNamePrefix
    });

    const memoizer = this.createAttributesMemoizer();

    if (Array.isArray(svgJson.svg.symbol)) {
      for (let i = 0; i < svgJson.svg.symbol.length; i++) {
        this.processSymbol(svgJson.svg.symbol[i], memoizer);
      }
    } else if (svgJson.svg.symbol) {
      this.processSymbol(svgJson.svg.symbol, memoizer);
    }

    const modifiedSvg = { svg: {} };

    // insert defs first
    for (const attr in memoizer) {
      if (memoizer.hasOwnProperty(attr)) {
        const { defs } = memoizer[attr];

        if (modifiedSvg.svg.defs == null) {
          modifiedSvg.svg.defs = {};
        }

        if (defs.length) {
          if (modifiedSvg.svg.defs[attr] == null) {
            modifiedSvg.svg.defs[attr] = [];
          }
          modifiedSvg.svg.defs[attr].push(...defs);
        }
      }
    }

    for (const key in svgJson.svg) {
      if (svgJson.svg.hasOwnProperty(key)) {
        const element = svgJson.svg[key];

        modifiedSvg.svg[key] = element;
      }
    }

    const svgBuilder = new j2xParser({
      ignoreAttributes: false,
      attributeNamePrefix: this.options.attributeNamePrefix
    });

    return svgBuilder.parse(modifiedSvg);
  }

  processSymbol(symbol, memoizer) {
    // if symbol has inner defs
    if(symbol.defs) {
      for (const key in symbol.defs) {
        // key is not an attribute of <defs> tag
        if (symbol.defs.hasOwnProperty(key) && !key.startsWith(this.options.attributeNamePrefix,0)) {
          const value = symbol.defs[key];

          if(symbol[key] == null) {
            symbol[key] = [];
          }

          if(typeof(symbol[key]) === 'object') {
            if(Object.keys(symbol[key]).length) {
              symbol[key] = [ symbol[key] ];
            } else {
              symbol[key] = [];
            }
          }

          if(typeof(symbol[key]) == "string") {
            if(symbol[key].length) {
              symbol[key] = [ symbol[key] ];
            } else {
              symbol[key] = [];
            }
          }

          if(Array.isArray(value)) {
            symbol[key].push(...value);
          } else {
            symbol[key].push(value);
          }
        }
      }
      delete(symbol.defs);
    }

    for (let j = 0; j < this.options.attributes.length; j++) {
      const attributeName = this.options.attributes[j];
      var attributeValue = symbol[attributeName];

      if (attributeValue) {
        if (Array.isArray(attributeValue)) {
          for (let j = 0; j < attributeValue.length; j++) {
            this.addToGlobalDefs(attributeValue[j], attributeName, memoizer);
          }
        } else {
          this.addToGlobalDefs(attributeValue, attributeName, memoizer);
        }

        delete (symbol[attributeName]);
      }
    }
  }

  createAttributesMemoizer() {
    return this.options.attributes.reduce((acc, val) => {
      acc[val] = { defs: [], ids: [] };
      return acc;
    }, {});
  }

  addToGlobalDefs(value, key, memoizer) {
    const id = value[`${this.options.attributeNamePrefix}id`];

    if (id == null || memoizer[key].ids.indexOf(id) === -1) {
      memoizer[key].defs.push(value);
      id && memoizer[key].ids.push(id);
    }
  }

  addFile(file) {
    glob(file, (err, paths) => {
      if (err) {
        console.log(`Could not glob ${file}`);
      } else {
        if(paths.length) {
          this.files.push(...paths);
        } else {
          this.files.push(file);
        }
      }
    });
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('SVGGlobalDefsWebpackPlugin', (compilation, callback) => {
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];

        if (compilation.assets[file]) {
          const originalSource = compilation.assets[file].source();
          const transformedSource = new RawSource(this.transform(originalSource));
          compilation.assets[file] = transformedSource;
        }
      }

      callback();
    })
  }
};
