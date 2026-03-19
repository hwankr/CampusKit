import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.resolve("src/features/pdf-split/PdfSplitPage.tsx");

test("pdf split page declares the empty and demo state markers", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /type ViewMode = "empty" \| "demo"/);
  assert.match(source, /data-slot="dropzone"/);
  assert.match(source, /data-slot="preview-panel"/);
  assert.match(source, /data-slot="thumbnail-rail"/);
  assert.match(source, /data-slot="ranges-panel"/);
});

test("pdf split page stays mock-only and avoids real split services", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.doesNotMatch(source, /pdfSplitService/);
  assert.doesNotMatch(source, /documentBridge/);
  assert.match(source, /CampusKit-handbook-split-01\.pdf/);
  assert.match(source, /data-slot="save-placeholder"/);
});
