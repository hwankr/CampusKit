import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_THUMBNAIL_WINDOW_SIZE,
  buildPdfPageItems,
  buildPlannedPreviewRequests,
  buildPreviewCacheKey,
  buildPreviewCacheKeys,
  buildThumbnailWindowPageNumbers,
  clampSelectedPageNumber,
  findPageSegmentForPage,
  getMissingPreviewPageNumbers,
  syncSelectedPageNumber,
} from "./previewPlan.ts";

test("buildPdfPageItems derives the full page catalog from pageCount", () => {
  assert.deepEqual(buildPdfPageItems(4), [
    { key: "page-1", pageNumber: 1 },
    { key: "page-2", pageNumber: 2 },
    { key: "page-3", pageNumber: 3 },
    { key: "page-4", pageNumber: 4 },
  ]);
});

test("clampSelectedPageNumber falls back to page 1 when the document is missing", () => {
  assert.equal(clampSelectedPageNumber(9, null), 1);
});

test("syncSelectedPageNumber resets to page 1 for metadata load and document replacement", () => {
  assert.equal(syncSelectedPageNumber(12, 6, true), 1);
});

test("buildThumbnailWindowPageNumbers keeps the initial window bounded to eight pages", () => {
  assert.deepEqual(
    buildThumbnailWindowPageNumbers(1, 12, INITIAL_THUMBNAIL_WINDOW_SIZE),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test("buildThumbnailWindowPageNumbers keeps the selected page inside the trailing window", () => {
  assert.deepEqual(
    buildThumbnailWindowPageNumbers(12, 12, INITIAL_THUMBNAIL_WINDOW_SIZE),
    [5, 6, 7, 8, 9, 10, 11, 12],
  );
});

test("buildPlannedPreviewRequests keeps focus-first ordering and never forms out-of-range page numbers", () => {
  const requests = buildPlannedPreviewRequests("C:/docs/plan.pdf", 12, 99);

  assert.deepEqual(requests, [
    {
      inputPath: "C:/docs/plan.pdf",
      pageNumbers: [12],
      sizePreset: "focus",
      cacheKeys: ["C:/docs/plan.pdf::focus::12"],
    },
    {
      inputPath: "C:/docs/plan.pdf",
      pageNumbers: [5, 6, 7, 8, 9, 10, 11, 12],
      sizePreset: "thumbnail",
      cacheKeys: [
        "C:/docs/plan.pdf::thumbnail::5",
        "C:/docs/plan.pdf::thumbnail::6",
        "C:/docs/plan.pdf::thumbnail::7",
        "C:/docs/plan.pdf::thumbnail::8",
        "C:/docs/plan.pdf::thumbnail::9",
        "C:/docs/plan.pdf::thumbnail::10",
        "C:/docs/plan.pdf::thumbnail::11",
        "C:/docs/plan.pdf::thumbnail::12",
      ],
    },
  ]);
});

test("buildPreviewCacheKey keeps the fixed preview cache shape", () => {
  assert.equal(
    buildPreviewCacheKey("C:/docs/plan.pdf", "thumbnail", 3),
    "C:/docs/plan.pdf::thumbnail::3",
  );
});

test("buildPreviewCacheKeys flattens the planned request cache keys in order", () => {
  const requests = buildPlannedPreviewRequests("C:/docs/plan.pdf", 4, 2);

  assert.deepEqual(buildPreviewCacheKeys(requests), [
    "C:/docs/plan.pdf::focus::2",
    "C:/docs/plan.pdf::thumbnail::1",
    "C:/docs/plan.pdf::thumbnail::2",
    "C:/docs/plan.pdf::thumbnail::3",
    "C:/docs/plan.pdf::thumbnail::4",
  ]);
});

test("getMissingPreviewPageNumbers excludes cached and in-flight preview keys", () => {
  assert.deepEqual(
    getMissingPreviewPageNumbers(
      "C:/docs/plan.pdf",
      "thumbnail",
      [1, 2, 3, 4],
      {
        "C:/docs/plan.pdf::thumbnail::1": { cached: true },
        "C:/docs/plan.pdf::thumbnail::4": { cached: true },
      },
      ["C:/docs/plan.pdf::thumbnail::2"],
    ),
    [3],
  );
});

test("findPageSegmentForPage derives split context from the selected page", () => {
  const segment = findPageSegmentForPage(
    [
      { start: 1, end: 3, label: "1-3", pageCount: 3 },
      { start: 4, end: 6, label: "4-6", pageCount: 3 },
    ],
    5,
  );

  assert.deepEqual(segment, {
    start: 4,
    end: 6,
    label: "4-6",
    pageCount: 3,
  });
});
