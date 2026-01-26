---
layout: page
title: Incremental Change
nav_order: 8.5
---

# Incremental Change

Try to make an improvement to your production software at least every few
days. Some larger efforts may take a week or two. But, you should be able to
make the change or you should have more information to either abandon the
effort, change directions or otherwise arrive at the next state.

The ideal task size is "a couple of days". Try to break down things into
smaller deliverables that can be delivered in "a couple of days". Sometimes
these things may only take 30 minutes, sometimes over a week.

## Stay Close to the Trunk Version

An engineer should be able to sketch a working prototype and try it without
friction and without affecting production.
One should be able to easily compare
the prototype version with the current production version.
The development version should be constantly integrated
with the trunk version as the developer works. In this way merge conflicts
are avoided. Reconciling a long-running or stale branch can be painful
and should be avoided.
