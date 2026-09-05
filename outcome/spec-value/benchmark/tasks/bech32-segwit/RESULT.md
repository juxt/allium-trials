# bech32-segwit result (4th codebase, CRYPTO) — 18-pt gap; spec makes flaky memory reliable

| arm | opus | sonnet |
|---|---|---|
| none | 82.1 | 82.1 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

No-spec is BIMODAL: full 26/26 in ~1/3 of runs (the model recalled bech32's exact charset + polymod from
training) and 19/26 in ~2/3 (knows the structure and reject-cases but botches the exact charset/checksum from
fuzzy memory). ANY spec -> reliable 100%.

**Finding:** even for a FAMOUS algorithm (BIP-173 bech32), a model's memory is UNRELIABLE — it half-remembers
the arbitrary charset/polymod. A spec supplies them exactly, so all spec arms are a reliable 100 vs no-spec's
flaky 82. The value is RELIABILITY over flaky recall, not just filling a total blank. Both models score the
same (82.1) — bech32 is well-known enough that the weaker model isn't extra-disadvantaged here (contrast the
BESPOKE conventions where sonnet fell further, e.g. npf pmt). v3 = v4 = prose = 100 (no language distinction;
prose reliable here).
