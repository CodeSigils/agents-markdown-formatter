const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  parseArgs,
  resolveInputFiles,
} = require('../../skills/markdown-formatter/src/index.js');

describe('formatter CLI helper unit tests', () => {
  it('parses multiple positional paths with --all', () => {
    const args = parseArgs(['node', 'index.js', '--check', '--all', 'a', 'b']);

    assert.equal(args.check, true);
    assert.equal(args.all, true);
    assert.deepStrictEqual(args._, ['a', 'b']);
  });

  it('requires --all for directory inputs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'formatter-helpers-'));
    try {
      assert.throws(() => resolveInputFiles([dir], false), /Directory input requires --all/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recursively resolves markdown files from every supplied directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'formatter-helpers-'));
    try {
      const one = join(root, 'one');
      const two = join(root, 'two');
      mkdirSync(one);
      mkdirSync(two);
      writeFileSync(join(one, 'a.md'), '# A\n');
      writeFileSync(join(two, 'b.mdx'), '# B\n');
      writeFileSync(join(two, 'ignore.txt'), 'nope\n');

      const files = resolveInputFiles([one, two], true);

      assert.equal(files.length, 2);
      assert(files.some((file) => file.endsWith('a.md')));
      assert(files.some((file) => file.endsWith('b.mdx')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
