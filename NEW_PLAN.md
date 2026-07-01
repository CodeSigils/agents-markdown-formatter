# Plan: Remove Oxfmt, Replace with Zero-Dependency Micro-Formatter

> **Status:** Draft — pre-migration audit.
> **Evidence base:** [markdown-oxc-spike](../markdown-oxc-spike/) — 9 fixture types across 3 Oxfmt versions, cross-config testing, structural guard analysis
> **Spike conclusion:** Oxfmt is the wrong shape for lightweight agent workflows. The ~150 lines of Oxfmt glue in this repo can be replaced by ~60 lines of pure-JS passes — each independently testable, deterministic by construction, and zero-dependency.

---

## Why now

The spike proved three things concretely:

1. Three formatting operations Oxfmt provides (table alignment, fence normalization, indentation normalization) are each implementable in ~10-40 LOC of deterministic transforms
2. Every Oxfmt call site in this repo requires a two-pass idempotence check because Prettier's output can drift across runs. With deterministic transforms the two-pass check becomes a **regression assertion** (must remain stable) rather than a drift guard — but it stays in tests, CI, and `--verify`
3. The 8.3MB platform binary only resolves 4 relevant Prettier config options; the rest (proseWrap, embeddedLanguageFormatting) are disabled or irrelevant for the lightweight profile

Removing Oxfmt eliminates:
- 12 call sites with subprocess spawning
- ~150 LOC of binary resolution, version checking, and fallback logic
- The 8.3MB binary dependency from `npm ci`
- `.oxfmtrc.json` config file and oxfmt-specific validation code
- Version bump script (`scripts/bump-oxfmt.sh`) and drift risk across minor versions

---

## What this plan does NOT include

These are separate concerns that are NOT part of this migration:

| Excluded | Rationale |
| :------- | :------- |
| Delete `AGENTS.md` | Governance/adapter cleanup — separate plan |
| Delete `CHANGELOG.md` | Release-policy decision — separate plan |
| Rewrite `release.sh` around git-log release bodies | Tied to CHANGELOG decision — not part of this swap |
| Rename fixture directories | Cosmetic, not required for oxfmt removal |
| Merge CI jobs | Process optimization, not required for oxfmt removal |
| Prose reflow / paragraph wrapping | The micro-formatter doesn't touch prose — same as `proseWrap: preserve` |
| Code-content formatting inside fences | The `embeddedLanguageFormatting: auto` trap from the spike — don't touch it |
| Structural validation | Guard scripts are separate tools with separate concerns — do not merge |
| Repo rename | Name describes what it does (format Markdown for agents), not how. No rename needed |

---

## What stays unchanged

| Component | Reason |
| :-------- | :----- |
| 4 guard scripts (`check-fences.js`, `check-tables.js`, `check-pipes.js`, `check-structure.js`) | Required regardless of formatter — these catch structural problems no formatter should silently fix; their oxfmt references are in comments/error messages only (cosmetic, batched separately) |
| 3 preflight repair functions (`repairAdjacentPipes`, `repairTableColumns`, `normalizeTableSpacing`) | Required for table safety before any formatting pass |
| Empty-cell table skip path | Tables with empty cells (detected by `hasTableWithEmptyCells`) skip the table-alignment pass entirely — only trailing-whitespace and final-newline normalization apply. The new `format-content.mjs` already implements this correctly |
| Full CLI surface (all 12 flags) | No CLI flags removed — only `--doctor` changes what it checks |
| 37 test fixtures (9 oxfmt-spike, 3 current, 1 pipe-safety, 8 violations, 16 unit/integration) | All pass unchanged; `formatContent()` must pass existing structural guards and idempotence regression tests |
| All CLI output formats and exit codes | Same interface, different engine |
| `.githooks/pre-commit` | Runs `npm run format:check` and `npm test` — both work with new engine |
| Two-pass idempotence in tests, CI, and `--verify` | Kept as a **regression assertion** — deterministic transforms should produce identical output on every pass. If idempotence ever breaks, the engine has a bug. Not removed |
| Repo name, LICENSE, `.node-version`, `.gitignore`, `scripts/format-files.js` | Unchanged |

---

## What gets built: `formatContent(content, options)`

A single pure function in `skills/markdown-formatter/src/format-content.mjs`. Five independent passes composed in order:

### Pass 0a: Trailing whitespace removal (~3 LOC)

`normalizeTrailingWhitespace`: strip spaces and tabs at end of every line.

### Pass 0b: Final newline (~2 LOC)

`ensureFinalNewline`: append `\n` if content doesn't end with one.

### Pass 1: Indentation normalization (~15 LOC)

- Detect indent style from first indented line outside fences (tab vs spaces)
- Normalize all leading whitespace to consistent policy (default: 2-space)
- Operate per-line, skip content inside fenced code blocks (track fence state)

Edge cases from fixtures:
- `test/fixtures/oxfmt-spike/safe-formatting-basics.md` — mixed indentation must normalize
- `test/fixtures/oxfmt-spike/task-lists.md` — nested list indentation must preserve structure
- `test/fixtures/oxfmt-spike/markdown-in-js-template.md` — content inside fences untouched

### Pass 2: Table column alignment (~35 LOC)

- Find contiguous table blocks: header line, delimiter line (must match `:?-{3,}:?` pattern), data rows
- Per column: find max content width across all rows in the block
- Preserve leading/trailing pipes (add if missing, consistent style)
- Preserve delimiter markers: `:---`, `---:`, `:---:` left-aligned by default
- Pad each cell to max width with single spaces on both sides
- **Skip tables with empty cells** (delegates to `hasTableWithEmptyCells` — only trailing-whitespace and final-newline passes apply)

Edge cases from fixtures:
- `test/fixtures/oxfmt-spike/table-escaped-pipes.md` — escaped pipes are not column boundaries
- `test/fixtures/oxfmt-spike/table-semantic-alignment.md` — alignment markers must survive
- `test/fixtures/pipe-safety/table-empty-cells.md` — empty-cell tables are skipped (table alignment does not touch them)
- `test/fixtures/current/table-gfm-spec.md` — 10 GFM table forms must all align correctly
- `test/fixtures/violations/delimiter-adjacent-pipes.md` — preflight repairs adjacent pipes first
- Short data rows — pad with empty trailing cells to match header width

### Pass 3: Fence normalization (~15 LOC)

- Scan for tilde-delimited fences `~~~...~~~` (3+ tildes)
- Replace opener and closer with backtick fence of same run-length
- Escalate backtick count by 1 if content already contains the current run-length of backticks
- Leave already-backtick fences unchanged (idempotent)

Edge cases from fixtures:
- `test/fixtures/oxfmt-spike/fence-nested.md` — outer 4-backtick fence containing inner 3-backtick fence
- `test/fixtures/oxfmt-spike/fence-blank.md` — adjacent opener/closer handling
- `test/fixtures/oxfmt-spike/fence-language-tags.md` — info strings after opener preserved verbatim

### Total: ~65 LOC

Each pass is a pure function: `(content) => newContent`. No subprocesses, no async, no filesystem access.

---

## Comprehensive file-change catalog

Every file that touches oxfmt, organized by change type.

### DELETE (4 oxfmt-related files)

| File | Size | Why |
| :--- | --- | :--- |
| `.oxfmtrc.json` | ~15 LOC | Root oxfmt config |
| `skills/markdown-formatter/.oxfmtrc.json` | ~15 LOC | Shipped skill payload config |
| `staged-install/skills/markdown-formatter/.oxfmtrc.json` | ~15 LOC | Staged copy of above (regenerated in Phase 3) |
| `scripts/bump-oxfmt.sh` | (already absent) | Gone — no action needed |

(The `staged-install/` directory is regenerated from scratch by `scripts/staged-install-verify.sh` — it `rm -rf`s then copies from the runtime allowlist. After Phase 3 updates the allowlist, the stale directory and all its oxfmt references disappear automatically.)

### NEW (1 file)

| File | LOC | Description |
| :--- | --- | :--- |
| `skills/markdown-formatter/src/format-content.mjs` | ~65 | Pure-function micro-formatter: 5 passes (trailing whitespace, final newline, indent normalize, table align, fence normalize) |

### MODIFY — `skills/markdown-formatter/src/index.js` (815 LOC → ~530 LOC)

This is the biggest change. The file is the CLI entrypoint.

**Removed exports (6 functions + 2 constants):**
- `OXFMT_MAX_VERSION` constant (unused post-swap)
- `getOxfmtExecutableNames()` function (5 LOC)
- `getOxfmtPathCandidates()` function (15 LOC) — tested by `test/unit/formatter.test.js`
- `resolveOxfmtBin()` function (10 LOC) — called by `runOxfmt()` and `runDoctor()`
- `getOxfmtBin()` function (8 LOC) — called by `runOxfmt()`
- `isSupportedOxfmtVersion()` function (9 LOC) — tested by `test/unit/formatter.test.js`
- `runOxfmt()` function (7 LOC) — called 12 times across 8 `processFile()` branches
- `checkIdempotenceReadOnly()` function (17 LOC) — **kept** and repurposed for formatContent idempotence regression

**Removed constants:**
- `OXFMT_CONFIG` — no longer needed (`.oxfmtrc.json` gone)
- `OXFMT_MAX_VERSION` — no oxfmt version checking

**Modified functions:**

| Function | Change |
| :------- | :----- |
| `printHelp()` | Remove "Prerequisites: oxfmt on PATH" line from output |
| `runDoctor()` | Remove oxfmt binary resolution/version check; add `format-content.mjs` require check; remove OXFMT_CONFIG from requiredFiles; change wording from "oxfmt" to "Formatter" |
| `processFile()` | Replace 12 `runOxfmt()` call sites with `formatContent()`. Each branch still runs `checkIdempotenceReadOnly` against the formatted output as a regression assertion |
| `main()` | No change — same arg parsing and dispatch |

**The 12 runOxfmt() call sites in processFile() — each needs specific replacement:**

| Branch | Line (approx) | Old | New |
| :----- | --- | :--- | :--- |
| unclosed + fences | 687 | `runOxfmt(["--check", file])` | Skip (fence-only, no formatting) |
| unclosed + guard+check | 689 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| unclosed + guard+fix | 691 | `runOxfmt(["--write", file])` + checkIdempotence | `formatContent → write → checkIdempotence` |
| unclosed + check | 693 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| unclosed + default | 694 | `runOxfmt(["--write", file])` + checkIdempotence | `formatContent → write → checkIdempotence` |
| verify | 699 | `runOxfmt(["--check", file])` + checkIdempotence | `formatContent → diff → checkIdempotence` |
| guard+check | 702 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| guard+dry-run | 705 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| guard+fix (snapshot) | 727 | `runOxfmt(["--write", file])` | `formatContent → write file` |
| check | 742 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| dry-run | 745 | `runOxfmt(["--check", file])` | `formatContent → diff against original` |
| write (default) | 764 | `runOxfmt(["--write", file])` + checkIdempotence | `formatContent → write → checkIdempotence` |

**Module exports removed from `module.exports`:**
- `OXFMT_MAX_VERSION`
- `getOxfmtPathCandidates`
- `getSpawnOptions` (utility still exists but is now internal-only; if tests import it, keep export)
- `isSupportedOxfmtVersion`

**Module exports unchanged:**
- `NODE_RUNTIME_MIN_VERSION`, `parseArgs`, `runDoctor`, `findMarkdownFiles`, `resolveInputFiles`, `processFile`, `main`, `repairTableColumns`, `repairAdjacentPipes`, `normalizeTableSpacing`, `auditTables`, `hasTableWithEmptyCells`, `isWriteMode`, `checkIdempotenceReadOnly`

### MODIFY — `test/unit/formatter.test.js` (444 LOC)

| Test | Change |
| :--- | :----- |
| `collectDoctor()` helper | Replace `resolveOxfmt`/`runVersion` with `resolveFormatter`/`checkFormatter` or similar; doctor no longer checks oxfmt |
| `reports runtime readiness` | Change assertions: no longer expect `oxfmt:` output; expect `Formatter:` or equivalent |
| `prefers Windows oxfmt shims` | **Remove** — tests `getOxfmtPathCandidates` which is deleted |
| `reports missing oxfmt` | **Remove** — no oxfmt to miss. Replace with test that checks missing `format-content.mjs` |
| `reports unsupported Node.js` | Keep — Node version check is unchanged |
| `reports oxfmt version command failures` | **Remove** — no oxfmt version check |
| `warns when oxfmt version exceeds tested max` | **Remove** — no oxfmt version check |
| `isSupportedOxfmtVersion` | **Remove** — function deleted |
| `reports missing config and payload` | No longer expects `.oxfmtrc.json` in doctor output; expects `format-content.mjs` |
| `builds child-process options` | **Remove** — `getSpawnOptions` is internal-only after refactor (or keep if still exported) |
| All repair/adjacent/audit/empty-cell tests | Unchanged — these test preflight logic, not oxfmt |
| All idempotence tests | Unchanged — `checkIdempotenceReadOnly` is kept and repurposed for formatContent regression |

**Net effect:** ~6 tests removed, ~3 tests rewritten, ~3 tests kept. Test count drops from 125 to ~119.

### MODIFY — `test/integration/cli.test.js` (516 LOC)

| Test | Change |
| :--- | :----- |
| `--doctor reports readiness` | No longer expects `oxfmt:` in stdout; expects formatter check |
| `--doctor exits non-zero when oxfmt unavailable` | Rewrite: exits non-zero when `format-content.mjs` is missing instead |
| `--fix on a clean table succeeds (regression)` | Output format may change from oxfmt-aligned columns to formatContent-aligned; update assertion regex |
| `--fix preserves no-leading-pipe...skipping oxfmt` | Test name mentions "skipping oxfmt" — rename to "skipping formatter" or "empty cells" |
| `--fix --guard with double-pipe...skips oxfmt` | Same — update test name |
| `--fix blocks inline-code...before oxfmt can corrupt` | Update: "before formatter can corrupt" or similar |

### MODIFY — `scripts/check-consistency.js` (239 LOC)

| Section | Change |
| :------ | :----- |
| `files` object (lines 21-32) | Remove `.oxfmtrc.json`, `skills/markdown-formatter/.oxfmtrc.json` from the read list |
| oxfmt pin check (lines 75-84) | Remove — checks `devDependencies.oxfmt` exists and is pinned |
| Stale reference checks (lines 100-105) | Keep — format engine patterns still valid; micro-formatter is the target |
| Active drift check patterns (lines 107-114) | Update `ACTIVE_DRIFT_CHECK_PATTERNS` — add `format-content.mjs` |
| Stale-content check loop (lines 116-129) | No change — `AGENTS.md` and `CHANGELOG.md` kept in the list (not part of this plan) |
| oxfmt config alignment (lines 170-221) | **Remove entirely** — `KNOWN_OXFMT_KEYS`, `.oxfmtrc.json` validation, skill oxfmtrc comparison |
| Function removed: all oxfmt config helpers | No parser needed for a config that no longer exists |

### MODIFY — `scripts/staged-install-verify.sh` (306 LOC)

| Item | Change |
| :--- | :----- |
| `RUNTIME_ALLOWLIST` | Remove `.oxfmtrc.json`; add `format-content.mjs`. Remaining 7 items: SKILL.md, index.js, format-content.mjs, 4 guard scripts |
| Verification tests | `--doctor` now checks for `format-content.mjs` instead of oxfmt; update assertions accordingly |

### MODIFY — `scripts/validators/repo-shape.js` (97 LOC)

| Item | Change |
| :--- | :----- |
| `PLAN_EXPECTED_REPO_SHAPE` | Remove `.oxfmtrc.json`, `skills/markdown-formatter/.oxfmtrc.json` |

### MODIFY — `scripts/validators/ci.js` (71 LOC)

| Item | Change |
| :--- | :----- |
| Oxfmt anti-pattern (line 22) | `"uses markdownlint (not oxfmt)"` → `"uses an external formatter (not this repo's formatter)"` |
| npx oxfmt anti-pattern (line 24) | **Remove** — no oxfmt to invoke via npx |
| Required: oxfmt version (line 35) | **Remove** — no oxfmt version to verify |
| Required: pinned npm oxfmt install (line 41) | **Remove** — no oxfmt npm dependency |

### MODIFY — `package.json` (25 LOC)

| Field | Change |
| :---- | :----- |
| `description` | Remove "powered by Oxc oxfmt" → "AI-agent-safe GFM and MDX Markdown formatter with structural guards" |
| `devDependencies` | Remove `"oxfmt": "0.56.0"` |
| `scripts` | Unchanged — `npm test`, `npm run format:check` etc. all work with new engine |

### MODIFY — `README.md` (306 lines)

Major documentation overhaul for oxfmt removal only.

| Location | Change |
| :------- | :----- |
| Description (lines 8-10) | Remove "powered by Oxc's `oxfmt`" |
| Quick start (lines 14-36) | Unchanged — CLI interface is the same |
| Why not just use... table (lines 52-57) | Replace `oxfmt` row with "Generic formatters (Prettier, oxfmt)" |
| "What it does" section (lines 61-74) | Replace all oxfmt references with "the formatter" |
| "Architecture: formatter as a commodity" (lines 136-140) | **Remove** — this section's "oxfmt is swappable" premise is satisfied |
| "Install instructions" (lines 170-201) | Remove `.oxfmtrc.json` from shipped payload tree; remove oxfmt from prerequisites list |
| "Prerequisites" (lines 203-233) | Remove all oxfmt PATH/install instructions. Prerequisites become: Node.js >=20 only |
| "Release posture" (lines 256-295) | Remove CHANGELOG-specific statements (keep generic release description) |
| Shipped payload tree (line 191) | Remove `.oxfmtrc.json` from the tree diagram |

### MODIFY — `skills/markdown-formatter/SKILL.md` (162 lines)

| Location | Change |
| :------- | :----- |
| YAML frontmatter: `description` | Remove "powered by oxfmt" |
| YAML frontmatter: `tags` | Remove `oxfmt`, `oxc` |
| "Runtime config" (lines 33-36) | Rewrite — no `.oxfmtrc.json`; formatter is built-in pure JS |
| "Prerequisites" (lines 72-76) | Remove oxfmt/`--doctor` prerequisite; only Node.js >=20 |
| "Table and pipe safety" (lines 91-113) | Replace oxfmt references with "the formatter" |
| "References" (lines 160-162) | Remove oxfmt docs link |

### MODIFY — `.github/workflows/ci.yml` (135 lines)

| Step | Change |
| :--- | :----- |
| `precheck` → `Verify oxfmt version` (lines 41-49) | **Remove** entire step — no oxfmt to verify |
| `verify` → comment on line 109 | Remove "oxfmt --check" from comment |
| Idempotence check (lines 126-135) | Keep as-is — `--check` still runs, two-pass still verifies stability |

### COSMETIC — changes in comments/strings only (non-functional, SKIP or batch after swap)

| File | Match | Change type |
| :--- | :--- | :--- |
| `skills/markdown-formatter/scripts/check-pipes.js` line 117 | Comment: "would cause oxfmt to misparse" | Comment-only; no behavioral impact |
| `skills/markdown-formatter/scripts/check-tables.js` (7 occurrences) | Comments + error messages: "oxfmt/Prettier would split", "before oxfmt runs" | Error messages are user-facing — update 2 error messages (lines 248, 260) |
| `test/unit/check-tables.test.js` line 72 | Test name: "before oxfmt can split them" | Cosmetic — test name only |
| `test/fixtures/violations/table-inline-code-pipe.md` line 3 | Description: "oxfmt/Prettier splits them" | Fixture description — cosmetic |
| `test/fixtures/violations/table-adjacent-pipes.md` line 3 | Description: "oxfmt cannot safely format" | Fixture description — cosmetic |
| `scripts/validators/repo-shape.js` line 22 | Comment in stale check: "not oxfmt" | Comment only |
| `scripts/check-all.js` lines 6, 22 | Default target path: `test/fixtures/oxfmt-spike` | Cosmetic — directory name only |

---

## Updated `processFile()` flow

```
ORIGINAL:
  repairs → runOxfmt → checkIdempotenceReadOnly

NEW:
  repairs → formatContent → checkIdempotenceReadOnly (kept as regression)
```

The 12 call sites in `processFile()` that call `runOxfmt()` are replaced with:

```js
const { formatContent } = require('./format-content.mjs');
const formatted = formatContent(content, { indentStyle: 'spaces', indentWidth: 2 });
const idempotent = checkIdempotenceReadOnly(formatted, file);  // kept
```

The `--check` mode replaces `runOxfmt(["--check", file])` with `formatContent → diff against original`.

The `--verify` mode keeps `checkIdempotenceReadOnly` as a regression assertion. It still runs `runStructuralValidation`.

The `--guard` mode keeps its pre/post structural snapshot logic unchanged — only the formatting call in the middle changes.

---

## Updated `--doctor` check

Replace the Oxfmt binary check with:

- **Required:** Node.js >=20 (unchanged)
- **Config file:** removed from check (no `.oxfmtrc.json`)
- **Payload files:** SKILL.md, `format-content.mjs`, guard scripts (unchanged)
- **New check:** `format-content.mjs` must be require-able (catches missing file or syntax error)

---

## CI and build changes

| Pipeline step | Old | New |
| :------------ | :-- | :-- |
| `npm ci` | Installs oxfmt binary (3 packages, 8.3MB) | Installs zero packages (empty or minimal) |
| `npm test` | 37 tests pass | Same tests, same expectations |
| `scripts/format-files.js` | Calls oxfmt CLI via subprocess | Calls `formatContent()` in-process |
| `npm run format` / `format:check` | Oxfmt subprocess | `formatContent()` in-process |

The `package.json` scripts don't change — same CLI interface, different engine.

---

## Test suite changes

Every test file that changes, with exact old→new assertion patterns.

### New: `test/unit/format-content.test.js` (~20 tests)

Five describe blocks per pass plus composition.

| Group | Test | What it asserts |
| :--- | :--- | :--- |
| `normalizeTrailingWhitespace` | trailing spaces removed | Lines with trailing spaces/tabs stripped |
| | trailing tabs removed | Same for tab characters |
| | empty lines with spaces cleaned | Whitespace-only lines become empty |
| | content inside fences not touched | Lines inside fences still trimmed (universal operation is safe for fences) |
| `ensureFinalNewline` | no trailing newline → appended | Content without `\n` gets one |
| | already has newline → unchanged | Identity |
| | empty content → `\n` | Single newline |
| `normalizeIndentation` | already-2-space is idempotent | Identity for already-compliant content |
| | tab-style → 2-space | Leading tab becomes 2 spaces |
| | mixed tabs+spaces dedented | First non-fence indent (tab) sets policy |
| | fenced blocks preserve content | Content inside fences untouched |
| | no indentation → unchanged | Identity for plain content |
| `alignTables` | already aligned is idempotent | Identity for already-aligned table |
| | misaligned columns align | Max-width per column |
| | alignment markers preserved | `:---`, `---:`, `:---:` survive |
| | escaped pipes ignored | Backslash-pipe in cell not a column boundary |
| | tables inside fences unchanged | Content between fences untouched |
| | non-table pipe content unchanged | Pipes in prose preserved |
| | short data rows padded | Trailing empty cell matches column count |
| | empty-cell tables skipped | Table with empty cells left untouched (only trailing-whitespace/final-newline apply) |
| `normalizeFences` | already backtick is idempotent | Identity |
| | tilde → backtick | `~~~…~~~` converted to backtick |
| | tilde with info string preserved | Info string after opener verbatim |
| | backtick count escalation | 4-backtick outer when content already has 3-backtick |
| | no fences → unchanged | Identity |
| `formatContent` (composition) | two-pass idempotence | `formatContent(formatContent(fixture)) === formatContent(fixture)` for every fixture in fixture directories |
| | output passes structural guards | Every fixture output passes `check-structure.js`, `check-tables.js`, `check-fences.js` |

### Modified: `test/unit/formatter.test.js` (444 LOC → ~340 LOC)

**Imports change (lines 6-18):**
- Remove: `OXFMT_MAX_VERSION`, `isSupportedOxfmtVersion`, `getOxfmtPathCandidates`
- Keep: `NODE_RUNTIME_MIN_VERSION`, `parseArgs`, `runDoctor`, `checkIdempotenceReadOnly`, `getSpawnOptions`, `resolveInputFiles`, `repairTableColumns`, `auditTables`, `hasTableWithEmptyCells` (all unchanged)

**`collectDoctor()` helper rewritten (lines 21-33):**

```
Old:                                           New:
  runDoctor({                                     runDoctor({
    log,                                            log,
    nodeVersion,                                    nodeVersion,
    resolveOxfmt: () => '/tmp/oxfmt',               resolveFormatter: () => '/tmp/format-content.mjs',
    runVersion: () => ({                            checkFormatter: () => ({ ok: true, path: '/tmp/format-content.mjs' }),
      status: 0,                                    exists: () => true,
      stdout: 'oxfmt 0.54.0\n',                   ...options,
      stderr: '',                                   });
    }),
    exists: () => true,
    ...options,
  });
```

| Current test | Action | Old assertion | New assertion |
| :--- | :--- | :--- | :--- |
| `reports runtime readiness` | Rewrite | `output.match(/oxfmt: \/tmp\/oxfmt \(oxfmt 0\.54\.0\)/)` | `output.match(/Formatter: \/tmp\/format-content\.mjs/)` |
| | | `output.match(/Config: .*\.oxfmtrc\.json \(ok\)/)` | Remove this assertion (no config file) |
| `builds child-process options` | Keep (if `getSpawnOptions` exported) | `deepStrictEqual(getSpawnOptions(...), { encoding: 'utf8', timeout: 5000 })` | Unchanged |
| `prefers Windows oxfmt shims` | **Remove** | Tests `getOxfmtPathCandidates` | — |
| `reports missing oxfmt` | **Rewrite** | `output.match(/oxfmt: missing/)` | `output.match(/Formatter:.*missing/)` |
| | | `output.match(/Install oxfmt on PATH/)` | Remove |
| `reports unsupported Node.js` | Keep | `Node.js: v19.0.0 (requires >=20)` | Unchanged |
| `reports oxfmt version command failures` | **Remove** | Tests `runOxfmt` | — |
| `warns when oxfmt version exceeds tested max` | **Remove** | Tests `OXFMT_MAX_VERSION` | — |
| `isSupportedOxfmtVersion` | **Remove** | Function deleted | — |
| `reports missing config and payload` | **Rewrite** | `Config: .*\.oxfmtrc\.json (missing)` | Remove (no config) |
| | | `Payload: .*check-tables\.js (missing)` | Keep |
| All idempotence tests for `checkIdempotenceReadOnly` | Keep | Unchanged — function kept, tests keep working | Unchanged |

**Net change:** 4 tests removed, 3 rewritten, 8 kept (15 → 11)

### Modified: `test/integration/cli.test.js` (516 LOC → ~500 LOC)

| Current test | Change | Old assertion | New assertion |
| :--- | :--- | :--- | :--- |
| `--doctor reports readiness` (line 368) | Update assertion | `/oxfmt:/` | `/Formatter:/` |
| `--doctor exits non-zero when oxfmt unavailable` (line 372) | Rewrite name + assertion | `/oxfmt: missing/` | `/Formatter:.*missing/` |
| | | `/Install oxfmt on PATH/` | Remove |
| `--fix --guard with clean table` (line 297) | Update column-width regex | See note below | See note below |
| `--fix on a clean table succeeds (regression)` (line 444) | Update column-width regex | See note below | See note below |
| Test names mentioning oxfmt (3 tests) | Cosmetic rename | "skipping oxfmt" / "before oxfmt can corrupt" | "skipping formatter" / "before formatter can corrupt" |

**Column-width assertion note (lines 297, 444):**
Oxfmt pads to ~4-5 char minimum cell width (producing `| A   | B   |`). FormatContent pads to exact max content width + 1 space each side (producing `| A | B |`). The new assertion must match the engine's actual output. Two options:

- **Recommended:** Replace specific-width regex with structural alignment check:
  ```js
  const rows = readFileSync(file, 'utf8').split('\n').filter(l => l.startsWith('|'));
  const pipeCounts = rows.map(r => (r.match(/\|/g) || []).length);
  assert.equal(pipeCounts[0], pipeCounts[1]);  // header ≈ delimiter
  assert.equal(pipeCounts[1], pipeCounts[2]);  // delimiter ≈ data
  assert.equal(runCli(['--check', file]).status, 0);  // passes idempotence
  ```
- **Alternative:** Record formatContent's actual output and update regex after Phase 1.

### Modified: `scripts/staged-install-verify.sh` (306 LOC)

| Item | Change |
| :--- | :----- |
| `RUNTIME_ALLOWLIST` | Remove `.oxfmtrc.json`; add `format-content.mjs`. Remaining 7 items: SKILL.md, index.js, format-content.mjs, 4 guard scripts |
| `--doctor` exit code check (lines 174-179) | **No change needed.** Only checks exit code == 0; new doctor still exits 0 on success |

### Kept unchanged (zero changes)

| File | Reason |
| :--- | :----- |
| `test/unit/check-fences.test.js` | Tests guard scripts — no oxfmt reference |
| `test/unit/check-pipes.test.js` | Tests guard scripts — no oxfmt reference |
| `test/unit/check-structure.test.js` | Tests guard scripts — no oxfmt reference |
| `test/unit/check-tables.test.js` | 1 test name mentions oxfmt — cosmetic only, preserved |
| `test/unit/format-files-node-api.test.js` | Not affected |
| `test/unit/docs.test.js` | Checks "preflight" appears in README.md and SKILL.md — must retain "preflight" wording |
| `test/fixtures/` (all 37 fixtures) | No fixture content changes. Descriptions mentioning oxfmt are cosmetic |
| `test/integration/` guard-script integration tests | Unchanged — only the `--doctor` and formatting tests change |

---

## Migration sequence

### Phase 1: Build `format-content.mjs`

1. Create `skills/markdown-formatter/src/format-content.mjs` with the 5 passes (trailing whitespace, final newline, indent normalize, table align, fence normalize) — ~65 LOC
2. Add unit tests in `test/unit/format-content.test.js` covering all edge cases from the spike fixtures
3. Verify against every fixture in `test/fixtures/oxfmt-spike/`, `test/fixtures/current/`, `test/fixtures/pipe-safety/` — output must be idempotent on first pass; structural guards must still pass; empty-cell tables must be skipped

### Phase 2: Swap the engine

4. **`skills/markdown-formatter/src/index.js`** — Replace all 12 `runOxfmt()` call sites in `processFile()` with `formatContent()`. Remove functions: `getOxfmtExecutableNames`, `getOxfmtPathCandidates`, `resolveOxfmtBin`, `getOxfmtBin`, `isSupportedOxfmtVersion`, `runOxfmt`. **Keep** `checkIdempotenceReadOnly` and call it after `formatContent()` as a regression assertion. Remove constants `OXFMT_CONFIG`, `OXFMT_MAX_VERSION`. Update `runDoctor()` to check `format-content.mjs` instead of oxfmt. Update `printHelp()`.
5. **`test/unit/formatter.test.js`** — Remove tests for deleted exports. Rewrite doctor tests. Add `format-content.mjs` availability tests. Keep idempotence tests.
6. **`test/integration/cli.test.js`** — Update doctor tests. Update test names mentioning oxfmt. Update column-width assertions.
7. Run full test suite — ~119/119 must pass, including idempotence checks

### Phase 3: Remove Oxfmt plumbing

8. **`package.json`** — Remove `devDependencies.oxfmt`. Update `description`.
9. **`.oxfmtrc.json` (root)** — Delete file
10. **`skills/markdown-formatter/.oxfmtrc.json`** — Delete file
11. **`staged-install/`** — Will be regenerated by verify script (step 18); stale `.oxfmtrc.json` disappears
12. **`.github/workflows/ci.yml`** — Remove "Verify oxfmt version" step in `precheck` job. Update fixture step comments. Keep idempotence check.
13. **`scripts/check-consistency.js`** — Remove `.oxfmtrc.json` from file-read list. Remove oxfmt pin check. Remove oxfmt config alignment block. Add `format-content.mjs` to `ACTIVE_DRIFT_CHECK_PATTERNS`. **Keep** `AGENTS.md` and `CHANGELOG.md` in the read list (not part of this plan).
14. **`scripts/validators/ci.js`** — Remove oxfmt version required pattern. Update anti-pattern labels. Remove npx oxfmt anti-pattern. Remove pinned npm oxfmt required pattern.
15. **`scripts/validators/repo-shape.js`** — Remove `.oxfmtrc.json` from `PLAN_EXPECTED_REPO_SHAPE`.

### Phase 4: Documentation and cleanup

16. **`README.md`** — Remove "powered by Oxc oxfmt" from description. Remove "Architecture: formatter as a commodity" section. Remove oxfmt from prerequisites. Update shipped payload tree (remove `.oxfmtrc.json`). Update release process documentation for oxfmt removal only.
17. **`skills/markdown-formatter/SKILL.md`** — Remove oxfmt/oxc from frontmatter tags. Remove "powered by oxfmt" from description. Rewrite "Runtime config" section (no `.oxfmtrc.json`). Remove oxfmt from prerequisites. Replace oxfmt references with "the formatter" in table safety section. Remove oxfmt docs link.
18. **Renovate `staged-install/`** — Run `bash scripts/staged-install-verify.sh` to regenerate with updated allowlist. Confirm `--doctor` output matches new format.
19. **COSMETIC sweep (optional batch)** — Update oxfmt mentions in: check-pipes.js comment, check-tables.js error messages, check-tables.test.js test name, fixture descriptions, check-all.js default path.

### Phase 5: Verify

20. `rm -rf node_modules package-lock.json && npm install` — should have 0 deps, no binary downloads
21. `npm test` — all tests pass (~119/119)
22. `npm run format:check` — zero diffs on README.md and SKILL.md
23. `npm run format` — idempotent
24. `node skills/markdown-formatter/src/index.js --doctor` — reports ready, no oxfmt reference
25. `bash scripts/staged-install-verify.sh` — passes with new allowlist

---

## Open questions

| Question | Context | Decision |
| :------- | :------ | :------- |
| Empty-cell tables: skip alignment entirely or spacing-normalize only? | `hasTableWithEmptyCells` detects them pre-formatting. Current `format-content.mjs` skips table alignment but still applies trailing-whitespace + final-newline + indent normalization + fence normalization. Is the skip granular enough? | Already implemented: trailing-whitespace, final-newline, indent, and fence passes still apply. Only the table-alignment pass is skipped. Document this as the contract. |
| Tilde→backtick automatic or opt-in? | Oxfmt always normalized. If a user chose tilde fences intentionally, automatic conversion may surprise them. Options: always normalize (current behavior) or gate behind `--fence-style=backtick` flag. | **Always normalize** — matching oxfmt behavior for consistency. Document in SKILL.md. |
| Should `format-content.mjs` be bundled in the staged install? | Yes — same as `src/index.js` currently ships. | Already in the RUNTIME_ALLOWLIST update. |
| Does `--verify` still need `runStructuralValidation`? | Yes — `--verify` runs guard scripts + formatting check + two-pass idempotence regression. | Kept unchanged. |
| `getSpawnOptions` — remove from exports or keep for test convenience? | Only guard scripts call it via `spawnSync`. After refactor, index.js no longer uses it. | Keep exported — zero benefit to break the one test that imports it. |

---

## Related evidence

- Spike fixture taxonomy: `~/projects/markdown-oxc-spike/` — 9 source, 3 current, 1 pipe-safety, 8 violation fixtures
- Spike conclusion: `~/projects/markdown-oxc-spike/planning.md` (Open questions section, 2026-06-25 entry)
- Production guard scripts: `~/projects/agents-markdown-formatter/skills/markdown-formatter/scripts/`
- Production test fixtures: `~/projects/agents-markdown-formatter/test/fixtures/`
