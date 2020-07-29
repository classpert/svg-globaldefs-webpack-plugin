const glob = require("glob");
const { RawSource } = require("webpack-sources");
const x2jParser = require("fast-xml-parser");
const j2xParser = require("fast-xml-parser").j2xParser;
const { js2xml, xml2js } = require("xml-js");
const R = require("ramda");

var ELEMENT_FILTER = name => el => el.name === name && el.type === "element";
var filter = name => R.filter(ELEMENT_FILTER(name));
var reject = name => R.reject(ELEMENT_FILTER(name));
var pluck = name => node => filter(name)(node.elements || []);
var remove = name => node => ({
  ...node,
  elements: reject(name)(node.elements || [])
});

module.exports = class SVGGlobalDefsWebpackPlugin {
  constructor({ files, options }) {
    this.files = [];

    if (Array.isArray(files)) {
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        this.addFile(file);
      }
    } else {
      this.addFile(files);
    }

    this.options = Object.assign(
      {
        attributes: ["linearGradient"]
      },
      options || {}
    );
  }

  transform(originalSvg) {
    const svgJSON = xml2js(originalSvg, {
      compact: false
    });

    const svgRoot = pluck("svg")(svgJSON)[0];

    if (!svgRoot) {
      return originalSvg;
    }

    const symbols = pluck("symbol")(svgRoot);

    if (!symbols.length) {
      return originalSvg;
    }

    // memoizer to remember
    // added defs based on id
    var memoizer = {};

    let modifiedSvg = R.clone(svgRoot);
    modifiedSvg.elements = symbols.map(symbol => {
      return this.processSymbol(symbol, memoizer);
    });

    // insert defs first
    let existingGlobalDefs = pluck("defs")(modifiedSvg);

    if (existingGlobalDefs.length) {
      modifiedSvg = remove("defs")(modifiedSvg);
    }

    for (const attr in memoizer) {
      if (memoizer.hasOwnProperty(attr)) {
        const { defs } = memoizer[attr];

        if (defs.length) {
          existingGlobalDefs = [...existingGlobalDefs, ...defs];
        }
      }
    }

    if (existingGlobalDefs.length) {
      modifiedSvg.elements = [
        { type: "element", name: "defs", elements: [...existingGlobalDefs] },
        ...(modifiedSvg.elements || [])
      ];
    }

    return js2xml({
      elements: [modifiedSvg]
    });
  }

  processSymbol(symbol, memoizer) {
    let processedSymbol = R.clone(symbol);

    // if symbol has inner defs
    const defs = pluck("defs")(processedSymbol);

    if (defs.length) {
      this.processDefs(defs, memoizer);
    }

    processedSymbol = remove("defs")(processedSymbol);

    const groups = processedSymbol.elements.filter(ELEMENT_FILTER("g"));

    if (groups.length) {
      const groupDefs = this.processGroups(groups, [], memoizer);
      this.processDefs(groupDefs, memoizer);
    }

    // remove empty groups
    processedSymbol.elements = processedSymbol.elements.filter(
      el =>
        !(
          el.type === "element" &&
          el.name === "g" &&
          (el.elements == null || el.elements.length === 0)
        )
    );

    for (let j = 0; j < this.options.attributes.length; j++) {
      const attributeName = this.options.attributes[j];
      const attributeElements = pluck(attributeName)(processedSymbol);

      if (attributeElements.length) {
        for (let j = 0; j < attributeElements.length; j++) {
          this.addToGlobalDefs(attributeElements[j], memoizer);
        }
      }

      processedSymbol = remove(attributeName)(processedSymbol);
    }

    return processedSymbol;
  }

  processGroups(node, defs, memoizer) {
    if (Array.isArray(node)) {
      return node
        .map(innerNode => {
          return this.processGroups(innerNode, defs, memoizer);
        })
        .reduce((acc, defs) => {
          acc.push(...defs);
          return acc;
        }, []);
    } else {
      const elements = node.elements;

      if (elements && elements.length) {
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];

          if (element.name === "defs") {
            defs.push(...element.elements);
          }

          if (element.name === "g") {
            this.processGroups(element, defs, memoizer);
          }
        }

        node.elements = remove("defs")(node).elements;

        for (let j = 0; j < this.options.attributes.length; j++) {
          const attributeName = this.options.attributes[j];
          const attributeElements = pluck(attributeName)(node);

          if (attributeElements.length) {
            for (let j = 0; j < attributeElements.length; j++) {
              this.addToGlobalDefs(attributeElements[j], memoizer);
            }
          }

          node.elements = remove(attributeName)(node).elements;
        }
      }

      return defs;
    }
  }

  processDefs(node, memoizer) {
    if (Array.isArray(node)) {
      node.forEach(innerNode => {
        this.processDefs(innerNode, memoizer);
      });
    } else {
      const elements = node.elements;

      if (elements && elements.length) {
        for (let i = 0; i < elements.length; i++) {
          this.addToGlobalDefs(elements[i], memoizer);
        }
      }
      this.addToGlobalDefs(node, memoizer);
    }
  }

  addToGlobalDefs(node, memoizer) {
    const id = node.attributes && node.attributes.id;
    const key = node.name;

    // attr with null ids will be ignored
    // since they can't be referenced
    if (!(id == null)) {
      // add entry to memoizer if doesn't exist
      if (memoizer[key] == null) {
        memoizer[key] = { defs: [], ids: [] };
      }

      // add attr to defs uniquely based on id
      if (memoizer[key].ids.indexOf(id) === -1) {
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
        if (paths.length) {
          this.files.push(...paths);
        } else {
          this.files.push(file);
        }
      }
    });
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      "SVGGlobalDefsWebpackPlugin",
      (compilation, callback) => {
        for (let i = 0; i < this.files.length; i++) {
          const file = this.files[i];

          if (compilation.assets[file]) {
            const originalSource = compilation.assets[file].source();
            const transformedSource = new RawSource(
              this.transform(originalSource)
            );
            compilation.assets[file] = transformedSource;
          }
        }

        callback();
      }
    );
  }
};
