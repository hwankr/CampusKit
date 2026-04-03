import test from "node:test";
import assert from "node:assert/strict";
import { enMessages } from "./en.ts";
import { koMessages } from "./ko.ts";

test("english and korean catalogs expose the same keys", () => {
  assert.deepEqual(Object.keys(enMessages).sort(), Object.keys(koMessages).sort());
});

test("live catalog copy avoids development-stage wording", () => {
  const liveKeys = [
    "headerKicker",
    "statusReady",
    "statusPlanned",
    "pdfSplitDescription",
    "convertDescription",
    "mergeDescription",
    "extractDescription",
    "placeholderBody",
  ] as const;

  for (const key of liveKeys) {
    assert.doesNotMatch(enMessages[key], /(phase\s*\d|workspace|shell|placeholder|mock|milestone)/i);
    assert.doesNotMatch(koMessages[key], /(1차 목표|phase\s*\d|workspace|구조만|이번 단계|mock)/i);
  }
});
