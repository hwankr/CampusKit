import test from "node:test";
import assert from "node:assert/strict";
import { enMessages } from "./en.ts";
import { koMessages } from "./ko.ts";

test("english and korean catalogs expose the same keys", () => {
  assert.deepEqual(Object.keys(enMessages).sort(), Object.keys(koMessages).sort());
});
