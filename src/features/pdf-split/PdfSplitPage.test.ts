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
  assert.doesNotMatch(source, /documentBridge/);
});

test("pdf split page keeps the current workspace slots while running a live split flow", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /parsePageRangeInput/);
  assert.match(source, /toSplitRequestPayload/);
  assert.match(source, /buildPreviewFileName/);
  assert.match(source, /data-slot="dropzone"/);
  assert.match(source, /data-slot="document-info"/);
  assert.match(source, /data-slot="preview-panel"/);
  assert.match(source, /data-slot="thumbnail-rail"/);
  assert.match(source, /data-slot="ranges-panel"/);
  assert.match(source, /data-slot="save-action"/);
});
