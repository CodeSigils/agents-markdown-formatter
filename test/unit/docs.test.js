const { it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

it('uses preflight wording in user-facing docs', () => {
  for (const file of ['README.md', 'SKILL.md']) {
    const content = readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /prelight/i, `${file} should say preflight, not prelight`);
    assert.match(content, /preflight/i, `${file} should document preflight behavior`);
  }
});

it('documents guarded unclosed-fence behavior consistently', () => {
  for (const file of ['README.md', 'SKILL.md']) {
    const content = readFileSync(file, 'utf8');
    assert.match(content, /guard(?:ed|`)?.*fail[\s\S]{0,120}without modifying/i,
      `${file} should document that guarded mode fails without modifying the file`);
    assert.match(content, /unguarded write modes[\s\S]{0,80}(?:continue|still) format/i,
      `${file} should document that only unguarded write modes continue formatting`);
  }
});

it('documents the Hermes hook jq prerequisite', () => {
  for (const file of ['README.md', 'SKILL.md']) {
    const content = readFileSync(file, 'utf8');
    assert.match(content, /`jq` \(Hermes shell hook only\)/,
      `${file} should document jq as a Hermes-hook-only prerequisite`);
  }
});
