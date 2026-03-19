import assert from "node:assert/strict";
import test from "node:test";
import { buildPdfDocumentMetadata, getPendingPdfFileName } from "./pdfDocument.ts";

test("buildPdfDocumentMetadata falls back to the selected path when the backend file name is blank", () => {
  const document = buildPdfDocumentMetadata("C:/docs/semester-plan.final.pdf", {
    fileName: "   ",
    pageCount: 12,
  });

  assert.deepEqual(document, {
    inputPath: "C:/docs/semester-plan.final.pdf",
    fileName: "semester-plan.final.pdf",
    pageCount: 12,
  });
});

test("getPendingPdfFileName extracts the visible name from a selected path", () => {
  assert.equal(getPendingPdfFileName("C:/docs/input/report.pdf"), "report.pdf");
  assert.equal(getPendingPdfFileName(null), "");
});
