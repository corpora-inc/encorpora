---
nav_order: 8.8
---

# Find the Low-Hanging Fruit

One thing that facilitators and implementors can try to identify is
the "low-hanging" fruit or the best "bang for the buck" - changes that will
greatly improve the software but don't take much effort.

## Unblock Collaborators

Find the most important low-hanging fruit that many other tasks depend on.
If by finishing task A, you unblock development on tasks B, C and D,
and customers desperately need D, A may be the most important task.
If you can finish the core data model then you may allow other contributors
to build the automation workloads, API endpoints and UI elements
in parallel. Maybe the UI is generally seen as the most important priority
in this scenario; but, it can not be effectively started without the
data model and the API.
Sometimes the most important next task is not what the customers
and non-technical facilitators perceive. Sometimes the next most important
task to do is the thankless work that everyone will depend upon to
deliver the high-profile feature that customers want.
Listen to your most senior subject matter experts and order your tasks
by finding the tasks that unblock and facilitate the downstream tasks.

## Effort Estimation

Some teams use estimation techniques
like "planning poker" to give facilitators an idea of how hard different
features would be to implement. With this information,
facilitators can make a cost/benefit analysis and decide what the next
tasks for the engineering team will be.

My favorite estimation technique is
what could be called the Uniform Kanban Ticket technique.
How many "tickets" would this take? Here a ticket should ideally take
"a couple of days" but maybe up to a week or two.

- Implement the API endpoint
- Create a new UI page with form
- Add option to backend, implement backend changes
- Write tutorial

"4" tickets, pessimistically 4-8 weeks of work. 2 people should easily
be able to do it in 4 weeks. Here there should be plenty of room for
discovery, errors, waste, context switching
by using a conservative estimate.
Perhaps the truth is that your best engineer could do
the entire ask with a couple of days of focused effort.
But, it's better to over-deliver than over-promise.

If you consistently break down tickets so that they should be able to be
done in a "couple of days", you really don't have to make breakdown and
estimation any more complicated than that. You don't need Fibonacci numbers.
Every individual task is an estimate of "1". A larger "epic" can be estimated
roughly as some number of tasks. Feel free to use whatever estimation
system you want or none at all. But, breaking down tickets into roughly
uniform provides a very low-overhead way of estimating that is compatible
with Bonsai.

### How can each ticket be the same size?!

Don't worry about it. You've heard of the normal distribution?
Some tickets will be unusually small, some quite large and difficult.
If you really have enough time on your hands to devote some real time
to estimation,
[start collecting the data](https://kanbanize.com/blog/normal-gaussian-distribution-over-cycle-time/)
and then you can analyze
how long tickets take exactly and what the standard deviation is, how many
new tickets come in and bump others down the backlog.
As your data accumulates and you become more consistent in your practice,
you can achieve very accurate estimates.
But, you should probably not overproduce estimation.
Consider if you really need it or if it will
actually take away from the productivity of the team.
