# Changelog

## Unreleased

- Add README explanation for the problem this repository cures: unstable AI-authored Markdown, uncontrolled prose
  wrapping, fragile tables, and embedded code that should remain untouched.
- Document the formatting philosophy: normalize Markdown prose, keep embedded content opaque, and enforce consistency
  through check-mode workflows.
- Document table safety as repository-owned structural guard behavior rather than `.oxfmtrc.json` configuration.
- Add a CI status badge to the README.

## v1.0.0

- Initial formatter-first Hermes-compatible Markdown skill.
- Support GFM and MDX files through Oxc `oxfmt`.
- Add structural guardrails for fences and GFM tables.
- Add rollback-safe `--fix --guard` behavior when post-format structural drift is detected.
- Add read-only `--check`, `--verify`, `--fences`, and `--validate` workflows.
- Keep the shipped runtime payload limited to the skill definition, CLI, runtime config, and guard scripts.
- Pin development `oxfmt` through `package.json` while keeping npm dependencies out of the installed runtime payload.
