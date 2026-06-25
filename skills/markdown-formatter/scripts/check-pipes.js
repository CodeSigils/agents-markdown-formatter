#!/usr/bin/env node
/**
 * check-pipes.js - Detect adjacent pipe artifacts (double pipes) in GFM tables.
 *
 * Double pipes (||) create phantom empty columns: leading || adds an empty first
 * column, internal || creates empty cells, trailing || adds an empty last column.
 * These are syntactically valid GFM but almost always unintended.
 *
 * This checker distinguishes real double-pipe artifacts from:
 *   - Escaped pipes (\\|\\|) — these are literal pipe characters
 *   - Inline code spans containing `||` — these are not structural issues
 *
 * Usage: node check-pipes.js <filePath...>
 * Exits 0 if all files are valid, 1 if violations are found.
 */

"use strict";

const fs = require("fs");
const process = require("process");

/**
 * Detect double-pipe artifacts (adjacent pipes) in table rows.
 * Distinguishes leading (phantom first column), internal (empty cell), and
 * trailing (phantom last column) patterns.
 *
 * @param {string} content File text.
 * @returns {Array<{lineIndex: number, line: string, detail: string}>} Issues found.
 */
function detectDoublePipes(content) {
  const lines = content.split("\n");
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("||")) continue;

    // Must look like a table row (leading pipe after optional whitespace)
    if (!line.trim().startsWith("|")) continue;

    // Must have at least 2 pipe chars total to be a table row
    const pipeCount = (line.match(/\|/g) || []).length;
    if (pipeCount < 2) continue;

    // Strip escaped pipes so \\|\\| doesn't false-positive
    const plainLine = line.replace(/\\\|/g, "");
    const adjPos = plainLine.indexOf("||");
    if (adjPos === -1) continue;

    // Check if adjacent pipes are inside an inline code span
    const before = plainLine.slice(0, adjPos);
    const backtickCount = (before.match(/`/g) || []).length;
    if (backtickCount % 2 === 1) continue;

    issues.push({
      lineIndex: i,
      line,
      detail:
        adjPos === 0
          ? "Leading double pipe (phantom empty first column)"
          : adjPos >= line.length - 2
            ? "Trailing double pipe (phantom empty last column)"
            : "Adjacent double pipe (possible empty cell or merge artifact)",
    });
  }

  return issues;
}

/**
 * Validate a single file for double-pipe violations.
 *
 * @param {string} content File text.
 * @returns {Array<string>} Human-readable error messages.
 */
function validatePipes(content) {
  const issues = detectDoublePipes(content);
  return issues.map(
    (issue) => `Line ${issue.lineIndex + 1}: ${issue.detail}`,
  );
}

/**
 * Validate a file by path.
 *
 * @param {string} filePath Path to markdown file.
 * @returns {Array<string>} Human-readable error messages.
 */
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return validatePipes(content);
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    console.error("Usage: node check-pipes.js <filePath...>");
    process.exitCode = 1;
    return;
  }

  let failed = false;
  for (const filePath of argv) {
    try {
      const errors = validateFile(filePath);
      if (errors.length > 0) {
        errors.forEach((e) => console.error(`${filePath}: ${e}`));
        failed = true;
      }
    } catch (err) {
      console.error(`Error reading file ${filePath}: ${err.message}`);
      failed = true;
    }
  }

  process.exitCode = failed ? 1 : 0;
}

module.exports = {
  detectDoublePipes,
  validatePipes,
  validateFile,
  main,
};

if (require.main === module) {
  main();
}
