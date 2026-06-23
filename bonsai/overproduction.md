---
layout: page
title: Eliminate Overproduction
nav_order: 7
---

# Eliminate Overproduction

The top source of waste is overproduction. Overproduction of software,
overproduction of backlog, overproduction of features, overproduction of
meetings. Even ostensibly good things like documentation and tests can be
overproduced. Produce just enough, just-in-time. Produce enough tests
to make sure that you can change with confidence and that the software
behaves as expected. Produce enough documentation to make your users happy.

If you produce backlog that no one will ever look at,
you have produced nothing. In fact, when you revisit this stale,
never-delivered backlog months later, you may waste more time trying to
freshen it up. Overproduction can compound and increase your
team's burden over a long period of time.
A feature that seems easy at the time can cause a long-lasting drag
on the team to support and maintain.

## Don't Entrench the Wrong Solution

It's okay to sketch a possible solution and even implement a proof-of-concept
and then let it die. Once a solution is out "in the wild" and being used by
customers, it can be impossible to get the toothpaste back in the tube.
You may be stuck with the solution forever. Be careful what you introduce
to customers and third parties. If something is kept internal, where
your team controls all of the clients and interfaces, you can still
decide to refactor it, change directions, eliminate it and, because you
control all of the clients, you can break "backwards compatibility" without
breaking your software in production. Once you've introduced something to
external teams and external customers, it's much harder to change.

## Limit Your Public Surface Area

In general, your public surface area should be limited as much as possible.
Once you release a public API, even if you call it "alpha" or "beta" and
warn people that you may break them, it's not as easy to make changes as it
is when you control all callers.
Once you release some public documentation, people will start building on it
and start having expectations of stability. How many versions will you have to
support? Even an innocent action like handing out a link to a customer can
cause support overhead and increase the cost of change. Limit the amount
of public surface area to your systems that people outside of your
team can depend on.
