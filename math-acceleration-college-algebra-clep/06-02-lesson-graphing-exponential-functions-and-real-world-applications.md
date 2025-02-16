## Graphing Exponential Functions and Real World Applications

Exponential functions have the form

$$
y = a \cdot b^x
$$

where $a$ is the initial value and $b$ is the base. When $b > 1$, the function represents growth. When $0 < b < 1$, it represents decay.

### Understanding the Exponential Function

Exponential functions appear in many real-life situations such as population growth, compound interest, and radioactive decay. The key characteristics of these functions include:

- **Constant proportional change:** The rate of change is proportional to the current value.
- **Y-intercept at $a$:** When $x=0$, $y=a$.
- **Smooth, continuous curve:** The graph never touches the horizontal axis, but approaches it for decay functions.

For example, consider the function

$$
y = 2^x
$$

This function models exponential growth.

### Graphing an Exponential Function

To graph an exponential function like $y = 2^x$, follow these steps:

1. **Plot the Y-intercept:** When $x = 0$, compute $y = 2^0 = 1$. Place the point $(0,1)$.
2. **Choose additional values of $x$:** For example, if $x = 1$, then $y = 2^1 = 2$. If $x = -1$, then $y = 2^{-1} = 1/2$.
3. **Plot the computed points:** Plot points for $x = -2$, $-1$, $0$, $1$, $2$. They might be $( -2, 1/4)$, $(-1, 1/2)$, $(0,1)$, $(1,2)$, $(2,4)$.
4. **Draw a smooth curve:** Connect the points in a smooth increasing curve for a growth function.

The following graph shows the plot of $y = 2^x$:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={\(x\)},
    ylabel={\(y\)},
    title={Graph of \(y=2^x\)},
    grid=both,
    width=10cm,
    height=8cm,
    domain=-3:3,
    samples=50
]
\addplot[blue] {2^x};
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Real World Applications

Exponential functions are used to model many natural and financial processes.

#### 1. Population Growth

A population growing at a constant rate can be modeled by

$$
P(t) = P_0 \cdot e^{rt}
$$

where $P_0$ is the initial population, $r$ is the growth rate, and $t$ is time. For example, if a population doubles every 5 years, a growth model can be derived using the exponential equation.

#### 2. Compound Interest

The formula for compound interest is

$$
A = P \cdot \left(1 + \frac{r}{n}\right)^{nt}
$$

where $P$ is the principal, $r$ is the annual interest rate, $n$ is the number of times interest is compounded per year, and $t$ is the time in years. This formula is essential in finance for understanding how investments grow over time.

#### 3. Radioactive Decay

Radioactive decay follows an exponential decay law. The amount of a substance remaining after time $t$ is given by:

$$
N(t) = N_0 \cdot e^{-\lambda t}
$$

where $N_0$ is the initial amount and $\lambda$ is the decay constant. This model is widely used in physics and engineering.

### Step-by-Step Example: Graphing a Compound Interest Function

Consider a savings account with an initial deposit of $1000$, an annual interest rate of 5% compounded annually. The model is

$$
A(t) = 1000 \cdot \left(1.05\right)^t
$$

Follow these steps to graph the function:

1. **Identify the Y-intercept:** When $t = 0$, $A(0) = 1000 \cdot 1.05^0 = 1000$.
2. **Compute key points:**
   - For $t = 1$, $A(1) = 1000 \cdot 1.05 = 1050$.
   - For $t = 2$, $A(2) = 1000 \cdot 1.05^2 \approx 1102.50$.
   - For $t = 3$, $A(3) \approx 1157.63$.
3. **Plot the points on a coordinate plane:** Use $t$ as the horizontal axis and $A(t)$ as the vertical axis.
4. **Draw the curve:** Connect the dots to form the exponential growth curve.

A graph of the compound interest function might look like this:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={\(t\) (years)},
    ylabel={\(A(t)\)},
    title={Compound Interest: \(A(t)=1000\cdot1.05^t\)},
    grid=both,
    width=10cm,
    height=8cm,
    domain=0:5,
    samples=50
]
\addplot[red] {1000*1.05^x};
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

These examples illustrate how exponential functions can be graphed and applied to real-world problems. By understanding the behavior of these functions, you can analyze growth and decay models in various contexts.