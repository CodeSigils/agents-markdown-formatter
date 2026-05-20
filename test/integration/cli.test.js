const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'skills/markdown-formatter/src/index.js');

function runCli(args, options = {}) {
  return spawnSync('node', [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  });
}

describe('markdown formatter CLI integration', () => {
  it('--all checks every supplied directory, not just the first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'markdown-formatter-cli-'));
    try {
      const goodDir = join(dir, 'good');
      const badDir = join(dir, 'bad');
      require('node:fs').mkdirSync(goodDir);
      require('node:fs').mkdirSync(badDir);
      writeFileSync(join(goodDir, 'clean.md'), '# Clean\n\nText.\n');
      writeFileSync(join(badDir, 'dirty.md'), '# Dirty\n\n| A | B |\n|---|---|\n| 1 | 2 |\n');

      const result = runCli(['--check', '--all', goodDir, badDir]);

      assert.notStrictEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /dirty\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--validate runs structural, fence, and table checks', () => {
    const result = runCli(['--validate', 'test/fixtures/violations/table-column-drift.md']);

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /row 1 has 4 cols but header has 2|Table row/);
  });

  it('--verify is read-only and fails on unformatted files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'markdown-formatter-verify-'));
    const file = join(dir, 'dirty.md');
    try {
      const original = '# Dirty\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';
      writeFileSync(file, original);

      const result = runCli(['--verify', file]);

      assert.notStrictEqual(result.status, 0);
      assert.equal(require('node:fs').readFileSync(file, 'utf8'), original);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
