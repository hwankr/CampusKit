import test from "node:test";
import assert from "node:assert/strict";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./splitJob.ts";

test("buildPreviewFileName creates stable split output names", () => {
  const segment = { start: 5, end: 8, label: "5-8", pageCount: 4 };

  assert.equal(buildPreviewFileName("CampusKit", segment, 1), "CampusKit-part-02-pages-5-8.pdf");
});

test("deriveSplitBaseName falls back to the source file stem", () => {
  assert.equal(deriveSplitBaseName("C:/docs/report.final.pdf"), "report.final");
});

test("toSplitRequestPayload maps explicit segments into the split backend shape", () => {
  const segments = [
    { start: 5, end: 10, label: "5-10", pageCount: 6 },
    { start: 11, end: 20, label: "11-20", pageCount: 10 },
  ];

  assert.deepEqual(toSplitRequestPayload("C:/docs/report.final.pdf", "C:/out", segments), {
    inputPath: "C:/docs/report.final.pdf",
    outputDir: "C:/out",
    baseName: "report.final",
    segments: [
      { start: 5, end: 10, label: "5-10" },
      { start: 11, end: 20, label: "11-20" },
    ],
  });
});
