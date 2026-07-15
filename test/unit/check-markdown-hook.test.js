const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { chmodSync, closeSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } = require('node:fs');
const { delimiter, join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const ROOT = resolve(__dirname, '../..');
const HOOK = join(ROOT, 'scripts/check-markdown.sh');

function runHook(formatterBody) {
  const dir = mkdtempSync(join(tmpdir(), 'markdown-formatter-hook-'));
  const binDir = join(dir, 'bin');
  const markdownPath = join(dir, 'document.md');
  const formatterPath = join(binDir, 'mdfmt');
  const payloadPath = join(dir, 'payload.json');

  mkdirSync(binDir);
  writeFileSync(markdownPath, '# Document\n');
  writeFileSync(formatterPath, `#!/usr/bin/env bash\n${formatterBody}\n`);
  writeFileSync(payloadPath, JSON.stringify({ tool_input: { path: markdownPath } }));
  chmodSync(formatterPath, 0o755);

  const stdinFd = openSync(payloadPath, 'r');
  let result;
  try {
    result = spawnSync('bash', [HOOK], {
      stdio: [stdinFd, 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH || ''}` },
      timeout: 5000,
    });
  } finally {
    closeSync(stdinFd);
  }

  return { dir, result };
}

describe('Hermes Markdown hook', () => {
  it('keeps stdout valid JSON when the formatter emits diagnostics', () => {
    const { dir, result } = runHook("echo 'Snapshot written'; echo 'Structure preserved' >&2; exit 0");
    try {
      assert.equal(result.status, 0, `${result.error || ''}\n${result.signal || ''}\n${result.stderr}`);
      assert.deepStrictEqual(JSON.parse(result.stdout), {});
      assert.match(result.stderr, /Snapshot written/);
      assert.match(result.stderr, /Structure preserved/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns actionable JSON context when formatting fails', () => {
    const { dir, result } = runHook("echo 'unclosed fence' >&2; exit 1");
    try {
      assert.equal(result.status, 0, `${result.error || ''}\n${result.signal || ''}\n${result.stderr}`);
      const response = JSON.parse(result.stdout);
      assert.match(response.context, /formatting failed/);
      assert.match(response.context, /unclosed fence/);
      assert.match(result.stderr, /unclosed fence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
