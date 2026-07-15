#!/usr/bin/env bash
# Hermes shell hook: auto-format Markdown files with mdfmt --fix --guard on write_file/patch
#
# Ships with the skill at ~/.hermes/skills/markdown-formatter/scripts/check-markdown.sh
# Register in Hermes config.yaml hooks block, then this runs automatically.
set -eo pipefail

payload="$(cat -)"
file_path="$(echo "$payload" | jq -r '.tool_input.path // ""' 2>/dev/null)" || file_path=""

[[ -z "$file_path" || ! -f "$file_path" ]] && printf '{}\n' && exit 0

case "$file_path" in
  *.md|*.markdown|*.mdx) ;;
  *) printf '{}\n' && exit 0 ;;
esac

run_formatter() {
  local formatter_output

  if ! formatter_output="$("$@" 2>&1)"; then
    local context="[check-markdown] formatting failed for ${file_path}: ${formatter_output}"
    printf '%s\n' "$context" >&2
    jq -n --arg context "$context" '{context: $context}'
    return 0
  fi

  [[ -n "$formatter_output" ]] && printf '%s\n' "$formatter_output" >&2
  printf '{}\n'
}

if command -v mdfmt &>/dev/null; then
  run_formatter mdfmt --fix --guard "$file_path"
elif [[ -f "$HOME/.hermes/skills/markdown-formatter/src/index.js" ]]; then
  run_formatter node "$HOME/.hermes/skills/markdown-formatter/src/index.js" --fix --guard "$file_path"
else
  context="[check-markdown] zero-md-formatter not found; ${file_path} was not formatted"
  printf '%s\n' "$context" >&2
  jq -n --arg context "$context" '{context: $context}'
fi
