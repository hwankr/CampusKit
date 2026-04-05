import test from "node:test";
import assert from "node:assert/strict";
import {
  addSplitPoint,
  buildRangeInputRewriteForTypedSegment,
  buildPageSegmentsFromSplitPoints,
  parsePageRangeInput,
  parseSplitPointInput,
  removeSplitPoint,
  serializePageRangeInput,
} from "./pageRange.ts";

test("parsePageRangeInput keeps only the explicit sparse ranges the user typed", () => {
  const plan = parsePageRangeInput("5-10, 11-20", 30);

  assert.deepEqual(plan.segments, [
    { start: 5, end: 10, label: "5-10", pageCount: 6 },
    { start: 11, end: 20, label: "11-20", pageCount: 10 },
  ]);
});

test("parsePageRangeInput accepts a single explicit range without forcing extra outputs", () => {
  const plan = parsePageRangeInput("80-100", 100);

  assert.deepEqual(plan.segments, [{ start: 80, end: 100, label: "80-100", pageCount: 21 }]);
});

test("parsePageRangeInput supports newline-separated tokens and single-page entries", () => {
  const plan = parsePageRangeInput("5\n8-9", 12);

  assert.deepEqual(plan.segments, [
    { start: 5, end: 5, label: "5", pageCount: 1 },
    { start: 8, end: 9, label: "8-9", pageCount: 2 },
  ]);
});

test("parsePageRangeInput allows gaps between explicit ranges", () => {
  const plan = parsePageRangeInput("1-10, 20-30", 100);

  assert.deepEqual(plan.segments, [
    { start: 1, end: 10, label: "1-10", pageCount: 10 },
    { start: 20, end: 30, label: "20-30", pageCount: 11 },
  ]);
});

test("parsePageRangeInput rejects overlapping ranges", () => {
  assert.throws(() => parsePageRangeInput("1-10, 9-12", 20), {
    message: "validationOverlappingRange",
  });
  assert.throws(() => parsePageRangeInput("1-10, 5-10", 20), {
    message: "validationOverlappingRange",
  });
});

test("parsePageRangeInput rejects malformed input", () => {
  assert.throws(() => parsePageRangeInput("5-10-12", 20), {
    message: "validationMalformedRange",
  });
});

test("parsePageRangeInput rejects descending input", () => {
  assert.throws(() => parsePageRangeInput("10-5", 20), {
    message: "validationDescendingRange",
  });
});

test("parsePageRangeInput rejects out-of-bounds input", () => {
  assert.throws(() => parsePageRangeInput("5-25", 20), {
    message: "validationOutOfBounds",
  });
});

test("serializePageRangeInput canonicalizes typed segments into a compact editor string", () => {
  const plan = parsePageRangeInput("5 - 10 , 11-20", 100);

  assert.equal(serializePageRangeInput(plan.segments), "5-10, 11-20");
});

test("buildRangeInputRewriteForTypedSegment preserves typed meaning and targets the chosen token", () => {
  const plan = parsePageRangeInput("5 - 10 , 11-20", 100);
  const rewrite = buildRangeInputRewriteForTypedSegment(plan.segments, 1);

  assert.deepEqual(rewrite, {
    value: "5-10, 11-20",
    selectionStart: 6,
    selectionEnd: 11,
  });
});

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
