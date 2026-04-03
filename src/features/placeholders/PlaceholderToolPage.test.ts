import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const placeholderPagePath = path.resolve("src/features/placeholders/PlaceholderToolPage.tsx");
const sidebarPath = path.resolve("src/app/layout/Sidebar.tsx");

test("placeholder tool page keeps availability messaging compact", async () => {
  const source = await readFile(placeholderPagePath, "utf8");
  const statusMentions = source.match(/t\("statusPlanned"\)/g) ?? [];

  assert.equal(statusMentions.length, 1);
  assert.doesNotMatch(source, /t\("headerKicker"\)/);
});

test("sidebar no longer renders the development footnote", async () => {
  const source = await readFile(sidebarPath, "utf8");

  assert.doesNotMatch(source, /sidebarFootnote/);
});
