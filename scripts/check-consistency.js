#!/usr/bin/env node
/**
 * check-consistency.js - Anti-drift consistency checker for markdown-formatter.
 * Dev-only: not shipped in the runtime skill payload.
 */

"use strict";

const { readFileSync, existsSync, readdirSync } = require("fs");
const { join, resolve } = require("path");

const ROOT = resolve(__dirname, "..");

// Files the plan.md "Target Repository / Skill Shape" section says should exist.
// Stale plan references are errors; missing shipped files are errors.
const PLAN_EXPECTED_SHIP = new Set([
  "AGENTS.md",
  "README.md",
  "plan.md",
  ".oxfmtrc.json",
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/check-consistency.js",
  "scripts/staged-install-verify.sh",
  "skills/markdown-formatter/SKILL.md",
  "skills/markdown-formatter/src/index.js",
  "skills/markdown-formatter/scripts/check-fences.js",
  "skills/markdown-formatter/scripts/check-structure.js",
  "skills/markdown-formatter/scripts/check-tables.js",
  "skills/markdown-formatter/references/",
  "test/",
]);

// Artifacts plan.md describes but were NOT created (and are intentionally skipped).
const PLAN_STALE_ARTIFACTS = new Set([
  "lint.js",
  "mdformat.js",
  "post-write.js",
  "references/rules.md",
  "references/table-validate.js",
  "test/formatter.test.js",
  "test/structure.test.js",
  "test/cli.test.js",
]);

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

function read(file) {
  try {
    return readFileSync(join(ROOT, file), "utf8");
  } catch {
    return null;
  }
}

function extractFrontmatterVersion(content) {
  const m = content.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

function extractBadgeVersion(content) {
  const m = content.match(/v(\d+\.\d+\.\d+(?:-[a-z0-9]+)?)/i);
  return m ? m[1] : null;
}

function findCliFlags(content) {
  const setMatch = content.match(/LONG_FLAGS\s*=\s*new\s+Set\(\s*\[([^\]]+)\]/s);
  if (!setMatch) return [];
  return setMatch[1]
    .split(",")
    .map((s) => "--" + s.trim().replace(/['"]/g, ""))
    .filter((f) => f !== "--");
}

const SHIP_PATTERNS = [
  "skills/markdown-formatter/SKILL.md",
  "skills/markdown-formatter/src/index.js",
  "skills/markdown-formatter/scripts/check-structure.js",
  "skills/markdown-formatter/scripts/check-fences.js",
  "skills/markdown-formatter/scripts/check-tables.js",
  "skills/markdown-formatter/references/",
  "README.md",
  "AGENTS.md",
];

const KNOWN_OXFMT_KEYS = new Set([
  "tabWidth", "printWidth", "endOfLine", "insertFinalNewline",
  "proseWrap", "embeddedLanguageFormatting", "ignorePatterns",
]);

const errors = [];
const warnings = [];

const pkgJson = read("package.json");
if (pkgJson) {
  try {
    const pkg = JSON.parse(pkgJson);
    const devDeps = pkg.devDependencies || {};
    const pkgVersion = devDeps.oxfmt;
    if (pkgVersion) {
      const latest = "0.51.0";
      if (pkgVersion !== latest && !pkgVersion.startsWith("^" + latest)) {
        warnings.push(
          `oxfmt in package.json is ${pkgVersion}, latest is ${latest} — consider upgrading`
        );
      }
    } else {
      warnings.push("oxfmt not found in package.json devDependencies");
    }
  } catch (e) {
    errors.push(`package.json is not valid JSON: ${e.message}`);
  }
}

const staleChecks = [
  { pattern: /markdownlint-cli2/, reason: "old formatter tool" },
  { pattern: /npx\s+markdownlint/, reason: "old linter via npx" },
  { pattern: /format-tables\.js.*format|primary.*formatter.*format-tables/i, reason: "format-tables is not the primary formatter" },
  { pattern: /name:\s*markdown-lint/, reason: "skill name should be 'markdown-formatter'" },
];

const readme = read("README.md");
const skillMd = read("skills/markdown-formatter/SKILL.md");
const indexJs = read("skills/markdown-formatter/src/index.js");
const agentsMd = read("AGENTS.md");
const oxfmtrc = read(".oxfmtrc.json");

if (readme && skillMd) {
  const badgeVer = extractBadgeVersion(readme);
  const frontVer = extractFrontmatterVersion(skillMd);
  if (badgeVer && frontVer && badgeVer !== frontVer) {
    errors.push(`README badge version "${badgeVer}" != SKILL.md frontmatter "${frontVer}"`);
  } else if (!badgeVer && frontVer) {
    warnings.push(`README: no version badge found (SKILL.md has "${frontVer}")`);
  }
} else if (skillMd && !readme) {
  warnings.push("README.md not found — skipping version badge check");
}

if (indexJs && skillMd) {
  const flags = findCliFlags(indexJs);
  for (const flag of flags) {
    if (!skillMd.includes(flag)) {
      errors.push(`CLI flag "${flag}" in index.js not documented in SKILL.md`);
    }
  }
  for (const flag of flags) {
    if (readme && !readme.includes(flag)) {
      warnings.push(`CLI flag "${flag}" in index.js not documented in README.md`);
    }
  }
}

if (oxfmtrc) {
  try {
    const cfg = JSON.parse(oxfmtrc);
    for (const key of Object.keys(cfg)) {
      if (!KNOWN_OXFMT_KEYS.has(key)) {
        warnings.push(`.oxfmtrc.json contains unknown key "${key}" — verify against official oxfmt docs`);
      }
    }
  } catch (e) {
    errors.push(`.oxfmtrc.json is not valid JSON: ${e.message}`);
  }
}

for (const [file, content] of [
  ["AGENTS.md", agentsMd],
  ["README.md", readme],
  ["skills/markdown-formatter/SKILL.md", skillMd],
  ["skills/markdown-formatter/src/index.js", indexJs],
]) {
  if (!content) continue;
  if (!SHIP_PATTERNS.some((p) => file.startsWith(p))) continue;
  for (const { pattern, reason } of staleChecks) {
    if (pattern.test(content)) {
      errors.push(`stale ref in ${file}: "${reason}"`);
    }
  }
}

const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".omo", ".open-mem", "oxfmt-spike"]);
const allFiles = findAllFiles(ROOT).filter((f) => {
  const parts = f.split("/");
  return !parts.some((p) => EXCLUDE_DIRS.has(p));
});

for (const expected of PLAN_EXPECTED_SHIP) {
  if (expected.endsWith("/")) {
    if (!allFiles.some((f) => f.startsWith(expected))) {
      errors.push(`plan drift: expected directory "${expected}" is missing`);
    }
  } else if (!existsSync(join(ROOT, expected))) {
    errors.push(`plan drift: expected file "${expected}" is missing`);
  }
}

for (const stale of PLAN_STALE_ARTIFACTS) {
  if (existsSync(join(ROOT, stale))) {
    errors.push(`plan drift: stale artifact "${stale}" exists but should not`);
  }
}

const PAYLOAD_PREFIXES = [
  "skills/markdown-formatter/src/",
  "skills/markdown-formatter/scripts/",
];
const KNOWN_PAYLOAD_CHECKS = new Set([
  "check-all.js", "check-fences.js", "check-structure.js", "check-tables.js",
]);
for (const prefix of PAYLOAD_PREFIXES) {
  const unexpected = allFiles.filter((f) => {
    if (!f.startsWith(prefix)) return false;
    if (f.endsWith("/")) return false;
    const name = f.slice(prefix.length);
    return name.startsWith("check-") && !KNOWN_PAYLOAD_CHECKS.has(name);
  });
  for (const u of unexpected) {
    errors.push(`plan drift: unexpected file in skill payload: "${u}"`);
  }
}

if (errors.length > 0) {
  console.error("check-consistency ERRORS:");
  for (const e of errors) console.error("  ✗", e);
}

if (warnings.length > 0) {
  console.warn("check-consistency WARNINGS:");
  for (const w of warnings) console.warn("  ⚠", w);
}

if (errors.length === 0) console.log("check-consistency: OK");

process.exit(errors.length > 0 ? 1 : 0);
