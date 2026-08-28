# The elicit counterweight — a non-saturated, measurable result

## What it tests

Value proposition #1: the elicit skill is a counterweight to the model's trained disposition
to be helpful and proceed. This is disposition, not capability, so it can escape the
saturation that defeated every solving/detection benchmark. Six design decisions in a
deliberately under-specified brief; tools disabled (pure disposition). Two kinds:

- **inferable** (2): a careful model can reason the sensible answer.
- **non-inferable** (4): org-specific policy the model genuinely cannot know (an internal
  submission deadline, which of two legal entities reports, a placeholder code for bespoke
  collateral, an internal reporting carve-out).

## Result (N=4 each, opus)

                       non-inferable (org-specific)        inferable
    build     guessed-unfounded 14/16 (88%), surfaced 2    decided 7/8
    elicit    surfaced 16/16 (100%), guessed 0             over-surfaced 8/8

## Reading

The value is real and non-saturated. Told to build, the model **confidently fabricates
org-specific details it cannot know 88% of the time** — it invents a deadline, picks a legal
entity, makes up a placeholder, defines a carve-out. These are exactly the quietly-flawed
assumptions that ship. The elicit discipline surfaces every one of them (100%) and guesses
none. It works because the model literally cannot know these answers, so its only options
are to fabricate (its helpful default) or to surface — and the counterweight forces the
latter.

The cost is equally visible and honest: elicit over-surfaces the **inferable** points too
(8/8), where the build arm reasons them out correctly (7/8). The current skill is maximally
cautious — it surfaces everything, including what a model could settle. That is a tunable:
a refined skill would surface the genuinely under-determined and reason the inferable. Even
untuned, in a high-stakes setting the value (catching 88% fabricated org-specifics)
outweighs the cost (a couple of over-surfaced inferable points).

## Why this matters

This is the first LLM-in-loop result that does not saturate, and it is on the axis the
value proposition actually claims. It is not that the tool makes the model smarter; it is
that the discipline stops a capable, helpful model from quietly inventing what it cannot
know. That is measurable, it is large (88% vs 0%), and it is exactly the failure mode a
durable, checked, elicited spec is meant to prevent.

Next: tune the skill to cut the over-surfacing cost (distinguish inferable from
under-determined), and measure whether that trade improves.
