# ADR-0009 — The stakes are chamber choice, working mechanisms, and discovery

**Status:** Accepted

## Context

The ethics list removes every conventional source of tension: no timer, no streak, no
failure state, no loss, no scarcity, no social comparison. Adversarial review pointed
out the obvious consequence — with all of that removed and nothing put in its place, and
with the child choosing nothing anywhere in the plan, what remained was a progress bar
with brass on it.

The negative example is instructive in both directions: Prodigy drew an FTC complaint
alleging manipulative upselling to children, with reviewers logging 16 membership ads in
a 19-minute session. But children spend time customising Prodigy's wizards **because
ownership is the retention mechanism**. Prodigy's failure was monetising ownership, not
offering it.

## Decision

Three sources of stakes, none of which involves loss.

1. **The child chooses which chamber to build next, and that choice biases the
   scheduler's skill pool** toward that instrument's mathematics. The child picks their
   own interleaving and the mapping is legible: the gear train is factors and multiples,
   the balance is equality, the counting board is place value. This is a real,
   consequential choice that feeds a system the plan already has.
2. **The mechanism only works if it is built correctly.** A completed chamber's
   instrument actually operates, and the gear train's ratio is the ratio the child
   built. Correctness is visible in behaviour, not asserted by a badge.
3. **Discovery, not scarcity.** Parts of a chamber are hidden until enough of it exists.
   An optional challenge run costs nothing on failure and is visibly rare on success.

Construction **never regresses**. That is the child-safe version of loss aversion: the
pull to return is "my observatory is unfinished," not "my streak is at risk."

## Consequences

- Point 1 couples the world to the scheduler. `P-05` asserts the bias is real and in the
  declared direction — a legible choice that does nothing is worse than no choice.
- Point 2 means chamber instruments are simulations, not animations. A gear train that
  turns at the wrong ratio is a bug with pedagogical consequences.
- Point 3 must not become a lockbox. "Visibly rare on success" is a display property, not
  a currency.
- `P-04` asserts no code path removes a placed element. If construction can regress, all
  three points collapse back into loss framing.
- The character reinforces the same register: it speaks 3–5 times per session, at genuine
  milestones, and says the specific true thing. A flat praise pool
  ("Perfect / Nice / Brilliant") is the in-repo precedent this explicitly rejects.
