## Constructing Functions to Model Real World Scenarios

Functions are mathematical relationships that connect an input value to an output value. When creating a function to model a real situation, we identify the variable parts of the scenario, express the relationship mathematically, and use that expression to make predictions and analyze behavior.

### Understanding the Scenario

Before writing a function, first consider the following steps:

- Identify the independent variable (input). This might be time, quantity, or another measure.
- Determine the constant factors in the scenario.
- Recognize the type of relationship (linear, quadratic, etc.) between the input and output.
- Express the situation in a clear mathematical form.

### Defining Variables and Building the Function

A function is typically written as $$f(x) = \text{expression}$$, where $$x$$ is the independent variable. In real life, the function might represent cost, distance, profit, or other quantities.

Begin by:

1. Listing what is known about the situation.
2. Assigning symbols to the unknown quantities.
3. Constructing the equation using the known relationships.

### Example 1: Cost Model for a Pizza Restaurant

Consider a pizza restaurant with a fixed monthly rent and a variable cost per pizza made. 

- Let $$x$$ be the number of pizzas made in a month.
- Suppose the rent is $$50$$ dollars and the cost for each pizza is $$10$$ dollars.

The function that represents the total monthly cost, $$C(x)$$, is:

$$
C(x) = 50 + 10x
$$

This function shows that when no pizzas are made ($$x=0$$), the cost is simply $$50$$ dollars. For each additional pizza, the cost increases by $$10$$ dollars.

#### Visualizing the Linear Model

The graph of $$C(x) = 50 + 10x$$ is a straight line with a slope of $$10$$ and a y-intercept of $$50$$. Consider the following sketch of a number line for a small range of $$x$$ values (number of pizzas):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  \draw[->] (0,0) -- (12,0) node[right]{Number of Pizzas};
  \foreach \x in {0,2,4,6,8,10,12}
      \draw (\x,0.1) -- (\x,-0.1) node[below]{\x};
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Example 2: Distance Traveled at a Constant Speed

Imagine a car moving at a constant speed. The distance it travels is directly proportional to the time spent driving.

- Let $$t$$ represent the time in hours.
- Suppose the car travels at a constant rate of $$60$$ miles per hour.

The function for the distance $$d(t)$$ is written as:

$$
 d(t) = 60t
$$

In this model, if the car drives for 1 hour, it covers 60 miles; for 2 hours, 120 miles, and so on. The relationship is clearly linear with a slope of $$60$$.

### Incorporating Key Factors

In real-world problems, additional factors might need to be considered:

- **Multiple Variables:** Sometimes more than one variable affects the outcome (e.g., cost depending on both quantity and time). In such cases, functions may be extended or multiple functions used.

- **Nonlinear Relationships:** If the rate of change is not constant, the function might be quadratic, exponential, or take another form. Always analyze the situation carefully to determine the correct function type.

- **Units and Interpretation:** Always include correct units when defining the variables. For example, in the cost model, ensure that the cost is in dollars and pizzas are counted correctly.

### Conclusion

By following these structured steps—identifying the independent variable, determining constants and rates, and constructing the relationship—you can create functions that model various real-world scenarios. This methodical process is critical for applications in finance, engineering, science, and everyday problem-solving.

Practice applying these steps with different scenarios to build confidence in constructing function models.