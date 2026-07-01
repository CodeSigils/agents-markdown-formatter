# Inline Code Pipe Table Violation

Unescaped pipes inside inline code spans are valid GFM content, but a formatter can split them as table delimiters and corrupt the table. The formatter must block before formatting.

| Command | Description |
| --- | --- |
| `cat access.log | grep 500` | Pipeline example |
