import test from "node:test";
import assert from "node:assert/strict";
import {
  addSplitPoint,
  buildExecutablePageSegments,
  buildPageRangePlanSignature,
  buildRangeInputRewriteForDerivedFinalSegment,
  buildRangeInputRewriteForTypedSegment,
  buildPageSegmentsFromSplitPoints,
  canDismissDerivedFinalSegment,
  parsePageRangeInput,
  parseSplitPointInput,
  removeSplitPoint,
  serializePageRangeInput,
} from "./pageRange.ts";

test("parsePageRangeInput supports comma-separated typed ranges and auto-completes the final range", () => {
  const plan = parsePageRangeInput("1-20, 21-40", 60);

  assert.deepEqual(plan.segments, [
    { start: 1, end: 20, label: "1-20", pageCount: 20 },
    { start: 21, end: 40, label: "21-40", pageCount: 20 },
    { start: 41, end: 60, label: "41-60", pageCount: 20 },
  ]);
  assert.deepEqual(plan.typedSegments, [
    { start: 1, end: 20, label: "1-20", pageCount: 20 },
    { start: 21, end: 40, label: "21-40", pageCount: 20 },
  ]);
  assert.deepEqual(plan.derivedFinalSegment, {
    start: 41,
    end: 60,
    label: "41-60",
    pageCount: 20,
  });
});

test("parsePageRangeInput supports newline-separated tokens and single-page entries", () => {
  const plan = parsePageRangeInput("1\n2-3", 5);

  assert.deepEqual(plan.segments, [
    { start: 1, end: 1, label: "1", pageCount: 1 },
    { start: 2, end: 3, label: "2-3", pageCount: 2 },
    { start: 4, end: 5, label: "4-5", pageCount: 2 },
  ]);
});

test("parsePageRangeInput rejects a plan that does not start at page 1", () => {
  assert.throws(() => parsePageRangeInput("5-10", 20), {
    message: "validationRangeMustStartAtOne",
  });
});

test("parsePageRangeInput rejects gaps between typed ranges", () => {
  assert.throws(() => parsePageRangeInput("1-10, 12-20", 20), {
    message: "validationRangeGapNotAllowed",
  });
});

test("parsePageRangeInput rejects a single full-document segment because split needs 2 outputs", () => {
  assert.throws(() => parsePageRangeInput("1-20", 20), {
    message: "validationRangeRequiresAtLeastTwoOutputs",
  });
});

test("serializePageRangeInput canonicalizes typed segments into a compact editor string", () => {
  const plan = parsePageRangeInput("1 - 20 , 21-29", 100);

  assert.equal(serializePageRangeInput(plan.typedSegments), "1-20, 21-29");
});

test("buildRangeInputRewriteForTypedSegment preserves typed meaning and targets the chosen token", () => {
  const plan = parsePageRangeInput("1 - 20 , 21-29", 100);
  const rewrite = buildRangeInputRewriteForTypedSegment(plan.typedSegments, 1);

  assert.deepEqual(rewrite, {
    value: "1-20, 21-29",
    selectionStart: 6,
    selectionEnd: 11,
  });
});

test("buildRangeInputRewriteForDerivedFinalSegment materializes the auto-completed final row", () => {
  const plan = parsePageRangeInput("1-20, 21-29", 100);
  const rewrite = buildRangeInputRewriteForDerivedFinalSegment(
    plan.typedSegments,
    plan.derivedFinalSegment!,
  );

  assert.deepEqual(rewrite, {
    value: "1-20, 21-29, 30-100",
    selectionStart: 13,
    selectionEnd: 19,
  });
});

test("editing a materialized final row allows the parser to derive the next trailing row", () => {
  const plan = parsePageRangeInput("1-20, 21-29", 100);
  const rewrite = buildRangeInputRewriteForDerivedFinalSegment(
    plan.typedSegments,
    plan.derivedFinalSegment!,
  );
  const reparsed = parsePageRangeInput(rewrite.value.replace("30-100", "30-60"), 100);

  assert.deepEqual(reparsed.typedSegments, [
    { start: 1, end: 20, label: "1-20", pageCount: 20 },
    { start: 21, end: 29, label: "21-29", pageCount: 9 },
    { start: 30, end: 60, label: "30-60", pageCount: 31 },
  ]);
  assert.deepEqual(reparsed.derivedFinalSegment, {
    start: 61,
    end: 100,
    label: "61-100",
    pageCount: 40,
  });
});

test("buildExecutablePageSegments can omit the derived tail without mutating typed segments", () => {
  const plan = parsePageRangeInput("1-20, 21-29", 100);

  assert.deepEqual(
    buildExecutablePageSegments(plan.typedSegments, plan.derivedFinalSegment, false),
    [
      { start: 1, end: 20, label: "1-20", pageCount: 20 },
      { start: 21, end: 29, label: "21-29", pageCount: 9 },
    ],
  );
  assert.equal(serializePageRangeInput(plan.typedSegments), "1-20, 21-29");
});

test("buildPageRangePlanSignature stays stable across formatting changes", () => {
  const formatted = parsePageRangeInput("1-20, 21-40", 100);
  const unformatted = parsePageRangeInput("1 - 20,\n21-40", 100);

  assert.equal(
    buildPageRangePlanSignature(formatted.typedSegments, 100),
    buildPageRangePlanSignature(unformatted.typedSegments, 100),
  );
});

test("canDismissDerivedFinalSegment blocks one-output collapse cases", () => {
  const plan = parsePageRangeInput("1-20", 40);

  assert.equal(canDismissDerivedFinalSegment(plan.typedSegments), false);
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
