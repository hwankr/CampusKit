import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const servicePath = path.resolve("src/features/pdf-split/service/pdfSplitService.ts");

test("pdf split service exposes preview execution through the feature boundary", async () => {
  const source = await readFile(servicePath, "utf8");

  assert.match(source, /getPdfMetadata/);
  assert.match(source, /pickOutputDirectory/);
  assert.match(source, /pickPdfFile/);
  assert.match(source, /renderPdfPages/);
  assert.match(source, /splitPdf/);
});
