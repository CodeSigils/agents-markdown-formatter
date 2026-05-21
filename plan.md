# Maintainer Plan: Agents Markdown Formatter

> Repository-only maintainer and agent context. Do not include `plan.md` in the installed runtime payload or copy it
> into `~/.hermes/skills/markdown-formatter/`.

## Current goal

Maintain a formatter-first Hermes-compatible Markdown skill at `skills/markdown-formatter/`.

The active implementation formats GitHub-Flavored Markdown (GFM) and MDX with Oxc's `oxfmt`, plus repository-owned
structural checks for fences and tables. Its documentation positions the project as deterministic, rollback-safe
Markdown normalization for AI-agent workflows. It replaces the historical `markdownlint-cli2` + custom table formatter
pipeline preserved under `references/prior-art/`.

## Current scope

In scope for v1:

- GFM tables, fenced code blocks, task lists, headings, lists, blockquotes, links, autolinks, inline code, and
  strikethrough
- MDX files as Markdown + JSX formatting via Oxfmt
- Structural checks for fence counts/styles/info strings and table column drift
- Rollback-safe `--fix --guard` behavior when post-format structural drift is detected
- Zero npm runtime dependencies in the shipped skill payload
- Public documentation for the problem cured, formatting philosophy, and table safety policy
- Repository changelog maintained outside the shipped runtime payload

Out of scope for v1:

- Obsidian wiki links
- Mermaid validation
- Pandoc dialects
- Semantic rewriting
- YAML frontmatter semantics
- JSX syntax validation inside MDX
- Runtime binary download or `npx` fallback

## Active implementation target

```text
agents-markdown-formatter/
├── AGENTS.md
├── README.md
├── plan.md
├── CHANGELOG.md
├── .oxfmtrc.json                    # repository/dev config copy
├── .github/workflows/ci.yml
├── package.json                     # dev-only dependencies and scripts
├── scripts/
│   ├── check-all.js                 # repository test runner
│   ├── check-consistency.js         # anti-drift checker
│   └── staged-install-verify.sh     # runtime payload verifier
├── skills/
│   └── markdown-formatter/
│       ├── SKILL.md                 # shipped skill definition
│       ├── .oxfmtrc.json            # shipped runtime Oxfmt config
│       ├── src/index.js             # canonical formatter CLI
│       └── scripts/
│           ├── check-fences.js
│           ├── check-structure.js
│           └── check-tables.js
└── test/
    ├── fixtures/
    ├── integration/
    ├── unit/
    └── staged-artifact/             # generated, ignored
```

## Runtime payload allowlist

The installed user payload must contain only:

- `skills/markdown-formatter/SKILL.md`
- `skills/markdown-formatter/.oxfmtrc.json`
- `skills/markdown-formatter/src/index.js`
- `skills/markdown-formatter/scripts/check-structure.js`
- `skills/markdown-formatter/scripts/check-fences.js`
- `skills/markdown-formatter/scripts/check-tables.js`

Repository-only files must not ship: `plan.md`, `AGENTS.md`, `README.md`, `test/`, root `scripts/`, CI files,
`package.json`, lockfiles, `node_modules/`, coverage, generated agent state, local session/cache files, or repository
release notes.

`bash scripts/staged-install-verify.sh` is the source of truth for staged payload verification.

## Formatter and guard behavior

The CLI resolves `oxfmt` in this order:

1. `./node_modules/.bin/oxfmt` from the caller's current working directory
2. `./node_modules/oxfmt/bin/oxfmt` from the caller's current working directory
3. `node_modules` under the skill directory, if present
4. `oxfmt` on PATH
5. Fail with actionable setup instructions

The CLI passes the shipped `skills/markdown-formatter/.oxfmtrc.json` config to Oxfmt and disables nested config
discovery when that config exists. The shipped config wraps prose at 120 characters and leaves fenced code content
unchanged.

Guard semantics:

- `--check --guard` is read-only.
- `--dry-run --guard` is read-only.
- `--verify` is read-only and checks structure, formatting, and idempotence.
- `--fix --guard` writes through Oxfmt, checks post-format structure, and restores the original file content if
  structural drift is detected.
- Temporary `<file>.structure.json` snapshots are deleted after use; pre-existing snapshots are restored unchanged.

## Development validation

Run these before reporting shipping readiness:

```bash
node skills/markdown-formatter/src/index.js --check README.md AGENTS.md CHANGELOG.md plan.md skills/markdown-formatter/SKILL.md
npm test
npm run test:unit
npm run test:integration
bash scripts/staged-install-verify.sh
node scripts/check-consistency.js
```

Do not validate repository Markdown with unrelated external Markdown formatters or linters. This repository exists to
validate the Oxc/Oxfmt path.

## Release posture

`v1.0.0` is the current runtime release tag. Repository-only maintenance commits after that tag, such as CI runtime
updates or anti-drift checker cleanup, do not automatically imply a new runtime release when the shipped files under
`skills/markdown-formatter/` are unchanged.

Release rules:

- Do not force-move a published tag.
- Keep runtime payload changes separate from repository-only CI, test, checker, or documentation maintenance.
- Before tagging a runtime release, verify the exact commit with the development validation commands above, staged
  install verification, clean git status, and green GitHub Actions.
- Avoid adding new feature scope during release cleanup; capture new dialects, embedded-code formatting, or broad config
  systems as follow-up work instead.

## Anti-drift rules

Update every affected source of truth in the same change whenever behavior, commands, file paths, skill identity, Oxfmt
configuration, validation policy, install payload, release process, supported workflows, fixture policy, CI behavior, or
publication/readiness status changes.

Check at least these surfaces before completion:

- `README.md`
- `AGENTS.md`
- `plan.md`
- `skills/markdown-formatter/**`
- `test/**`
- `scripts/check-consistency.js`
- `scripts/staged-install-verify.sh`
- `.github/workflows/ci.yml`
- `CHANGELOG.md`

Stale or contradictory claims about guard write safety, shipped files, installed config, CLI flags, or validation
commands are blocking.

## Historical context

This repo was created fresh as `agents-markdown-formatter` to avoid carrying stale `markdown-lint` identity and
markdownlint assumptions into the active runtime payload.

Historical inputs remain reference-only unless explicitly promoted into active code and tested:

- `references/prior-art/**`
- `references/prior-art/markdown-oxc-spike/findings.md`
- https://github.com/CodeSigils/markdown-oxc-spike

Use official Oxfmt docs for current CLI/config/support claims:

- https://oxc.rs/docs/guide/usage/formatter.md
- https://oxc.rs/docs/guide/usage/formatter/cli.md
- https://oxc.rs/docs/guide/usage/formatter/config-file-reference.md
- https://oxc.rs/docs/guide/usage/formatter/embedded-formatting.md
