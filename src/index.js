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

    // memoizer to remember
    // added defs based on id
    const memoizer = {};

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
      for (const localDefName in symbol.defs) {
        // localDefName is not an attribute of <defs> tag
        if (symbol.defs.hasOwnProperty(localDefName) && !localDefName.startsWith(this.options.attributeNamePrefix,0)) {
          const localDefValue = symbol.defs[localDefName];

          // localDefValue might be an array, object or string
          if(Array.isArray(localDefValue)) {
            for (let i = 0; i < localDefValue.length; i++) {
              this.addToGlobalDefs(localDefValue[i], localDefName, memoizer);
            }
          } else {
            this.addToGlobalDefs(localDefValue, localDefName, memoizer);
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

  addToGlobalDefs(value, key, memoizer) {
    const id = value[`${this.options.attributeNamePrefix}id`];

    // attr with null ids will be ignored
    // since they can't be referenced
    if (!(id == null)) {
      // add entry to memoizer if doesn't exist
      if(memoizer[key] == null) {
        memoizer[key] = { defs: [], ids: [] };
      }

      // add attr to defs uniquely based on id
      if(memoizer[key].ids.indexOf(id) === -1) {
        memoizer[key].defs.push(value);
        memoizer[key].ids.push(id);
      }
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
