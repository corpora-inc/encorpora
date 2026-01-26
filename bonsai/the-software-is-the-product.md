---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

# layout: home
nav_order: 3
---

# The Software is the Product

Your software is your product.
No amount of uploading specs or spreadsheets to the corporate file share or
clicking around in some project management web-app
will directly result in an improvement to _your_ software product.
For your software to improve and grow, change must be delivered.
Processes should only be implemented and continued
which facilitate changing your software.
If a process does not help your team make the software better,
eliminate the process.

## All Processes Must Facilitate Change

Hopefully your software is made by committing changes in your
version control system.
If you're not familiar with version control, this will
be one of the first things you'll want to study because
Version Control Systems (VCSs)
are now always at the heart of software change. This is the first place
where you will want to implement some process for delivering change -
your version control system. If you're working alone, maybe you can simply
push changes directly to your main branch and have a third-party service
automatically deploy the changes for you.
This could be a beautifully simple process that allows you to
change and grow your software product.
Work towards being able to change the version of your
production software with a single command.
Perhaps you have a ton of contributors
with varying levels of maturity. In this case you will probably need to
implement more checks and tests before allowing contributors to commit their
changes to your software. Ensuring that your changes land
well in production is the heart of your process. If a small change
to your software requires a lot of manual steps to test and deploy, your
software will stagnate. Optimize for the one-line change. How fast can you
ensure that this change doesn't cause a regression?
How fast can you send this one-line change to production?

One way to keep things simple is to keep a single
[trunk branch](https://trunkbaseddevelopment.com/)
as the single source of truth for what constitutes your software.
You don't need more than one branch in one repository, no matter
how large your software grows.

## Eliminate Detrimental Processes

Do not disincentivize making improvements. If for every improvement
to the software I make, I need to take a punch in the face, I'm going to
make a lot fewer improvements. This is not a realistic example.
But, most software teams, if they think about it, can come up with some
costly and annoying process that makes them not want to contribute
improvements. Maybe I would need to run a bunch of tests manually or check with
someone else to do some manual action, maybe a few emails will need to be sent.
Maybe you will have to hand-write some release notes. Maybe you will need to
register your change in some clunky, old system that you hate. So, rather
than improving the software, you leave it how it is because you detest the
processes around changing the software.
You need to make changing the software cheap and easy.
Eliminate processes that don't make changing the software easier.

## But, We Have to Punch Ourselves in the Face

I know. In _your_ organization, they have this medieval torture device
where people have to be put on the rack for 30 minutes for any improvement
they want to make to the software. You may not have any choice in that.
You may have to submit to the torture, at least in the short term. But,
this book is about what you can control and how you can adapt to your
organization's context.
Don't impose torture on your own team that you are not forced to impose on
them. Eliminate drudgery and toil so your team has more time for inspired
productivity.
