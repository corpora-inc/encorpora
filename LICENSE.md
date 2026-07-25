# License — pending

**This repository does not currently carry a license.** No LICENSE or COPYING file
has ever existed here, and GitHub reports the repository license as `null`.

The source is publicly readable. That is not the same as being licensed for reuse.
Absent a license, default copyright applies: Corpora Inc retains all rights, and no
permission to use, copy, modify or redistribute this code is granted.

If you are here to read, learn from, or file an issue against the code — welcome.
If you intend to reuse any of it, wait for this file to name a license, or ask:
team@encorpora.io.

## Why this file exists

Several shipped architectural decisions in this repo are justified in-tree with the
phrase "the app is open source anyway" — most visibly the entitlement design in
`corpan/corpan-app/src/store/entitlements.ts`, which deliberately prefers letting a
tampered client keep a stale Plus snapshot over ever blocking a real offline
subscriber. That reasoning depends on a licensing posture that has never actually
been written down. This file is the placeholder until it is.

`TODO(founder)`: pick a license. The choice also answers a second question that is
currently unanswered: **do we want outside forks and pull requests?** A permissive
license (MIT/Apache-2.0) invites reuse including closed forks; a copyleft license
(AGPL-3.0) invites contribution but constrains commercial redistribution; "source
available, all rights reserved" keeps the read-only posture we have today. Until
that call is made, treat outside contributions as unsolicited.
