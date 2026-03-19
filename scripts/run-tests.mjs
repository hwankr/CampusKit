import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTests(resolved)));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(resolved);
    }
  }

  return files;
}

const testFiles = await collectTests(root);

if (testFiles.length === 0) {
  console.error("No TypeScript test files were found in src");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--experimental-specifier-resolution=node", "--test", ...testFiles],
  {
    stdio: "inherit",
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
