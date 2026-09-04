# allocation-bugfix (WIP, held pending recipe validation)

Design for non-saturation: the buggy allocator must have TWO subtle behavioural bugs where the SYMPTOM
reveals only one. e.g. (a) INTEREST allocated before PRINCIPAL within a due-type; (b) PAST_DUE ordered
after IN_ADVANCE. The failing symptom demonstrates (a). A no-spec fix patches (a) but likely misses (b);
a spec (stating the full correct priority order) fixes both. Graded oracle over scenarios incl. PAST_DUE
catches (b). This separates no-spec from spec.

Held until mathutil-port + allocation-reversal confirm the matrix recipe (graded oracle + non-obvious/
design-decision behaviour + mid-tier model) actually separates arms. Build after.
