"""Mechanics-only workspace instructions, independent of the director brief."""
KIT = '''# Screenplay mechanics

Write screenplay.json. schema.ts defines the exact JSON fields, figure components,
action names and target syntax. It is documentation, not a file to execute.
The root has id, title, optional seed, cast, and shots. Each shot has an optional
figure and beats. Each beat has speaker, say, optional pause, and a do action array.
Use cast {"teacher": {}, "learner": {}} and explicitly name a speaker on each beat.
Both roles speak. Production binds the voices; do not supply voice IDs or names.
Write spoken math as words in say; use TeX in tex fields and $math$ in prose fields.

A figure can be {"example": true}, using the app's written-lesson example for the
root seed (default "film"), or a custom geometry object with points and parts.
Custom points use mathematical coordinates. Parts have IDs. Parts with start:true
are initially visible; other parts appear with show/draw actions. Actions target
these IDs. The schema documents grids, counters, blocks, bars, tables, mosaics,
segments, polygons, circles, vectors, plots, axes, labels and their actions.
Available example-figure part names are in each problem type in facts.json. Components and their
implementation are readable in runtime/amp/film; schema.ts is the JSON contract.

Work-column actions include problem, write, text, term, stack, column, answer,
clear, overview and recap. clear starts a new work column; overview can display
the columns. An action's at field matches a word in that beat's say; nth selects
an occurrence. Omit timing fields to use defaults. Geometry resets for each shot.

The files in references/ are approved screenplays supplied as format references
only, not a teaching template. Use the assigned film ID, never a reference ID.
Run the exact check command in prompt.txt. Read check.json and open the images
in storyboards/. Fix errors and repeat the check until it passes. The check uses
the kit and installed review player, with landscape and portrait storyboards.
Do not edit runtime files or the kit. Do not run voice or video rendering commands.
'''
