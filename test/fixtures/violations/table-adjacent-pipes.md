# Table with adjacent pipes

Adjacent pipes (||) create empty cells. The formatter must not format these
because they expand the column count and can corrupt the table.

| Name  | Age | City   |
|-------|-----|--------|
| Alice | 30  | NYC    |
|| Bob  | 25  | London |
| Carol | 28  | Paris  |
