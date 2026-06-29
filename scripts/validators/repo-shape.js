"use strict";

/**
 * Repository shape validator.
 * Checks expected files exist, historical artifacts are gone,
 * and no unexpected payload files exist.
 */

const { existsSync } = require("fs");
const { join } = require("path");
const { ROOT, read, findAllFiles } = require("./common");

const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".omo", ".open-mem", "oxfmt-spike"]);

const PLAN_EXPECTED_REPO_SHAPE = new Set([
  "AGENTS.md",
  "README.md",
  "CHANGELOG.md",
  ".node-version",
  ".oxfmtrc.json",
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/check-all.js",
  "scripts/check-consistency.js",
  "scripts/release.sh",
  "scripts/staged-install-verify.sh",
  "skills/markdown-formatter/SKILL.md",
  "skills/markdown-formatter/.oxfmtrc.json",
  "skills/markdown-formatter/src/index.js",
  "skills/markdown-formatter/scripts/check-fences.js",
  "skills/markdown-formatter/scripts/check-structure.js",
  "skills/markdown-formatter/scripts/check-tables.js",
  "skills/markdown-formatter/scripts/check-pipes.js",
  "test/",
]);

const HISTORICAL_LINT_ARTIFACTS = new Set([
  "lint.js",
  "mdformat.js",
  "post-write.js",
  "references/rules.md",
  "references/table-validate.js",
  "test/formatter.test.js",
  "test/structure.test.js",
  "test/cli.test.js",
]);

const PAYLOAD_PREFIXES = [
  "skills/markdown-formatter/src/",
  "skills/markdown-formatter/scripts/",
];

const KNOWN_PAYLOAD_CHECKS = new Set([
  "check-fences.js", "check-structure.js", "check-tables.js", "check-pipes.js",
]);

function validateRepoShape() {
  const errors = [];
  const warnings = [];

  const allFiles = findAllFiles(ROOT).filter((f) => {
    const parts = f.split("/");
    return !parts.some((p) => EXCLUDE_DIRS.has(p));
  });

  for (const expected of PLAN_EXPECTED_REPO_SHAPE) {
    if (expected.endsWith("/")) {
      if (!allFiles.some((f) => f.startsWith(expected))) {
        errors.push(`plan drift: expected directory "${expected}" is missing`);
      }
    } else if (!existsSync(join(ROOT, expected))) {
      errors.push(`plan drift: expected file "${expected}" is missing`);
    }
  }

  for (const stale of HISTORICAL_LINT_ARTIFACTS) {
    if (existsSync(join(ROOT, stale))) {
      errors.push(`historical lint artifact "${stale}" exists but should not`);
    }
  }

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

  return { errors, warnings };
}

module.exports = { validateRepoShape };
