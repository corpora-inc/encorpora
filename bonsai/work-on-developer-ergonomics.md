---
nav_order: 4.5
---

# Work on Developer Ergonomics

Work on the core of your software - how developers work on it and deliver
change. Make working on the software easy. This is an investment.
There is a balance to be struck. You can't have the whole team endlessly
configuring their editors and never working on features and bugs - unless
the whole point of your software is configuring editors, of course.
Even something as virtuous as Developer Ergonomics can be overproduced.
But, you need to make a minimum investment in developer ergonomics
so that each engineer can easily spin up the existing version of the software
and iteratively test possible improvements.

## Work on Release Ergonomics

In addition to making day-to-day development workflows elegant,
you will need to invest _something_ towards release engineering.
Depending on your software, this might just be hooking up a 3rd party
service to the trunk branch of your repository. In larger projects,
it's likely that you will want to automate a lot of stuff to keep the
release process clean - run all tests, run quality checks, automatically
compile everything that needs to be compiled, spin up a complete test
environment where integration tests can be run. Allow for manual sign-off,
if needed.

## Hermetic Determinism, Reproducibility

For both developer ergonomics and release engineering ergonomics,
one of the most important things to consider is hermitic determinism
and reproducibility.

"The same version of the software" may be meaningless if there is not
a decent amount of hermetic determinism and reproducibility.
Let's look at these words in the context of
[release engineering](https://sre.google/sre-book/release-engineering/).

> Build tools must allow us to ensure consistency and repeatability.
> If two people attempt to build the same product at the same
> revision number in the source code repository on different machines,
> we expect identical results.
> Our builds are hermetic, meaning that they are insensitive to the
> libraries and other software installed on the build machine.
> Instead, builds depend on known versions of build tools,
> such as compilers, and dependencies, such as libraries.
> The build process is self-contained and must not rely on services
> that are external to the build environment. - Google SRE book

Perfect hermetic determinism solves the problem of
"it works on my machine, I don't know why it doesn't on yours".
With hermetic determinism there is no state that can leak into your
build so that any build on a particular machine will be exactly the
same as a build on another machine - perfect reproducibility.
True hermetic determinism may not be practical in your
current situation or you may already have a large project that has
already diverged far from reproducibility.
Still, there are some practices that you can follow
to move in the direction of reproducibility. One of the most important
steps you can take towards hermetic determinism and
reproducibility is to exactly pin every version of every dependency
with the code.

Impressive new tools are being developed that can allow you to use
virtually identical environments in development and production
with much less effort than in the past.
One such tool is
[VSCode Remote Container](https://code.visualstudio.com/docs/remote/containers).
If you have a pinned version of a container with all of your dependencies
pinned within, you should be close to true hermetic determinism
in practice.

Versions that can't be pinned can at least be painstakingly documented
so that people have reproducible steps to get their machine into the
same common state.

## Build it on a new machine

Building the code on a new machine should be as easy and
should yield an identical result as building the code on
the old machine that you've been using for two years.
This is not necessarily
as easy as it may sound and most software teams will find that they fall
short on these goals. "Oh yeah, you have to also set the PYTHONPATH".
"You also need to install this specific version of foobar".
Minimize the friction in setting up a new machine, deploying to a new
cluster. Automate as much of that as you can.
With your small, over-worked team, you might not be able to
realistically aim for complete hermetic determinism to the extent
that Google does.
Don't worry; make small, incremental improvements when
you can. Any time there is a "it works on my machine" issue, do a root cause
analysis and try to prevent that in the future.
