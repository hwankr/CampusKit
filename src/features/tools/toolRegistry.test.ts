import test from "node:test";
import assert from "node:assert/strict";
import { toolRegistry } from "./toolRegistry.ts";

test("toolRegistry exposes one active tool and three placeholders", () => {
  assert.equal(toolRegistry.length, 4);
  assert.equal(toolRegistry.filter((tool) => tool.status === "active").length, 1);
  assert.deepEqual(
    toolRegistry.map((tool) => tool.id),
    ["pdfSplit", "convert", "merge", "extract"],
  );
});
