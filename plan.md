# Refactoring Plan: Hermes Markdown Formatter Skill

## Goal

Refactor `hermes-markdown-lint-skill` into a **Hermes Markdown Formatter Skill**. This is no longer only an Oxc integration under the old lint-skill identity: the shipped skill should be renamed, documented, and validated as a formatter-first skill powered by **Oxc's `oxfmt`** plus structural guardrails.

The new formatter replaces the historical `markdownlint-cli2` + `format-tables.js` formatting pipeline while preserving Hermes-specific patterns: metadata, agent governance, safety checks, consistency checks, and a zero-install runtime payload.

**Scope:** `/home/sand/projects/agents-markdown-formatter/`

**Decision:** The target implementation should move to a clean repository named `agents-markdown-formatter`. The existing `hermes-markdown-lint-skill` repository should remain as reference/history unless an explicit compatibility update is needed for existing users.

**Important:** All agents working on this refactor MUST read the existing `plan.md` in the opencode-markdown-formatter-skill repo (`/home/sand/projects/opencode-markdown-formatter-skill/plan.md`) and consult the public spike repo (<https://github.com/CodeSigils/markdown-oxc-spike>) before making changes. The `markdown-oxc-spike` findings about official Oxfmt behavior, structural guardrails, fence/table drift detection, embedded formatting, and idempotence verification apply equally here.

**Lesson learned:** Renaming this repository in place would carry too much identity and compatibility debt: stale `markdown-lint` paths, inherited markdownlint assumptions, old install examples, and repo-local implementation files that should not be installed to users. A fresh repo lets the runtime allowlist, formatter-first identity, staged install verification, and final agent guard policy review be designed in from the first commit.

---

## v1 Scope: GitHub-Flavored Markdown

This formatter targets **GitHub-Flavored Markdown (GFM)** as the v1 compatibility baseline. Non-GFM dialects are out of scope unless explicitly added later through dialect-specific profiles.

**In scope (v1):**

- GFM tables (alignment, column consistency)
- Fenced code blocks (language info strings, tilde vs backtick)
- Task lists, headings, lists, blockquotes
- Links, autolinks, inline code, strikethrough
- Structural pre/post guards (fence counts, table column drift)

**Out of scope (v1 — explicit):**

- Obsidian wiki links, Mermaid validation
- Frontmatter semantics (YAML frontmatter is preserved but not parsed/validated)
- Pandoc dialects, semantic rewriting
- `embeddedLanguageFormatting: "auto"` — defaults to `"off"` for v1

**MDX note:** MDX is included in v1 scope. Oxfmt formats MDX as Markdown + JSX. This skill does not validate JSX syntax or MDX imports/exports — it applies GFM structural guards only. `embeddedLanguageFormatting: "off"` is required for predictable behavior with MDX code blocks.

**Rationale:** GFM gives a clear, stable contract for GitHub READMEs and documentation. Attempting to support "Markdown generally" becomes a compatibility swamp. The structural guard is specifically GFM-table and GFM-fenced-code focused.

---

## External resources

<https://github.com/CodeSigils/markdown-oxc-spike>
<https://oxc.rs/docs/guide/usage/formatter.md>
<https://oxc.rs/docs/guide/usage/formatter/cli.md>
<https://oxc.rs/docs/guide/usage/formatter/config-file-reference.md>
<https://oxc.rs/docs/guide/usage/formatter/embedded-formatting.md>
<https://oxc.rs/docs/guide/usage/formatter/unsupported-features.md>
<https://deepwiki.com/oxc-project/oxc>
<https://deepwiki.com/oxc-project/oxc/8-code-formatting>
<https://deepwiki.com/oxc-project/oxc/8.1-formatter-architecture>
<https://deepwiki.com/oxc-project/oxc/10.2-oxfmt-cli>
<https://deepwiki.com/oxc-project/oxc/12.2-conformance-testing>
<https://api.github.com/repos/oxc-project/oxc/contents/apps/oxfmt/conformance/fixtures/edge-cases>

**Source-of-truth rule:** use official Oxfmt docs for current CLI/config/support claims. Use DeepWiki for architecture and source-file orientation only when it conflicts with official docs.

## Version Policy

This repo tracks `oxfmt` as a **devDependency only**. The installed skill payload ships zero dependencies — users resolve `oxfmt` themselves via their own tooling. Node.js `>=20` is required (ES2024 features, improved test runner, better error messages).

**Rules:**

- `oxfmt` must be pinned to an exact version in `package.json` devDependencies (no ranges in committed files).
- `scripts/check-consistency.js` warns when `package.json` `oxfmt` version is behind the latest release.
- Breaking Markdown-formatting changes in a minor/major `oxfmt` release require a regression pass: run `npm test` and verify structural guards pass.
- Check [github.com/oxc-project/oxc/releases](https://github.com/oxc-project/oxc/releases) for `oxfmt` changelog before upgrading.
- Breaking changes between versions (marked `BREAKING` in changelog) that affect GFM/MDX formatting output must be evaluated before bumping.

## Current State Analysis

### Historical Hermes Repo Structure

> ⚠️ **Historical — this repo was created fresh as `agents-markdown-formatter`.** The old `hermes-markdown-lint-skill/` structure (lint.js wrappers, markdownlint-cli2 pipeline, format-tables.js) is prior art only. See `references/prior-art/` for preserved artifacts.

### Historical Pipeline

```
format-tables.js (custom Node.js) → markdownlint-cli2 (via npx) → Success/Error
```

### Historical Architecture Features

- **Zero runtime dependencies** — no `package.json` in shipped skill; dev-only `package.json` at repo root only; no `node_modules/` in staged payload
- **Hermes-specific metadata** in SKILL.md frontmatter (`version`, `author`, `metadata.hermes`)
- **Post-write hook** (`post-write.js`) — optional Hermes hook system integration
- **Consistency checker** — validates rules/config/docs stay in sync across 4 files
- **Agent governance** through AGENTS.md with severity levels (BLOCKING/WARNING/INFO)
- **Fence-aware table formatting** — `format-tables.js` respects fenced code block boundaries
- **CJK/emoji width awareness** — `stringWidth()` handles wide characters in table padding
- **No bash scripts** — pure Node.js, cross-platform

### Historical Issues

- `markdownlint-cli2` via `npx` has first-run latency (download time)
- Two separate tools for formatting (tables + lint) means two passes
- Custom table formatter overlaps with what oxfmt/Prettier can format, but table safety validation still needs explicit guards
- `npx` adds a runtime dependency on npm registry availability
- No structural drift detection (no `check-structure.js` equivalent)
- Oxfmt with `proseWrap: "preserve"` is conservative and may not fix markdownlint-style spacing issues such as trailing spaces or missing blank lines around blocks
- Oxfmt can format code inside tagged fences and embedded Markdown-in-JS/MDX contexts, so blast radius must be explicit and guarded

---

## Target Architecture

### Target Repository / Skill Shape

> ✅ Matches implementation as of Phase 7. Stale items from planning are noted inline.

```
agents-markdown-formatter/             # Fresh repo — not hermes-markdown-lint-skill
├── AGENTS.md                          # Formatter governance for agents
├── README.md                          # Markdown Formatter Skill docs
├── plan.md                            # This plan
├── .oxfmtrc.json                      # Oxfmt config
├── .github/workflows/ci.yml            # CI (Phase 6)
├── package.json                        # Dev-only (not shipped)
├── scripts/
│   ├── check-consistency.js            # Anti-drift checker (Phase 5)
│   └── staged-install-verify.sh        # Release allowlist verification (Phase 7)
├── skills/
│   └── markdown-formatter/              # Target skill payload
│       ├── SKILL.md                    # Skill definition
│       ├── src/
│       │   └── index.js                # Canonical formatter CLI
│       └── scripts/
│           ├── check-fences.js         # Fenced code block validator
│           ├── check-structure.js      # Structural drift guard
│           └── check-tables.js         # Table column validator
└── test/
    ├── fixtures/                       # Formatter fixtures
    ├── integration/                    # CLI integration tests
    └── unit/                           # Helper/module unit tests
```

### Formatting Pipeline

```
┌─────────────────────────────┐
│   Structural Guard (pre)    │
│ (new: fence/table snapshot) │
└─────────────────────────────┘
            ▼
┌─────────────────────────────┐
│    oxfmt Formatter          │
│ (canonical formatting pass) │
└─────────────────────────────┘
            ▼
┌─────────────────────────────┐
│  Structural Guard (post)    │
│ (verify no drift introduced)│
└─────────────────────────────┘
            ▼
┌─────────────────────────────┐
│   Final Validations:        │
│   - --guard / --verify      │
│   - --fences (check-fences) │
│   - --validate (table cols) │
│   - --check  (oxfmt check)  │
└─────────────────────────────┘
```

### Key Changes

1. **Rename the skill payload** from `skills/markdown-lint/` to `skills/markdown-formatter/`.
2. **Rename the skill metadata** from `name: markdown-lint` to `name: markdown-formatter`.
3. **Introduce a formatter CLI** at `skills/markdown-formatter/src/index.js`.
4. **Replace** `markdownlint-cli2` via `npx` with `oxfmt` as the primary formatter.
5. **Keep** `check-fences.js` because oxfmt does not validate fence structure.
6. **Keep** `check-consistency.js` because formatter docs/config drift is still a release blocker.
7. **Add** structural guard (`check-structure.js`) adapted from the opencode formatter skill.
8. **Replace** `format-tables.js` with validate-only table-column checking; oxfmt owns table formatting.
9. **Remove** `.markdownlint.json` from the shipped formatter path; use `.oxfmtrc.json` as repository-only formatter config.
10. **Update** `SKILL.md`, `AGENTS.md`, `README.md`, CI, and tests to describe a formatter skill.

---

### Best Path: Start in `agents-markdown-formatter`

Implement in a new repository at `/home/sand/projects/agents-markdown-formatter` instead of continuing the migration in place.

1. Commit any reference updates in this repo first so the decision is recoverable.
2. Create a clean git repository named `agents-markdown-formatter`.
3. Copy only useful planning and prior-art inputs:
   - this `plan.md`
   - fixture ideas from `markdown-oxc-spike`
   - structural guard prior art from `opencode-markdown-formatter-skill`
   - representative current fixtures from this repo
4. Do not copy generated agent state, `node_modules`, lockfiles, old `markdown-lint` runtime code, or current markdownlint config as active implementation.
5. Start the new repo with the final product shape: `skills/markdown-formatter/`, runtime allowlist, staged install verification, and structural guard tests.
6. Keep this repo as historical/reference material. Add only compatibility or redirect notes here if existing users need them later.

## Implementation Plan

### Execution Sequencing Rules

- Commit this plan before implementation begins so the migration target is reviewable and recoverable.
- Implement in `/home/sand/projects/agents-markdown-formatter`; treat this repository as historical/reference material after the clean repo is created.
- Treat Phase 1 and the Phase 7 release allowlist as coupled. The first implementation slice must create the new skill boundary and prove what would be installed before deeper behavior changes.
- Do not start by deleting the old `markdown-lint` payload in this repo. In the new repo, avoid introducing it as active runtime code at all; copy old files only as explicit prior-art references when useful.
- Build the structural guard before full Oxfmt integration so formatter output is evaluated against safety invariants from the start.
- Keep cached binary download out of the first implementation pass. The first shippable pass resolves `oxfmt` from local development installs or PATH and fails with actionable setup instructions.
- Use a dev-only root `package.json` for reproducible repository tests and a pinned `oxfmt` devDependency, but never require npm dependencies in the installed Hermes skill payload.
- Do not use `npx` in the product wrapper, validation path, shipped docs, or agent instructions. `npx` may appear only as historical prior art or an explicit one-off setup/debug note.
- Make one concern per commit: boundary/packaging, guard, formatter integration, docs/consistency, final policy review.

### Phase 1: Rename, Migration Boundary, and Install Payload Boundary

- [x] Create/rename target payload path: `skills/markdown-formatter/`.
- [x] Move `SKILL.md`, scripts, and references into the formatter payload.
- [x] Update frontmatter to `name: markdown-formatter` and formatter-first description.
- [x] ~~Keep a root `lint.js` compatibility wrapper~~ — intentionally skipped: fresh repo, no backward compat needed.
- [x] Add or document the new canonical command: `node skills/markdown-formatter/src/index.js <path>` or `mdformat <path>`.
- [x] Add a first-pass install allowlist or staging script/check before moving behavior, so implementation can verify the installed payload independently from the repository checkout.
- [x] Add a dev/runtime dependency boundary note before adding tooling: root `package.json` is repository-only; `skills/markdown-formatter/` must run from the staged payload without `package.json`, lockfiles, `node_modules/`, or `npm install`.
- [x] Decide whether the old `skills/markdown-lint/` path remains as a thin compatibility shim or is removed in one breaking change; do not remove it until the new path and compatibility decision are tested.

### Phase 2: Spike / Evaluation

- [x] Treat the spike repo (<https://github.com/CodeSigils/markdown-oxc-spike>) as prior art; do not repeat fixture work unless this repo needs Hermes-specific coverage.
- [x] Consult **both** the remote spike repo and local `references/prior-art/markdown-oxc-spike/findings.md` for Oxfmt behavior, fixtures, and guard requirements.
- [x] Verify current official Oxfmt docs still list Markdown and MDX support before changing formatter behavior.
- [x] Test oxfmt on `test/fixtures/current/kitchensink.md` and `test/fixtures/current/hermes-intro.md` — compare output against structural invariants, not old markdownlint formatting expectations.
- [x] Document that `.oxfmtrc.json` does not cover markdownlint policy rules; v1 is a formatter/structural-guard skill, not a markdownlint replacement.
- [x] Check oxfmt idempotence: run twice, verify convergence.
- [x] Decide whether `embeddedLanguageFormatting` should be `"auto"` or `"off"` for the first safe Hermes release. Decision: `"off"` — out of scope for v1 per GFM contract above.
- [x] Decide: do not keep `format-tables.js`; use `check-tables.js` for validate-only table-column checking.
- [x] **Test framework**: use Node's built-in test runner (`node --test`) for all unit and integration tests. Do not introduce vitest, jest, or other test frameworks.

### Phase 3: Structural Guard Safety Net

- [x] Port `check-structure.js` from the opencode-markdown-formatter skill, but validate behavior against the spike repo before copying assumptions.
- [x] Integrate pre/post guard into the formatter pipeline before Oxfmt is allowed to rewrite files:
  - Pre-snapshot: record fence counts, fence delimiter styles, fence info strings, table column counts, and optionally fenced-code content hashes
  - Post-verify: compare after formatting, report drift, and fail on policy violations
- [x] Add explicit fixtures from the spike/Oxc edge cases: nested fences in lists, tilde-to-backtick normalization, tagged fence content formatting, escaped table pipes, and Markdown-in-JS with escaped backticks/multibyte text.
- [x] Add `--guard` flag to the CLI and test it against fixtures before full formatter integration.
  - **Target path**: port `check-structure.js` to `skills/markdown-formatter/scripts/check-structure.js`
  - **Test framework**: use Node's built-in test runner (`node --test`)
  - Port to `skills/markdown-formatter/scripts/check-structure.js`

### Phase 4: oxfmt Integration

- [x] Add `.oxfmtrc.json` with Hermes-appropriate defaults (tabWidth=2, printWidth=100, endOfLine=lf, proseWrap=preserve, embeddedLanguageFormatting=off)
- [x] Add `skills/markdown-formatter/src/index.js` to call oxfmt instead of `format-tables.js` + `npx markdownlint-cli2`
- [x] ~~Add root `package.json` as development-only tooling with pinned `oxfmt` and scripts for tests/checks; keep it outside the release allowlist.~~ Created at repo root: scripts test/format/format:check/verify/guard; oxfmt as devDependency.
- [x] Implement staged oxfmt binary resolution: local node_modules/.bin/oxfmt → PATH → fail with install instructions
- [x] Ensure the wrapper never shells out to `npx` and never falls back to `markdownlint`, Prettier, mdformat, or any external Markdown linter/formatter
- [x] Keep `validate` and `fences` subcommands working
- [x] Ensure formatter flags work: `--check`, `--fix` default, `--all`, `--guard`, `--verify`, `--fences`, `--validate`, `--dry-run`
- [x] Run oxfmt twice or otherwise verify idempotence before reporting success

### Phase 5: Anti-Drift & Consistency (Critical)

- [x] Create `scripts/check-consistency.js` (repository-only, not shipped) to validate oxfmt config and docs:
  - `.oxfmtrc.json` matches documented rules in `AGENTS.md`
  - README badge version matches SKILL.md frontmatter version
  - No stale shipped references to markdownlint-cli2, `npx markdownlint`, `markdown-lint` identity, or old primary formatter paths
  - Plan drift: expected files exist, stale artifacts do not
  - Oxfmt version in `package.json` devDependencies is within 1 minor of latest
- [x] Add stale-text detection for old pipeline artifacts (`markdownlint-cli2`, `npx markdownlint`, `format-tables.js` as formatter, `markdown-lint` as skill identity)
- [x] Remove `.markdownlint.json` or clearly mark as deprecated

### Phase 6: Documentation & Metadata Updates

- [x] Update `SKILL.md`:
  - Frontmatter: update `name` to `markdown-formatter`; keep `version`, `author`, `license`, `metadata.hermes`
  - Replace `lint.js` commands with `src/index.js`, `mdformat`, or a documented compatibility wrapper
  - Update required commands section
  - Update references section
- [x] Update `AGENTS.md`:
  - Replace rule table with oxfmt-relevant formatting rules
  - Update agent contract to reference oxfmt
  - Update severity levels for oxfmt-related failures
- [x] Update `README.md`:
  - Change "What It Does" section to oxfmt
  - Update CLI reference
  - Update CI/pre-commit commands
  - Add changelog entry for oxfmt version
  - Remove stale content (markdownlint references, npx commands)
- [x] ~~Update `references/rules.md`~~ — intentionally skipped: oxfmt official docs serve this purpose; no separate rules.md needed for GFM-first formatter.
- [x] Create CI workflow at `.github/workflows/ci.yml` (if not exists) or update existing:
  - Use `node skills/markdown-formatter/src/index.js` as the canonical formatter command
  - Keep consistency check, fence validation, table validation
  - Add structural guard step
  - CI file is validated by `scripts/check-consistency.js`: checks for markdownlint usage, violations/ inclusion, npx oxfmt, required pinned npm install/version check/npm test steps

### Phase 7: Shipping Strategy

- [x] Define a release allowlist for the installed skill payload. Ship only runtime files under `skills/markdown-formatter/` that are needed by Hermes at use time: `SKILL.md`, formatter CLI source, and guard scripts.
- [x] Keep repository-only planning, tests, fixtures, and development utilities out of the installed user payload: `plan.md`, `AGENTS.md`, `README.md`, `test/`, CI files, dev-only `scripts/`, `package.json`, lockfiles, `node_modules/`, coverage, and generated local state.
- [x] Add a packaging/install verification task that builds or stages the exact install artifact into a temp directory and lists the files that would be shipped before release.
- [x] Document the zero-dependency runtime contract: pure Node.js wrappers plus an externally resolved `oxfmt` binary; no bundled test dependencies, planning files, npm dev dependencies, lockfiles, `package.json`, or generated agent state in the installed skill.
- [x] Document the developer-only dependency boundary separately so maintainers may use local test tooling without accidentally promoting those dependencies into the skill payload.
- [x] Update `.gitignore` only for generated local state; do not use ignore rules as a substitute for an explicit release allowlist.
- [x] ~~Create migration guide for existing users.~~ Intentionally skipped for v1: this fresh repo has no compatibility wrapper or legacy install path; historical migration context remains in `references/prior-art/`.

### Test Folder Structure

Define the test directory structure before implementing Phase 8 tests:

```
test/
├── fixtures/
│   ├── current/           # Real-world docs that should format cleanly
│   │   ├── kitchensink.md
│   │   ├── hermes-intro.md
│   │   └── sample.mdx     # MDX fixture (v1 scope)
│   ├── oxfmt-spike/      # Oxfmt edge cases (copied from spike)
│   │   ├── fence-blank.md
│   │   ├── fence-nested.md
│   │   ├── fence-language-tags.md
│   │   ├── table-escaped-pipes.md
│   │   ├── table-semantic-alignment.md
│   │   ├── html-comment-after-list.md
│   │   ├── markdown-in-js-template.md
│   │   ├── safe-formatting-basics.md
│   │   └── task-lists.md
│   └── violations/        # Structural violation fixtures (guard should catch)
│       ├── fence-mismatch.md       # Unclosed/mismatched-length fences
│       ├── table-column-drift.md   # Header/delimiter/row column mismatch
│       ├── fence-untitled.md       # Empty language tag on opener
│       └── fence-mismatch.md.structure.json  # Snapshot for --check mode
├── unit/                  # Unit tests for isolated components
│   ├── check-structure.test.js     # Structural guard logic
│   ├── check-fences.test.js        # Fence validation logic
│   ├── check-tables.test.js        # Table validation logic
│   └── formatter.test.js           # Formatter wrapper logic
├── integration/           # CLI integration tests
│   └── cli.test.js                 # CLI flags, recursive paths, validation, read-only verify
└── staged-artifact/       # Generated staged install output (ignored)
```

Repository-level staged verification lives at `scripts/staged-install-verify.sh`; `test/staged-artifact/` is generated output and must remain untracked.

Note: `check-all.js` lives at `skills/markdown-formatter/scripts/check-all.js` (not `test/`). Idempotence tests run against `fixtures/oxfmt-spike/` via `check-all.js` — no separate `fixtures/idempotence/` directory needed.

| Directory              | Purpose                                                              |
| :--------------------- | :------------------------------------------------------------------- |
| `fixtures/current`     | Real-world docs, should format without errors                        |
| `fixtures/oxfmt-spike` | Edge cases: idempotence, fence behavior, table alignment             |
| `fixtures/violations`  | Malformed inputs the guard must detect (not fix)                     |
| `unit/`                | Pure function tests: structural guard, fences, formatter             |
| `integration/`         | End-to-end: CLI flags, guard pipeline, pre/post snapshot             |
| `staged-artifact/`     | Ignored generated output from staged install verification            |
| `check-all.js`         | Run structural checks against valid fixtures and expected violations |

### Phase 8: Testing

- [x] ~~Create violation fixtures in `test/fixtures/violations/`~~ Committed in a99fe1e: fence-mismatch.md, table-column-drift.md, fence-untitled.md + structure snapshots
- [x] Create unit tests in `test/unit/`
  - [x] `check-structure.test.js` — structural guard logic
  - [x] `check-fences.test.js` — fence validation logic
  - [x] `check-tables.test.js` — table validation logic
  - [x] `formatter.test.js` — formatter wrapper logic
- [x] Create integration tests in `test/integration/`
  - [x] `cli.test.js` — CLI flags, recursive path handling, validation, and read-only verify behavior
- [x] ~~Create `test/staged-artifact/verify-install.sh`~~ Replaced by repository-level `scripts/staged-install-verify.sh`; `test/staged-artifact/` is generated ignored output
- [x] ~~Create `check-all.js`~~ Created at `skills/markdown-formatter/scripts/check-all.js`: validates clean fixtures and verifies violation fixtures fail at least one guard.
- [x] Run unit tests: `node --test test/unit/*.test.js` (Node built-in runner)
- [x] Run integration tests: `node --test test/integration/*.test.js` (Node built-in runner)
- [x] Run staged artifact verification
- [x] Run `node scripts/check-consistency.js` (dev-only) — must pass
- [x] Run master structural test runner: `npm test` → `node skills/markdown-formatter/scripts/check-all.js`

### Phase 9: Final Agent Guard Policy Review

- [x] Review every agent-facing policy surface after implementation is complete: repository `AGENTS.md`, shipped `SKILL.md`, README agent sections, and CI docs.
- [x] Confirm guard policies describe the final formatter behavior, not transitional implementation details.
- [x] Remove or explicitly label compatibility-only references to `markdown-lint`, `markdownlint-cli2`, `npx`, `.markdownlint.json`, `format-tables.js` as formatter, and old command paths.
- [x] Confirm agent instructions do not tell agents to run dev-only checks from the installed user payload.
- [x] Confirm shipped agent instructions mention only files and commands that actually exist in the installed allowlist.
- [x] Run stale-text searches and `node scripts/check-consistency.js` after the final policy review.

---

## Shipping Strategy

### Hermes vs OpenCode — Key Difference

The hermes skill targets **Hermes Agent** users, not OpenCode. The shipping constraints are different:

| Concern        | Hermes Formatter Skill                                                  | OpenCode Formatter Reference                     |
| :------------- | :---------------------------------------------------------------------- | :----------------------------------------------- |
| Install method | `hermes skills install`                                                 | `git clone`                                      |
| Hook system    | `~/.hermes/config.yaml post_tool_call`                                  | N/A                                              |
| Metadata       | `name: markdown-formatter`, `version`, `author`, `metadata.hermes.tags` | `name`, `description`, `compatibility: opencode` |
| Dependencies   | Zero npm deps in shipped payload                                        | Optional package/bin workflow                    |
| Entry point    | `src/index.js`                                                          | `src/index.js` or `mdformat` bin                 |

### Shipped Files

Ship from an explicit runtime allowlist, not from the whole repository. The installed user payload should contain only files that Hermes needs to load or execute the skill:

```
~/.hermes/skills/markdown-formatter/
├── SKILL.md                        # Skill definition (Hermes-compatible frontmatter)
├── src/
│   └── index.js                    # Canonical formatter CLI
├── scripts/
│   ├── check-fences.js             # Fenced code block validator
│   ├── check-structure.js          # Structural snapshot and drift guard
│   └── check-tables.js             # Table column validator
```

Before release, stage that allowlist into a temporary directory and review the file list. The release should fail if the staged install artifact contains planning docs, tests, fixtures, dev dependencies, generated local state, or repository-only governance files.

### Dev-Only Files (not shipped)

- `plan.md` — implementation planning only
- `AGENTS.md` — repository governance only; user-facing agent guard policy belongs in shipped `SKILL.md`
- `README.md` — repository docs; if the installer can ship docs separately, keep them outside the runtime skill payload
- `test/` and fixtures — development validation only
- `.github/`, CI configs, coverage, and temporary reports — repository automation only
- `scripts/check-consistency.js` (root `scripts/`, dev-only) — release/development consistency check, not runtime formatter behavior
- `package.json`, lockfiles, and `node_modules/` — allowed only for local development if introduced; never required by the installed skill
- `.omo/`, `.open-mem/`, session logs, caches, and other generated agent/tool state — never shipped

### Install Artifact Verification

The release check stages the exact install payload and verifies it before publishing:

1. Create an empty temp directory such as `/tmp/markdown-formatter-skill-install/`.
2. Copy only the allowlisted runtime files into `markdown-formatter/`.
3. Print the staged file list with sizes so reviewers can see exactly what users receive.
4. Fail if any dev-only path appears: `plan.md`, `AGENTS.md`, `README.md`, `test/`, `.github/`, `node_modules/`, package lockfiles, generated local state, or coverage artifacts.
5. Run the formatter CLI from the staged directory, not the repository checkout.
6. Run `--fences`, `--validate`, `--guard`, and `--check` against representative fixtures copied outside the staged skill payload.
7. Verify the staged skill still works with no repository root, no test directory, and no npm install.

### Dependency and Binary Strategy

Use a staged zero-npm-dependency runtime approach with repository-only development tooling. Do not make auto-download part of the first implementation milestone.

Decision:

- Add a root `package.json` for development and CI only.
- Pin `oxfmt` as a devDependency so repository tests are reproducible.
- Exclude `package.json`, lockfiles, `node_modules/`, tests, fixtures, plans, and repository governance from the staged Hermes skill payload.
- Ship a pure Node.js wrapper and guard scripts that resolve an existing `oxfmt` binary.
- Do not use `npx` in the wrapper, validation path, shipped docs, or agent instructions.
- Do not substitute unrelated Markdown linters or formatters when Oxfmt is unavailable.

Why this is the best path:

- Reproducible development needs a pinned tool version.
- Hermes runtime needs a small, dependency-free skill payload.
- `npx` reintroduces network/runtime drift and repeats the old `markdownlint-cli2` failure mode.
- Binary auto-download is useful later, but it adds platform, checksum, extraction, proxy, and update-policy risk before the guard behavior is proven.

Phase A resolution:

1. Check local `node_modules/.bin/oxfmt` for development/testing checkouts.
2. Check system PATH for `oxfmt`.
3. Fail with actionable instructions that name the supported install options.

Phase B, only after CLI/guard/tests pass:

1. Add cached binary resolution under `~/.cache/hermes-markdown-formatter/`.
2. Download via HTTPS with redirects, platform mapping, temp-file extraction, and no shell interpolation.
3. Add checksum/signature verification if Oxfmt publishes suitable artifacts.

**No npm package dependencies in the shipped skill payload.** A development `package.json` should exist at the repository root for tests and pinned Oxfmt, but it must be clearly marked dev-only and excluded from staged install artifacts.

### Minimum Dependencies Policy

- **Zero npm runtime dependencies** — the shipped skill must remain pure Node.js
- Root `package.json` is allowed for development/CI only and should pin `oxfmt`
- `oxfmt` binary is resolved locally or from PATH first; dynamic fetch is a later hardening phase, not the first implementation
- No `npx` calls in product wrapper, validation path, shipped docs, or agent instructions
- No fallback to `markdownlint`, Prettier, mdformat, editor auto-formatters, or external Markdown wrappers
- Keep pure Node.js scripts for supporting validations (fences, structure)

---

## Anti-Drift Safeguards

### What Must Stay Synchronized

| File Pair              | What to Check                       |
| :--------------------- | :---------------------------------- |
| README.md ↔ SKILL.md   | Version badge matches frontmatter   |
| .oxfmtrc.json ↔ README | Config matches documented behavior  |
| CI workflow ↔ README   | Commands match documentation        |
| CLI flags ↔ README     | All flags documented, none stale    |
| plan.md ↔ repo reality | Implemented files match plan target |

### Check-Consistency.js Updates

The existing `check-consistency.js` must be enhanced to:

1. Validate `.oxfmtrc.json` instead of `.markdownlint.json`
2. Check for stale shipped references to `markdownlint-cli2`, `npx markdownlint-cli2`, `format-tables.js` as formatter, and `markdown-lint` as primary skill identity
3. Validate oxfmt config keys match documented behavior
4. Check that structural guard is referenced where appropriate

### Stale Content Guards

After EVERY implementation phase, run:

1. Search for `markdownlint-cli2` in shipped files — flag as stale unless explicitly labeled historical/prior-art
2. Search for `npx markdownlint` in shipped files — flag as stale unless explicitly labeled historical/prior-art
3. Search for `format-tables` in shipped files — verify it is not the primary formatter
4. Search for `markdown-lint` in shipped metadata/docs — verify it is compatibility-only or historical
5. `node scripts/check-consistency.js` — must exit 0
6. Verify README version badge matches SKILL.md version
7. Verify all CLI flags are documented

---

## Risk Mitigation

| Risk                                                  | Mitigation                                                                                                                          |
| :---------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| oxfmt produces different output than current pipeline | Use `check-tables.js` validate-only checks plus regression fixtures; oxfmt owns formatting and no `format-tables.js` fallback ships |
| oxfmt has gaps vs markdownlint rules                  | GFM scope excludes markdownlint policy rules — gaps are expected and out of scope; document GFM-specific gaps only                  |
| Structural drift from oxfmt                           | Pre/post structural guard catches fence/table drift per GFM contract                                                                |
| Embedded formatting changes code fences unexpectedly  | v1 scope sets `embeddedLanguageFormatting: "off"` — embedded JS/TS formatting explicitly out of scope                               |
| Oxfmt breaks MDX JSX/import semantics                 | MDX support is GFM structural only — Oxfmt does not validate JSX; this is a known gap and acceptable for a formatter v1             |
| Dev dependencies leak into shipped skill              | Root `package.json` is dev-only; staged install allowlist fails if package files, lockfiles, or `node_modules/` are shipped         |
| `npx` reintroduces runtime drift                      | Product wrapper never calls `npx`; it resolves local dev binary, then PATH, then fails with setup instructions                      |
| Hermes hook system incompatibility                    | No hook wrapper ships in v1; users can call `src/index.js` from their own Hermes hooks if desired                                   |
| Users with existing `markdown-lint` installs          | v1 fresh repo ships no compatibility wrapper; historical context remains in `references/prior-art/`                                 |
| Users with existing `.markdownlint.json` configs      | Formatter ignores it; docs explain `.oxfmtrc.json` replacement                                                                      |
| Missing oxfmt binary                                  | Fail with actionable install/setup instructions in Phase A; add cached download only after wrapper behavior is proven               |

---

## Success Criteria

1. [x] Formatter CLI tests pass (`node --test test/unit/*.test.js test/integration/*.test.js`)
2. [x] Table validation tests pass (`test/unit/check-tables.test.js` and fixture validation)
3. [x] `node skills/markdown-formatter/src/index.js --check test/fixtures/current/kitchensink.md` — exits 0
4. [x] `node skills/markdown-formatter/src/index.js --check test/fixtures/current/hermes-intro.md` — exits 0
5. [x] `node skills/markdown-formatter/src/index.js --fences --all test/fixtures/current test/fixtures/oxfmt-spike` — exits 0
6. [x] `node skills/markdown-formatter/src/index.js --validate --all test/fixtures/current test/fixtures/oxfmt-spike` — exits 0
7. [x] `node scripts/check-consistency.js` — exits 0
8. [x] oxfmt idempotent: running formatter twice on the same file produces the same output
9. [x] Staged install artifact contains only allowlisted runtime files and excludes planning, tests, dev dependencies, generated local state, and repository-only governance files
10. [x] Staged install artifact works without the repository root, test directory, `node_modules/`, or npm install
11. [x] Shipped skill works without root `package.json`, lockfiles, or any package manager install
12. [x] No stale references to `markdownlint-cli2` or `npx markdownlint` in any shipped file
13. [x] No active `npx oxfmt` product path in shipped docs or agent instructions
14. [x] No stale `markdown-lint` identity remains except explicit migration/compatibility text
15. [x] Final agent guard policy review completed across AGENTS.md, SKILL.md, README agent sections, and CI docs
16. [x] Version badge in README matches SKILL.md version
17. [x] All CLI flags documented in README and SKILL.md
18. [x] Structural guard detects fence style changes (tilde→backtick) in test fixture/snapshot comparison
19. [x] Structural guard detects table column count changes in test fixture
20. [x] Structural guard preserves tagged fenced-code content according to the documented `embeddedLanguageFormatting: "off"` policy
21. [x] Plan cites <https://github.com/CodeSigils/markdown-oxc-spike> as the current Markdown/Oxfmt evidence base; README and AGENTS.md point to the repository plan and prior-art references.

---

## TODOs

All implementation phases are complete for the current v1 scope.

- [x] **Phase 1**: Rename skill identity, define migration boundary, and record the dev-only `package.json` versus zero-dependency runtime decision
- [x] **Phase 2**: Reuse spike findings and evaluate Hermes-specific oxfmt coverage against current pipeline
- [x] **Phase 3**: Port and test structural guard before full formatter rewrites
- [x] **Phase 4**: Add dev-only root `package.json`, pin `oxfmt`, and integrate oxfmt into formatter CLI with local/PATH binary resolution only
- [x] **Phase 5**: Update consistency checker for formatter identity and oxfmt
- [x] **Phase 6**: Update all docs (SKILL.md, AGENTS.md, README.md); no separate `rules.md` is shipped for v1
- [x] **Phase 7**: Define release allowlist, zero-runtime-dependency shipping strategy, dev-tool exclusion checks, and install artifact verification
- [x] **Phase 8**: Run all tests and verify staged install artifact behavior
- [x] **Phase 9**: Review final agent guard policies for stale instructions before release

---

## Final Verification Wave

Current release verification commands:

- [x] **F1 — Consistency Check**: `node scripts/check-consistency.js` exits 0
- [x] **F2 — All Tests Pass**: `node --test test/unit/*.test.js test/integration/*.test.js` exits 0
- [x] **F3 — Pipeline Check**: `npm test` exits 0 and validates clean fixtures plus expected violation fixtures
- [x] **F4 — Install Artifact Audit**: `bash scripts/staged-install-verify.sh` confirms the staged payload contains only allowlisted runtime files and excludes planning, tests, dev dependencies, generated local state, and repository-only governance files
- [x] **F5 — Representative Formatter Checks**:
  - [x] `node skills/markdown-formatter/src/index.js --check test/fixtures/current/kitchensink.md`
  - [x] `node skills/markdown-formatter/src/index.js --check test/fixtures/current/hermes-intro.md`
  - [x] `node skills/markdown-formatter/src/index.js --fences --all test/fixtures/current test/fixtures/oxfmt-spike`
  - [x] `node skills/markdown-formatter/src/index.js --validate --all test/fixtures/current test/fixtures/oxfmt-spike`
- [x] **F6 — Anti-Drift Audit**: No stale references to markdownlint-cli2, npx, format-tables (as primary formatter), or markdown-lint (as primary identity) in shipped files
- [x] **F7 — Agent Guard Policy Review**: AGENTS.md, SKILL.md, README agent sections, and CI docs match final behavior and contain no stale transitional instructions
- [x] **F8 — Evidence Link Check**: plan.md and prior-art references point formatter maintainers to <https://github.com/CodeSigils/markdown-oxc-spike>
