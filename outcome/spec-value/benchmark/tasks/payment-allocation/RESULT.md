# payment-allocation result — p7 does NOT replicate on real code (decisive)

N=6. Anti-vacuity gate on the real Fineract 12-bucket allocation order. Same intent all arms; only V4
stated the anti-vacuity objective explicitly.

| arm | catches vacuous | catches wrong-order | passes correct |
|---|---|---|---|
| prose | 100% | 100% | 83% |
| V3 | 100% | 100% | 100% |
| V4 | 100% | 100% | 83% |

**All three catch the vacuous allocator. V3 did NOT miss it.** p7's V4>V3 did not replicate.

## Why p7 won and this didn't (the decisive insight)

p7's V3 obligations were PURELY safety ("never serve stale") — a do-nothing cache satisfies them, so
safety-only test-gen missed the anti-vacuity. HERE, V3's obligations included a POSITIVE behavioural rule
(the allocation ORDER). You cannot test ordering without checking allocation actually happens, so the order
obligation IMPLICITLY forced the anti-vacuity test. The vacuous allocator returns {}, failing every ordering
test — no objective construct needed.

**p7's lone V4>V3 win was an artifact of a spec with NO positive obligation.** Real domain specs almost
always carry a "must produce X" requirement, and that already forces the anti-vacuity test. V4's objective
construct adds nothing V3 did not get for free. On real code there is now NO demonstrated code-level V4>V3.
