#!/usr/bin/env node
/**
 * format-files.js — Run the markdown-formatter CLI on the authoritative file list.
 *
 * Usage: node scripts/format-files.js <flag>
 *   Examples:
 *     node scripts/format-files.js --fix        # format files in place
 *     node scripts/format-files.js --check       # check formatting (read-only)
 *     node scripts/format-files.js --verify      # verify formatting (read-only, stricter)
 *
 * Uses the file list from format-files-list.js as the single source of truth.
 */

"use strict";

const { spawnSync } = require("child_process");
const { resolve } = require("path");
const FORMAT_FILES = require("./format-files-list");

const ROOT = resolve(__dirname, "..");
const CLI = resolve(ROOT, "skills/markdown-formatter/src/index.js");

const flag = process.argv[2];
if (!flag) {
  console.error("Usage: node scripts/format-files.js <--fix|--check|--verify>");
  process.exit(2);
}

const result = spawnSync(process.execPath, [CLI, flag, ...FORMAT_FILES], {
  cwd: ROOT,
  encoding: "utf8",
  stdio: "inherit",
});

process.exit(result.status || 0);
