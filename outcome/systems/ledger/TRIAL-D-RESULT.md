# Trial D result — reimplement from spec (ledger)

**Fidelity: 21/21 (100%).** Model `claude-sonnet-4-6`, 2026-08-26.
A reimplementation built from the DISTILLED Allium spec plus minimal non-functionals
only — no original source code — passes the entire hidden acceptance suite.
Reproduce: `node outcome/trial-d.mjs`.

## What this shows

The distilled spec is a strong stand-alone artefact: it carried enough of the
behaviour (the invariants, the operations, the failure modes) to rebuild the system
from scratch faithfully. This is your "complement of the code" measure, and here it
scores at the ceiling.

## Caveats

- The non-functionals I supplied include the public method contract, so the API surface
  was given (as it should be — that is a stakeholder-level fact, not behaviour). What
  the spec had to convey alone was the BEHAVIOUR, and it did.
- A simple system, one model, one run, v3 distill. The value of this measure is on
  harder systems where behaviour is easy to lose; the ledger calibrates the ceiling.
