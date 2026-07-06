"use strict";

/**
 * Common utilities for consistency validators.
 * Each validator receives an object of pre-read file contents and returns
 * { errors: string[], warnings: string[] }.
 */

const { readFileSync, existsSync, readdirSync } = require("fs");
const { join, resolve } = require("path");

const ROOT = resolve(__dirname, "../..");

function read(file) {
  try {
    return readFileSync(join(ROOT, file), "utf8");
  } catch {
    return null;
  }
}

function findAllFiles(dir, base = "") {
  const results = [];
  try {
    for (const entry of readdirSync(join(dir, base), { withFileTypes: true })) {
      const path = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(path + "/");
        results.push(...findAllFiles(dir, path));
      } else {
        results.push(path);
      }
    }
  } catch { /* ignore */ }
  return results;
}

function extractFrontmatterVersion(content) {
  const m = content.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

function extractBadgeVersion(content) {
  const m = content.match(/v(\d+\.\d+\.\d+(?:-[a-z0-9]+)?)/i);
  return m ? m[1] : null;
}

function hasDynamicBadge(content) {
  // GitHub Release badge auto-fetches the latest version from the API.
  // When present, the README badge is always current and version comparison
  // with SKILL.md frontmatter should be skipped.
  return /img\.shields\.io\/github\/v\/release\//.test(content);
}

function findCliFlags(content) {
  const setMatch = content.match(/LONG_FLAGS\s*=\s*new\s+Set\(\s*\[([^\]]+)\]/s);
  if (!setMatch) return [];
  return setMatch[1]
    .split(",")
    .map((s) => "--" + s.trim().replace(/['"]/g, ""))
    .filter((f) => f !== "--");
}

function extractRuntimeNodeMinVersion(content) {
  const m = content.match(/NODE_RUNTIME_MIN_VERSION\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function extractNodeVersionFile(content) {
  const m = content.trim().match(/^(?:v)?(\d+)(?:\.\d+\.\d+)?$/);
  return m ? Number(m[1]) : null;
}

module.exports = {
  ROOT, read, findAllFiles,
  extractFrontmatterVersion, extractBadgeVersion, hasDynamicBadge, findCliFlags,
  extractRuntimeNodeMinVersion, extractNodeVersionFile,
};
