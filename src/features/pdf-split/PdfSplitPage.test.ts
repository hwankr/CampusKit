import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.resolve("src/features/pdf-split/PdfSplitPage.tsx");

test("pdf split page wires the feature service without importing the platform bridge directly", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /pdfSplitService/);
  assert.match(source, /pickPdfFile/);
  assert.match(source, /getPdfMetadata/);
  assert.match(source, /pickOutputDirectory/);
  assert.match(source, /splitPdf/);
  assert.match(source, /renderPdfPages/);
  assert.doesNotMatch(source, /documentBridge/);
});

test("pdf split page uses page-driven preview state while keeping the current workspace slots", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /parsePageRangeInput/);
  assert.match(source, /buildRangeInputRewriteForTypedSegment/);
  assert.match(source, /buildPdfPageItems/);
  assert.match(source, /buildPlannedPreviewRequests/);
  assert.match(source, /findPageSegmentForPage/);
  assert.match(source, /syncSelectedPageNumber/);
  assert.match(source, /getDefaultOutputDirectory/);
  assert.match(source, /selectedPageNumber/);
  assert.match(source, /rangeInput/);
  assert.match(source, /splitRangeEditAction/);
  assert.match(source, /rangePlanComposerHint/);
  assert.doesNotMatch(source, /addSplitPoint/);
  assert.doesNotMatch(source, /buildExecutablePageSegments/);
  assert.doesNotMatch(source, /buildPageRangePlanSignature/);
  assert.doesNotMatch(source, /buildRangeInputRewriteForDerivedFinalSegment/);
  assert.doesNotMatch(source, /buildPageSegmentsFromSplitPoints/);
  assert.doesNotMatch(source, /canDismissDerivedFinalSegment/);
  assert.doesNotMatch(source, /dismissedTailSignature/);
  assert.doesNotMatch(source, /derivedFinalSegment/);
  assert.doesNotMatch(source, /getQuickAddSplitPointState/);
  assert.doesNotMatch(source, /getSelectionPageAfterSplitPoint/);
  assert.doesNotMatch(source, /removeSplitPoint/);
  assert.doesNotMatch(source, /splitPointInput/);
  assert.doesNotMatch(source, /splitPoints/);
  assert.doesNotMatch(source, /splitPointFlow/);
  assert.doesNotMatch(source, /selectedRangeIndex/);
  assert.doesNotMatch(source, /splitRangeDerivedBadge/);
  assert.doesNotMatch(source, /splitRangeDismissAction/);
  assert.match(source, /statusLoadingDocument/);
  assert.match(source, /statusReplacingDocument/);
  assert.match(source, /statusMetadataReplaceError/);
  assert.match(source, /describeError/);
  assert.match(source, /status\.detail/);
  assert.match(source, /previewCache/);
  assert.match(source, /previewLoadingKeys/);
  assert.match(source, /previewError/);
  assert.match(source, /pendingInputPath/);
  assert.match(source, /split-documentPath/);
  assert.match(source, /split-manuscriptImage/);
  assert.match(source, /split-thumbnailImage/);
  assert.match(source, /data-slot="dropzone"/);
  assert.match(source, /data-slot="document-info"/);
  assert.match(source, /data-slot="preview-panel"/);
  assert.match(source, /data-slot="thumbnail-rail"/);
  assert.match(source, /data-slot="ranges-panel"/);
  assert.match(source, /data-slot="save-action"/);
  assert.match(source, /data-slot="range-row-action"/);
  assert.match(source, /data-preview-request-order/);
  assert.match(source, /data-windowed/);
  assert.match(source, /split-rangeComposerFeedback/);
  assert.match(source, /split-rangeButton/);
  assert.match(source, /split-rangeEditAction/);
  assert.doesNotMatch(source, /split-rangeRemoveAction/);
  assert.match(source, /stopPropagation/);
  assert.doesNotMatch(source, /split-current-page-action/);
  assert.doesNotMatch(source, /split-pointToken/);
});
