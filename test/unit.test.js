import fs from 'fs';
import { formatXML, getSvgFixture } from '../test/test-utils';
import SVGGlobalDefsWebpackPlugin from '../src/index.js';

var plugin = undefined;
const attributes = [
  "linearGradient",
  "radialGradient",
  "clipPath",
  "mask"
];
const attributeNamePrefix = "@_";

describe('SVGGlobalDefsWebpackPlugin', () => {
  beforeEach(() => {
    plugin = new SVGGlobalDefsWebpackPlugin({
      files: getSvgFixture('old'),
      options: {
        attributes: attributes,
        attributeNamePrefix: attributeNamePrefix
      }
    });
  });

  describe('#addToGlobalDefs', () => {
    var memoizer = undefined;

    beforeEach(() => {
      memoizer = {};
    });

    test('it does not add duplicates based on id', () => {
      plugin.addToGlobalDefs({ [`${attributeNamePrefix}id`]: 666 }, "linearGradient", memoizer);
      plugin.addToGlobalDefs({ [`${attributeNamePrefix}id`]: 666 }, "linearGradient", memoizer);
      plugin.addToGlobalDefs({ [`${attributeNamePrefix}id`]: 9999 }, "linearGradient", memoizer);

      expect(memoizer.linearGradient.defs).toEqual([{ [`${attributeNamePrefix}id`]: 666 }, { [`${attributeNamePrefix}id`]: 9999 }]);
      expect(memoizer.linearGradient.ids).toEqual([666, 9999]);
    })
  });

  test("#processGroups", () => {
    // <g>
    //  <g><defs>1</defs></g>
    //  <g><b>2</b><defs>3</defs></g>
    //  <defs>4</defs>
    // </g>
    let defs = [];
    const node = {
      g: {
        g: [
          { defs: 1 },
          { b: 2, defs: 3 }
        ],
        defs: 4
      }
    };

    plugin.processGroups(node, defs);
    expect(defs).toEqual([1, 3, 4]);
  });

  describe("#transform", () => {
    test("3ds_max svg", () => {
      const oldSvg = fs.readFileSync(getSvgFixture('old/3ds_max'), 'utf8').toString();
      const newSvg = fs.readFileSync(getSvgFixture('new/3ds_max'), 'utf8').toString();
      const transformedSvg = plugin.transform(oldSvg);

      expect(formatXML(transformedSvg)).toEqual(formatXML(newSvg));
    });
  });
});
