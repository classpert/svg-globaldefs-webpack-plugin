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
      this.processDefs(symbol.defs, memoizer);
      this.cleanUpNode(symbol, "defs");
    }

    // if symbol has inner groups
    if(symbol.g) {
      const groupDefs = this.processGroups(symbol.g, []);
      this.processDefs(groupDefs, memoizer);
      this.cleanUpNode(symbol, "g");
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

        delete(symbol[attributeName]);
      }
    }
  }

  processGroups(node, defs) {
    if(Array.isArray(node)){
      return node.map(innerNode => {
        return this.processGroups(innerNode, defs);
      }).reduce((acc, defs) => {
        acc.push(...defs);
        return acc;
      }, []);
    } else {
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const element = node[key];

          if(key === "defs") {
            if(Array.isArray(element)) {
              defs.push(...element);
            } else {
              defs.push(element);
            }

            delete(node[key]);
          }

          // { linearGradient: [ ... ]  }
          if(this.options.attributes.indexOf(key) > -1) {
            defs.push({[key]: element});
            delete(node[key]);
          }

          if(key === "g") {
            this.processGroups(node.g, defs);

            if(this.isEmptyNode(node.g)) {
              delete(node.g);
            }
          }
        }
      }

      return defs;
    }
  }

  processDefs(node, memoizer) {
    if(Array.isArray(node)) {
      node.forEach(innerNode => {
        this.processDefs(innerNode, memoizer);
      });
    } else {
      for (const localDefName in node) {
        // localDefName is not an attribute of <defs> tag
        if (node.hasOwnProperty(localDefName) && !this.isAttribute(localDefName)) {
          const localDefValue = node[localDefName];

          // localDefValue might be an array, object or string
          if(Array.isArray(localDefValue)) {
            for (let i = 0; i < localDefValue.length; i++) {
              this.addToGlobalDefs(localDefValue[i], localDefName, memoizer);
            }
          } else {
            this.addToGlobalDefs(localDefValue, localDefName, memoizer);
          }

          delete(node[localDefName]);
        }
      }
    }
  }

  cleanUpNode(rootNode, childNodeName) {
    if(rootNode[childNodeName]) {
      if(Array.isArray(rootNode[childNodeName])){
        rootNode[childNodeName] = rootNode[childNodeName].filter((node) => {
          return !this.isEmptyNode(node);
        })

        rootNode[childNodeName].map((childNode) => {
          this.cleanUpNode(childNode, childNodeName);
        });
      } else {
        if(this.isEmptyNode(rootNode[childNodeName])) {
          delete(rootNode[childNodeName]);
        }
      }
    }
  }

  addToGlobalDefs(node, key, memoizer) {
    const id = node[`${this.options.attributeNamePrefix}id`];

    // attr with null ids will be ignored
    // since they can't be referenced
    if (!(id == null)) {
      // add entry to memoizer if doesn't exist
      if(memoizer[key] == null) {
        memoizer[key] = { defs: [], ids: [] };
      }

      // add attr to defs uniquely based on id
      if(memoizer[key].ids.indexOf(id) === -1) {
        memoizer[key].defs.push(node);
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

  isEmptyNode(node) {
    return (
      (node == '') ||
      (Object.keys(node).filter((node) => !this.isAttribute(node)).length === 0 && node.constructor === Object)
    );
  }

  isAttribute(value) {
    return value.startsWith(this.options.attributeNamePrefix,0);
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
