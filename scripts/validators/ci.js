"use strict";

/**
 * CI workflow validator.
 * Checks ci.yml for structural anti-patterns and required steps.
 */

const { read } = require("./common");

function validateCi(files) {
  const errors = [];
  const warnings = [];
  const ci = files[".github/workflows/ci.yml"];

  if (!ci) {
    warnings.push(".github/workflows/ci.yml not found — consider adding CI");
    return { errors, warnings };
  }

  // Anti-patterns that must NOT appear
  const forbids = [
    { pattern: /markdownlint/i, label: "uses markdownlint instead of this repo's formatter" },
    { pattern: /npx\s+markdown/i, label: "uses npx markdownlint" },
    { pattern: /npx\s+oxfmt/i, label: "uses npx oxfmt" },
    { pattern: /test\/fixtures\/violations/i, label: "includes violations/ in formatter check (will fail CI)" },
  ];
  for (const { pattern, label } of forbids) {
    if (pattern.test(ci)) {
      errors.push(`ci.yml: ${label}`);
    }
  }

  // Required patterns that must appear
  const required = [
    { pattern: /npm\s+run\s+test:structural/i, label: "runs test:structural for guard checks" },
    { pattern: /test\/unit\/.*\.test\.js/i, label: "runs unit tests" },
    { pattern: /test\/integration\/.*\.test\.js/i, label: "runs integration tests" },
    { pattern: /npm\s+run\s+format:check/i, label: "checks maintainer docs formatting" },
    { pattern: /staged-install-verify\.sh/i, label: "verifies staged runtime payload" },
    { pattern: /npm\s+ci/i, label: "installs repository dependencies" },
    { pattern: /CHECK_BASE_REF/i, label: "sets CHECK_BASE_REF for release-drift checks" },
    { pattern: /fetch-depth:\s*0/i, label: "uses full git depth for diff history in precheck" },
  ];
  for (const { pattern, label } of required) {
    if (!pattern.test(ci)) {
      warnings.push(`ci.yml: missing ${label}`);
    }
  }

  // .node-version alignment
  const nodeVersionFile = read(".node-version");
  const ciNodeVersion = nodeVersionFile
    ? read && extractNodeVersionFileFromContent(nodeVersionFile)
    : null;
  if (!ciNodeVersion) {
    errors.push(".node-version is missing or unreadable");
  }
  if (!/node-version-file:\s*\.node-version/.test(ci)) {
    warnings.push("ci.yml: setup-node should use node-version-file: .node-version for CI validation");
  }

  return { errors, warnings };
}

function extractNodeVersionFileFromContent(content) {
  const m = content.trim().match(/^(?:v)?(\d+)(?:\.\d+\.\d+)?$/);
  return m ? Number(m[1]) : null;
}

module.exports = { validateCi };
