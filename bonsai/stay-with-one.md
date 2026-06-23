---
layout: page
title: Stay with One
nav_order: 2
---

# Stay with One

Now that you've decided that some software absolutely must be built,
let's continue to keep it as minimal as possible. Zero is the best number.
The next best number is one. Don't have multiple ways to do things.
Don't maintain multiple copies of the same code. Don't have two databases.
Don't create multiple silos. Don't have different workflows for developers.

## One Source of Truth

What defines the software that your developers are working on?
What are the canonical data that support your applications in production?
What data are required to spin up a development environment?
Reduce the cognitive overhead of constructing the system.
The entire state of your system should be able to be constructed with a
single version identifier and a maybe few variables.
There is one version of the code
and there is one version of the data.
There is one way to build and integrate
the software. There is one way to deploy the software,
preferably with a single command.

## Rarely Two, Working Back to One

Sometimes you will need 2. You started deploying to a
virtual machine and now you want to use a whizzbang container environment.
Maybe you can't cut over everything
to the new environment all at once. So, there is an interim period where
you have 2 ways of doing something. This sort of bifurcation is okay and
perhaps inevitable for a large project that spans a long time. You started
in JavaScript and now the benefits of TypeScript are clear and everyone
wants to write code in TypeScript. A new framework or tool emerges that
simply must be utilized. A legacy data model is simply not good enough and
must be rewritten; but, the old data model will still be used for some time.
Part of the codebase was written against a different version of a core
dependency so you have two toolchains to support the two versions.
Bifurcation happens. Try to get back to One. Have a plan to stay united.
Get the whole codebase to the better way.

## Next comes _N_

Try 0, stay with 1, next comes _N_. Sometimes you will need to go beyond
1 or even 2. At this point you should consider _N_ as the target. Instead
of hardcoding 3 clusters that you can deploy to, consider parameterizing so
that you can deploy to any arbitrary number of clusters.
If different modules in your codebase need to use a different version,
maybe you have to allow
every module to pin its own version of that dependency.
If you need 3
languages, maybe you might as well prepare for _N_ languages.
If you have 3 options
for logging, maybe you need an abstract interface that can handle new options
as they arise. Maintaining multiple ways to do things might mean that you need
_N_ ways. Instead of having 3 identical functions that each have an option
hardcoded, have one function that can take multiple values for the option.

Staying with _one_ can allow you to abstract to _N_.

## Don't be Rigid

You're going to be "Agile", right?
Don't be rigid. Keep it simple. These aren't rules.
You have one person who is fantastic with Ruby and another who is
great with TypeScript - you will probably write your frontend in TypeScript
and you backend in Ruby. Another person comes along who loves Golang or Java,
maybe you will add a toolchain for them to build workers in their favorite
language. On paper, in theory, and in this book, you could try choose
a single language so that you can streamline your development process with
a single toolchain. But, your software is not built on paper or in theory,
your software is built by delivering change to your version control system.
So, be flexible and adapt to new information as it emerges.
Use the best tool for the job given your context.
