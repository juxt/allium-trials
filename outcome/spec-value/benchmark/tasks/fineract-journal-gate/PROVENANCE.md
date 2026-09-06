# Grounded in real Apache Fineract GL

Rule (verbatim from Fineract's JournalEntriesApiResource API doc): "A journal entry may consist of several
line items, each of which is either a 'debit' or a 'credit'. The total amount of the debits must equal the
total amount of the credits or the journal entry is said to be 'unbalanced'."

Source: fineract-accounting/.../journalentry/ (JournalEntryCommandFromApiJsonDeserializer models entries as
SingleDebitOrCreditEntryCommand[] credits/debits; JournalEntryInvalidException is thrown when unbalanced).
This task keeps Fineract's real multi-line structure and balancing rule; only the JSON/JPA plumbing is
stripped so the logic runs standalone (same approach as the MathUtil/TvmFunctions extractions).
