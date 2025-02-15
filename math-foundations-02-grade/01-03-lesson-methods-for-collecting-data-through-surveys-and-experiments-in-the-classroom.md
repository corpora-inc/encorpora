\newpage
## Methods for Collecting Data Through Surveys and Experiments in the Classroom

Data collection means gathering information. In this lesson, we learn two ways to collect data: surveys and experiments.

### What is Data Collection?

Data collection is the process of gathering information. We do this to learn more and make decisions.

### Surveys

Surveys ask people questions to get their answers. Here are simple steps to do a survey:

- Decide one or more questions.
- Ask your classmates or friends the questions.
- Write down their answers.
- Count how many times each answer appears.

For example, you may ask, "What is your favorite snack?" and then list the answers.

### Experiments

Experiments test one idea to see what happens. Follow these steps for a simple experiment:

- Choose one thing to test (for example, how much water a plant needs).
- Do the test by changing one part at a time.
- Watch what happens and record the results.

This method shows you cause and effect. For example, you can water one plant a little and another a lot. Then, you see which plant grows better.

### Visual Example: Survey on Favorite School Subjects

Imagine you ask your classmates: "What is your favorite school subject?" You might get answers like Math, Reading, Science, or Art. Count the answers to see which subject is most liked.

Below is a bar graph that shows the survey results.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Math,Reading,Science,Art},
    xtick=data,
    xlabel={School Subjects},
    ylabel={Number of Students},
    ymin=0,
    title={Favorite School Subjects Survey},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large},
]
\addplot[fill=blue!50] coordinates {(Math,5) (Reading,7) (Science,4) (Art,3)};
\end{axis}
\end{tikzpicture}
\end{center}

*Figure: Favorite School Subjects Survey (Label: fig-bar-favorite-subjects)*

### Collecting and Using Data

After you collect data from a survey or experiment, you count and record your results. This information helps you learn which answer is the most common or which experiment worked best.

Use surveys to ask about opinions and experiments to test ideas. Both methods help us understand the world around us.