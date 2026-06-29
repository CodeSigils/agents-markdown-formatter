# Agents Markdown Formatter Instructions

This repository builds a formatter-first Markdown skill/tool for AI agents.

## Agent contract

Agents working here MUST:

1. Use **ripgrep** (grep tool) for searching codebases — never read entire files with `cat`, `head`, or `tail` when a
   targeted search suffices. For large files (>200 lines), use grep with context lines (`grep -C N`) to find the
   relevant section, then read only that section with offset/limit.
2. Keep the installed runtime payload separate from repository-only planning, tests, fixtures, and development tooling.
3. Build and verify the staged install artifact before claiming user-facing shipping readiness.
4. Check edited Markdown files with the repository's Oxc/Oxfmt path, not external Markdown formatters or linters.
5. Do not run doc-formatting tools over raw formatter fixtures unless the task is explicitly testing compatibility on a
   copy.
6. Do not use external Markdown formatters or linters as repo validation because that defeats this repository's purpose.
7. Guard against documentation drift and stale instructions whenever behavior, commands, paths, identity, configuration,
   validation policy, install payload, or release process changes.
8. Review agent guard policies at the end of implementation so shipped instructions do not contain stale transitional
   commands, paths, or identities.
9. After a major overhaul to behavior, CLI semantics, runtime payload, CI, release process, documentation structure,
   fixture policy, or repository layout, run a concise read-only audit before reporting final completion. Do not edit
   during that audit unless the user explicitly asks for fixes.

## Active implementation target

- Runtime payload: `skills/markdown-formatter/`
- Primary CLI: `skills/markdown-formatter/src/index.js`
- Formatter: Oxfmt resolved from local development install or PATH
- Safety guard: optional `--guard` structural pre/post checks; write mode restores original file content on post-format
  drift and cleans temporary snapshots

## Markdown validation policy

This repository exists to build and verify an Oxc/Oxfmt-based Markdown formatter. Agents MUST NOT use unrelated external
Markdown formatters or linters as repository validation because doing so can hide product gaps and defeat the purpose of
the repo.

Do not use these as active validation for repository Markdown:

- Prettier directly
- mdformat or other Markdown formatters
- editor auto-formatters
- external skill/tool wrappers that do not call this repository's Oxc/Oxfmt path

Use the repository-owned validation path instead:

```bash
node skills/markdown-formatter/src/index.js --check <file>    # pipe-safety + formatting check
node skills/markdown-formatter/src/index.js --validate <file>  # structural + fence + table + pipe checks
```

If the repository-owned wrapper or Oxfmt is unavailable, report that repository validation is unavailable instead of
silently substituting another Markdown linter or formatter.

Exception: raw formatter fixtures under `test/fixtures/` may only be formatted when the task explicitly tests formatter
behavior on a copy.

## STRICT / IMPORTANT: drift and stale information contract

This section is a BLOCKING agent contract. Do not treat it as optional guidance.

Agents MUST update every affected source of truth in the same change whenever they change behavior, commands, file
paths, skill identity, Oxfmt configuration, validation policy, install payload, release process, supported workflows,
fixture policy, CI behavior, or publication/readiness status.

Before reporting completion, agents MUST check these files and directories for stale or contradictory information:

- `README.md`
- `AGENTS.md`
- `skills/markdown-formatter/**`
- `references/**` if present
- `test/**`
- `scripts/check-consistency.js`
- `scripts/staged-install-verify.sh`
- `.github/workflows/ci.yml`
- `CHANGELOG.md`

Agents MUST NOT:

- Leave stale transitional commands, old repository names, old skill names, old paths, or obsolete validation
  instructions.
- Claim user-facing shipping readiness unless staged install verification, docs, CI, and runtime payload boundaries all
  match.
- Change CLI semantics such as `--all`, `--check`, `--verify`, `--validate`, `--guard`, or `--fences` without updating
  README, SKILL.md, plan, tests, consistency checks, and CI where applicable.

Treat drift severity as:

| Level    | Meaning                                                        | Agent behavior                |
| :------- | :------------------------------------------------------------- | :---------------------------- |
| BLOCKING | false status, stale commands, broken checks, or payload drift  | fix before reporting complete |
| WARNING  | incomplete context, unclear ownership, or weak readiness words | fix when touching nearby docs |
| INFO     | preserved historical context from prior implementations        | preserve with context         |

For the post-overhaul read-only audit, return concise findings grouped by the same severity levels with concrete
evidence. Check coding/structure standards, release-boundary drift, documentation consistency, package/CI paths, and
staged runtime payload boundaries.
