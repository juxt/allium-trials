# legacy-terminate (legacy modernisation, OBJECTIVE quirk)

Modernise a dynamic-batching drain loop. The load-bearing but surprising behaviour is TERMINATION: the
floor guard (`if size < 1: size = 1`) reads like defensive cruft but is what guarantees each iteration
reduces the work left by >= 1. Drop it in a rewrite and the loop hangs when the caller's sizer returns 0
(e.g. `remaining // 2` at remaining == 1).

Hidden oracle: the modernised code terminates when the sizer returns 0 (detected by a call cap) AND still
drains all items. Requirements state "modernise this", never the termination role of the floor.

The V4 spec records this as an `objective ... measure remaining decreasing` — a first-class, checkable
must-hold property. V3 has no construct for it, so the termination requirement is not recorded at all;
prose omits it because it is non-obvious. Tests whether that difference shows up as V3 < V4.
