import fs from 'fs';
import { removeXmlWhitespace, getSvgFixture } from '../test/test-utils';
import SVGGlobalDefsWebpackPlugin from '../src/index.js';

var plugin = undefined;
const attributes = ["linearGradient"];
const attributeNamePrefix = "@_";

describe('SVGGlobalDefsWebpackPlugin', () => {
  beforeEach(() => {
    plugin = new SVGGlobalDefsWebpackPlugin(getSvgFixture('old'), {
      attributes: attributes,
      attributeNamePrefix: attributeNamePrefix
    });
  });

  test('#createAttributesMemoizer', () => {
    expect(plugin.createAttributesMemoizer()).toEqual({ linearGradient: { defs: [], ids: [] } });
  });

  describe('#addToDefs', () => {
    var memoizer = undefined;

    beforeEach(() => {
      memoizer = plugin.createAttributesMemoizer();
    });

    test('it does not add duplicates based on id', () => {
      plugin.addToDefs({ [`${attributeNamePrefix}id`]: 666 }, "linearGradient", memoizer);
      plugin.addToDefs({ [`${attributeNamePrefix}id`]: 666 }, "linearGradient", memoizer);
      plugin.addToDefs({ [`${attributeNamePrefix}id`]: 9999 }, "linearGradient", memoizer);

      expect(memoizer.linearGradient.defs).toEqual([{ [`${attributeNamePrefix}id`]: 666 }, { [`${attributeNamePrefix}id`]: 9999 }]);
      expect(memoizer.linearGradient.ids).toEqual([666, 9999]);
    })
  });

  test("#transform", () => {
    const oldSvg = fs.readFileSync(getSvgFixture('old'), 'utf8').toString();
    const newSvg = fs.readFileSync(getSvgFixture('new'), 'utf8').toString();
    const transformedSvg = plugin.transform(oldSvg);

    expect(transformedSvg).toEqual(removeXmlWhitespace(newSvg));
  })
});
