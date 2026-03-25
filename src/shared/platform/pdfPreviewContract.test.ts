import assert from "node:assert/strict";
import test from "node:test";
import { pdfPreviewSizePresets } from "./pdfPreviewContract.ts";

test("pdf preview contract exposes the fixed v1 size presets", () => {
  assert.deepEqual(pdfPreviewSizePresets, ["thumbnail", "focus"]);
});
