import test from "node:test";
import assert from "node:assert/strict";
import { buildPageSegmentsFromSplitPoints } from "./pageRange.ts";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./splitJob.ts";

test("buildPreviewFileName creates stable split output names", () => {
  const [, segment] = buildPageSegmentsFromSplitPoints([4], 8);

  assert.equal(buildPreviewFileName("CampusKit", segment, 1), "CampusKit-part-02-pages-5-8.pdf");
});

test("deriveSplitBaseName falls back to the source file stem", () => {
  assert.equal(deriveSplitBaseName("C:/docs/report.final.pdf"), "report.final");
});

test("toSplitRequestPayload maps derived segments into the split backend shape", () => {
  const segments = buildPageSegmentsFromSplitPoints([3], 5);

  assert.deepEqual(toSplitRequestPayload("C:/docs/report.final.pdf", "C:/out", segments), {
    inputPath: "C:/docs/report.final.pdf",
    outputDir: "C:/out",
    baseName: "report.final",
    segments: [
      { start: 1, end: 3, label: "1-3" },
      { start: 4, end: 5, label: "4-5" },
    ],
  });
});
