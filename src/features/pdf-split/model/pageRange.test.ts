import test from "node:test";
import assert from "node:assert/strict";
import { parsePageRangeInput } from "./pageRange.ts";

test("parsePageRangeInput parses mixed ranges", () => {
  const segments = parsePageRangeInput("1-3, 5, 8-9", 12);

  assert.deepEqual(segments, [
    { start: 1, end: 3, label: "1-3", pageCount: 3 },
    { start: 5, end: 5, label: "5", pageCount: 1 },
    { start: 8, end: 9, label: "8-9", pageCount: 2 },
  ]);
});

test("parsePageRangeInput rejects overlaps", () => {
  assert.throws(() => parsePageRangeInput("1-3, 3-5", 12), {
    message: "validationOverlappingRange",
  });
});

test("parsePageRangeInput rejects out-of-bounds pages", () => {
  assert.throws(() => parsePageRangeInput("1-13", 12), {
    message: "validationOutOfBounds",
  });
});
