import test from "node:test";
import assert from "node:assert/strict";
import {
  addSplitPoint,
  buildPageSegmentsFromSplitPoints,
  parseSplitPointInput,
  removeSplitPoint,
} from "./pageRange.ts";

test("parseSplitPointInput trims and parses a positive boundary", () => {
  assert.equal(parseSplitPointInput(" 10 "), 10);
});

test("addSplitPoint sorts inserted boundaries", () => {
  assert.deepEqual(addSplitPoint([12, 4], "8", 20), [4, 8, 12]);
});

test("addSplitPoint rejects duplicate boundaries", () => {
  assert.throws(() => addSplitPoint([10], "10", 20), {
    message: "validationDuplicateSplitPoint",
  });
});

test("addSplitPoint rejects the last page as a boundary", () => {
  assert.throws(() => addSplitPoint([], "20", 20), {
    message: "validationSplitPointOutOfBounds",
  });
});

test("buildPageSegmentsFromSplitPoints covers a 20-page document from one split point", () => {
  const segments = buildPageSegmentsFromSplitPoints([10], 20);

  assert.deepEqual(segments, [
    { start: 1, end: 10, label: "1-10", pageCount: 10 },
    { start: 11, end: 20, label: "11-20", pageCount: 10 },
  ]);
});

test("buildPageSegmentsFromSplitPoints creates contiguous ranges for multiple boundaries", () => {
  const segments = buildPageSegmentsFromSplitPoints([3, 7], 10);

  assert.deepEqual(segments, [
    { start: 1, end: 3, label: "1-3", pageCount: 3 },
    { start: 4, end: 7, label: "4-7", pageCount: 4 },
    { start: 8, end: 10, label: "8-10", pageCount: 3 },
  ]);
});

test("removeSplitPoint removes one selected boundary", () => {
  assert.deepEqual(removeSplitPoint([3, 7, 10], 7), [3, 10]);
});
