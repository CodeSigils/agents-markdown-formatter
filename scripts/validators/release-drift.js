"use strict";

/**
 * Release-drift validator.
 * When runtime files change, CHANGELOG must have Unreleased entries,
 * and SKILL.md version should reflect accumulated changes since latest tag.
 */

const { spawnSync } = require("child_process");
const { ROOT, read, extractFrontmatterVersion } = require("./common");

const RUNTIME_DIRS = ["skills/markdown-formatter/"];

function isRuntimeFile(file) {
  return RUNTIME_DIRS.some((d) => file.startsWith(d));
}

function getChangedFilesSince(ref) {
  const result = spawnSync(
    "git", ["diff", "--name-only", ref, "HEAD"],
    { cwd: ROOT, encoding: "utf8", timeout: 10000 }
  );
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim().split("\n").filter((f) => f.length > 0);
}

function getLatestTagVersion() {
  const result = spawnSync(
    "git", ["tag", "-l", "v*", "--sort=-version:refname"],
    { cwd: ROOT, encoding: "utf8", timeout: 10000 }
  );
  if (result.error || result.status !== 0 || !result.stdout.trim()) return null;
  const tag = result.stdout.trim().split("\n")[0];
  return tag.replace(/^v/, "");
}

function validateReleaseDrift(files) {
  const errors = [];
  const warnings = [];

  const baseRef = process.env.CHECK_BASE_REF || "origin/main";
  const changedFiles = getChangedFilesSince(baseRef);

  if (changedFiles === null) {
    warnings.push(
      `release-drift: git diff against "${baseRef}" failed (no remote or shallow clone); skipping checks`
    );
    return { errors, warnings };
  }

  const runtimeChanges = changedFiles.filter(isRuntimeFile);

  if (runtimeChanges.length > 0) {
    const changelogPath = "CHANGELOG.md";
    if (!changedFiles.includes(changelogPath)) {
      errors.push(
        `release-drift: ${runtimeChanges.length} runtime file(s) changed but ${changelogPath} did not — ` +
        `add entries under "## Unreleased"`
      );
    } else {
      const changelog = read(changelogPath);
      if (changelog && !changelog.includes("## Unreleased")) {
        errors.push(
          `release-drift: ${changelogPath} changed but missing "## Unreleased" section — ` +
          `add entries before the first versioned heading`
        );
      }
    }
  }

  const skillMd = files["skills/markdown-formatter/SKILL.md"];
  const latestTagVer = getLatestTagVersion();
  if (runtimeChanges.length > 0 && latestTagVer) {
    const currentVer = extractFrontmatterVersion(skillMd || "");
    if (currentVer && currentVer === latestTagVer) {
      warnings.push(
        `release-drift: ${runtimeChanges.length} runtime file(s) changed since tag v${latestTagVer} ` +
        `but SKILL.md version is still "${currentVer}" — consider a release`
      );
    }
  }

  return { errors, warnings };
}

module.exports = { validateReleaseDrift };
