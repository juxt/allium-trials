# Two ladders: how Allium should grow in reasoning power and in abstraction

A framework for the next arc of work, in plain terms. It replaces a pile of solver jargon with one
picture: a spec, and a tool that reasons about it, both climb the same gradient from simple to intricate.

## Ladder one: reasoning power

To check a spec, the tool asks a reasoning engine a question. There is a ladder of engines, each able to
answer more but costing more in speed and predictability.

- **Structural.** Does it parse, do the names resolve. No real reasoning.
- **Boolean logic (SAT).** True-or-false flags and guards. "Is there a combination of on-off states that
  breaks the rule?" Fast, always terminates, crisp yes or no. Proves state-machine safety.
- **Linear arithmetic (LRA).** Numbers with add, subtract, multiply-by-a-constant, and comparisons. "Is
  there a set of balances satisfying all these constraints at once?" Catches a withdrawal driving a
  balance below zero. Anything linear; the moment two unknowns multiply (a rate times a balance) it is out
  of range.
- **Logic and arithmetic together (SMT).** "Which branch fired, and what was the balance when it did." The
  marriage of the two above. Strictly more powerful, heavier, and pushed far enough it can stop being able
  to answer at all.

Two words that are techniques, not engines, sitting on top of any of these: **bounded model checking**
unrolls the system a few steps and asks "can something bad happen within k steps?", handing back a concrete
counterexample trace; **induction** proves a property can never break, for any number of steps.

The design principle, which is the mature view and not a compromise: **use the weakest engine that
suffices, escalate only when the spec demands it.** The weak engines always terminate and always give a
definite answer. As you climb, the engine expresses more but grows less predictable, until at the top some
questions become genuinely unanswerable. A tool that always reaches for the most powerful engine is slow
and flaky. A tool that meets each spec at the lowest adequate rung is fast, predictable, and honest.

The corollary the user named: you should never have to type vacuous statements to satisfy an engine. The
spec stays natural. The tool tells you which rung it checked you at, what it fully verified, and what it
could not reach and why. It never contorts the spec, and it never pretends to have checked what it skipped.

## Ladder two: abstraction and detail

The second ladder is how much detail a spec carries, from high-level architectural blocks down to intricate
behaviour. A coarse layer names the components and the promises they make to each other. A detailed layer
gives each component its state, its invariants, its actions.

The two ladders are the same gradient seen from two sides. Coarse, high-level layers need only cheap
reasoning. Detailed layers need the richer engines. "Simple spec, simple engine" and "high abstraction,
cheap check" are one idea.

The piece that ties the layers together is **refinement**: a statement that the detailed layer is a
faithful implementation of the abstract one. With it, each layer is checked at its own cost and the coarse
view is trusted without re-reading the detail. For an AI, that is the scaffold for moving up and down the
abstraction ladder: to answer a question you find the right layer, and the spec plus the tool tell you what
is checkable there and at what price.

## The roadmap

Three rungs, each standing on the last.

1. **Transparent tiering (near-term).** Make `analyse` report, per component and invariant, which engine
   it used, what it proved, and what it could not reach and precisely why. This turns today's silent skips
   into an explicit coverage account. It delivers the simplest-adequate-engine principle and the
   no-vacuous-filler promise directly, and it is the substrate everything above stands on.

2. **Layered specs (mid).** Let a spec declare abstraction layers: architectural blocks with contracts,
   refined by detailed behaviour, navigable up and down.

3. **Refinement checking (strategic).** Verify that a detailed layer satisfies every promise its abstract
   contract makes, at the cheapest adequate engine. Each layer verified alone, and proved consistent with
   the one below. This is where the abstraction ladder becomes real, and it connects to the corpus material
   on contracts and composition (X6, N74, N75).

The through-line: a spec as a navigable stack of layers, each met by the cheapest engine that suffices,
connected by refinement, honest at every step about what it has and has not established.
