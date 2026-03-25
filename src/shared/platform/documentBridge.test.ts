import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const bridgePath = path.resolve("src/shared/platform/documentBridge.ts");

test("document bridge exposes the preview contract and invoke surface", async () => {
  const source = await readFile(bridgePath, "utf8");

  assert.match(source, /RenderPdfPagesRequest/);
  assert.match(source, /RenderPdfPagesResponse/);
  assert.match(source, /renderPdfPages/);
  assert.match(source, /render_pdf_pages/);
});
