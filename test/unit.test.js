import fs from "fs";
import { formatXML, getSvgFixture } from "../test/test-utils";
import SVGGlobalDefsWebpackPlugin from "../src/index.js";

var plugin = undefined;
const attributes = ["linearGradient", "radialGradient", "clipPath", "mask"];

describe("SVGGlobalDefsWebpackPlugin", () => {
  beforeEach(() => {
    plugin = new SVGGlobalDefsWebpackPlugin({
      files: getSvgFixture("old"),
      options: {
        attributes: attributes
      }
    });
  });

  describe("#addToGlobalDefs", () => {
    var memoizer = undefined;

    beforeEach(() => {
      memoizer = {};
    });

    test("it does not add duplicates based on id", () => {
      plugin.addToGlobalDefs(
        {
          type: "element",
          name: "linearGradient",
          elements: [1],
          attributes: { id: 666 }
        },
        memoizer
      );
      plugin.addToGlobalDefs(
        {
          type: "element",
          name: "linearGradient",
          elements: [1],
          attributes: { id: 666 }
        },
        memoizer
      );
      plugin.addToGlobalDefs(
        {
          type: "element",
          name: "linearGradient",
          elements: [2],
          attributes: { id: 9999 }
        },
        memoizer
      );

      expect(memoizer.linearGradient.defs).toEqual([
        {
          type: "element",
          name: "linearGradient",
          elements: [1],
          attributes: { id: 666 }
        },
        {
          type: "element",
          name: "linearGradient",
          elements: [2],
          attributes: { id: 9999 }
        }
      ]);
      expect(memoizer.linearGradient.ids).toEqual([666, 9999]);
    });
  });

  test("#processGroups", () => {
    // <g>
    //  <g><defs>1</defs><b>2</b><defs>3</defs></g>
    //  <defs>4</defs>
    // </g>
    let defs = [];
    const node = {
      type: "element",
      name: "g",
      elements: [
        {
          type: "element",
          name: "g",
          elements: [
            {
              type: "element",
              name: "defs",
              elements: [1]
            },
            {
              type: "element",
              name: "b",
              elements: [2]
            },
            {
              type: "element",
              name: "defs",
              elements: [3]
            }
          ]
        },
        {
          type: "element",
          name: "defs",
          elements: [4]
        }
      ]
    };

    plugin.processGroups(node, defs);
    expect(defs).toEqual([1, 3, 4]);
  });

  describe("#transform", () => {
    test("3ds_max svg", () => {
      const oldSvg = fs
        .readFileSync(getSvgFixture("old/3ds_max"), "utf8")
        .toString();
      const newSvg = fs
        .readFileSync(getSvgFixture("new/3ds_max"), "utf8")
        .toString();
      const transformedSvg = plugin.transform(oldSvg);

      expect(formatXML(transformedSvg)).toEqual(formatXML(newSvg));
    });

    test("coursera svg", () => {
      const oldSvg = fs
        .readFileSync(getSvgFixture("old/coursera"), "utf8")
        .toString();
      const transformedSvg = plugin.transform(oldSvg);

      expect(formatXML(transformedSvg)).toEqual(formatXML(oldSvg));
    });
  });
});
