# Planted bug: overdraft-in-withdraw

`withdraw` no longer checks funds, so a withdrawal can drive a balance negative. `transfer` still checks, so the bug is inconsistent and easy to miss on a quick read.
