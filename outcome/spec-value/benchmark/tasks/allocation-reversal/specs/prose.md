`reverse(allocations, amount)` refunds `amount` from a set of prior allocations, returning a dict of
{bucket: amount_reversed}.

Rules:
- Unwind in REVERSE priority order: the lowest-priority bucket that was paid is reversed first. Priority
  order is PAST_DUE before DUE before IN_ADVANCE, and within each PENALTY before FEE before PRINCIPAL
  before INTEREST; reversal walks this order backwards (IN_ADVANCE INTEREST first, PAST_DUE PENALTY last).
- Never reverse more from a bucket than was allocated to it.
- Stop once `amount` is exhausted; the total reversed is min(amount, total allocated).
