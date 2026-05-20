#!/usr/bin/env node
/**
 * check-all.js - Run structural checks against valid fixtures and ensure violation fixtures fail.
 *
 * Usage: node check-all.js [paths...]
 *   Defaults: test/fixtures/current test/fixtures/oxfmt-spike test/fixtures/violations
 *
 * Exit codes:
 *   0  All checks passed
 *   1  One or more checks failed
 */
'use strict';

const { spawnSync } = require('child_process');
const { join, resolve, extname, relative } = require('path');
const { readdirSync, statSync, existsSync } = require('fs');

const ROOT = resolve(__dirname, '..');
const SKILL_DIR = resolve(ROOT, 'skills/markdown-formatter');
const DEFAULT_TARGETS = [
  'test/fixtures/current',
  'test/fixtures/oxfmt-spike',
  'test/fixtures/violations',
];
const VALID_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);
const CHECKS = [
  { name: 'check-structure', args: ['--verify'] },
  { name: 'check-fences', args: [] },
  { name: 'check-tables', args: [] },
];

function collectFiles(targets) {
  const files = [];
  for (const target of targets) {
    const absolute = resolve(ROOT, target);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        const full = join(absolute, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectFiles([relative(ROOT, full)]));
        } else if (VALID_EXTENSIONS.has(extname(entry.name))) {
          files.push(full);
        }
      }
    } else if (VALID_EXTENSIONS.has(extname(absolute)) && !absolute.endsWith('.structure.json')) {
      files.push(absolute);
    }
  }
  return [...new Set(files)].sort();
}

function runCheck(check, file) {
  const scriptPath = join(SKILL_DIR, 'scripts', `${check.name}.js`);
  const result = spawnSync('node', [scriptPath, ...check.args, file], { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function isViolationFixture(file) {
  return relative(ROOT, file).split('/').includes('violations');
}

const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_TARGETS;
const files = collectFiles(targets);

if (files.length === 0) {
  console.error('No .md/.mdx files found.');
  process.exit(1);
}

let failed = false;
let validCount = 0;
let violationCount = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const results = CHECKS.map((check) => ({ check, ...runCheck(check, file) }));

  if (isViolationFixture(file)) {
    violationCount++;
    if (results.every((result) => result.ok)) {
      console.error(`FAIL: violation fixture passed all checks: ${rel}`);
      failed = true;
    } else {
      console.log(`PASS: violation detected: ${rel}`);
    }
    continue;
  }

  validCount++;
  for (const result of results) {
    if (!result.ok) {
      console.error(`FAIL: ${result.check.name}.js ${rel}`);
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      failed = true;
    }
  }
  if (results.every((result) => result.ok)) {
    console.log(`PASS: ${rel}`);
  }
}

if (failed) {
  console.error('\nOne or more structural checks failed.');
  process.exit(1);
}

console.log(`\nAll structural checks passed (${validCount} valid, ${violationCount} expected violations).`);
