# Planted bug: same-account-allowed

The same-account guard is gone, so a self-transfer is accepted. Harmless-looking, but it hides the atomicity bug class and, combined with any credit-first ordering, becomes a money pump.
