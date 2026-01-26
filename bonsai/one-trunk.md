---
layout: page
title: One Trunk
nav_order: 11
---

# One Trunk

You may want to keep all of the code, configuration and documentation
for your project in the same repository. There are many advantages to this
methodology, often called the "monorepo" strategy.

## External Repositories as Build Artifacts

Just because you have a single source of truth for all of your code
doesn't mean that you won't spin off child repositories from this
single source and even bring changes back in from the child repositories.

Google uses a single repository for all of the code in the whole company.
Yet, they maintain
[over 2,000 repositories on GitHub](https://github.com/google).
The single version and single source of truth for the company does not
preclude pushing and pulling from many small repositories that can be
immersed in version hell to their heart's content.
