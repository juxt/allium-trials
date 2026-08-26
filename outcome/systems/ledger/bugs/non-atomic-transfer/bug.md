# Planted bug: non-atomic-transfer

`transfer` credits the destination BEFORE the funds check, so a transfer that fails on insufficient funds leaves the destination already credited — money is created and conservation is broken.
