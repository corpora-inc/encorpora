## Introduction to Logarithms and Their Properties

Logarithms are the inverse operation of exponentiation. They answer the question: To what power must the base be raised to produce a given number? In symbols, if

$$
b^c = a,
$$

then

$$
\log_b(a) = c.
$$

This lesson explains the definition of logarithms and their key properties. These properties are essential in simplifying expressions and solving equations in many real-world applications such as financial calculations, engineering analysis, and scientific measurements.

The idea behind logarithms is to reverse the process of exponentiation. While exponentiation tells you what number you get when you raise a base to a power, logarithms tell you which exponent produced that number.

### Defining Logarithms

A logarithm is defined for a positive number $a$ and a positive base $b$ (where $b \neq 1$). The notation

$$
\log_b(a) = c
$$

means that when the base $b$ is raised to the power $c$, the result is $a$. For example, if we know that

$$
2^3 = 8,
$$

then by definition we have

$$
\log_2(8) = 3.
$$

This definition is critical because it allows us to switch between exponential and logarithmic forms, providing flexibility in solving various types of problems.

### Fundamental Properties of Logarithms

Logarithms have several useful properties that make them powerful tools for simplifying and solving problems. These properties stem from the rules of exponents and help break complex logarithmic expressions into simpler parts:

> **Product Property:**
>
> $$
> \log_b(MN) = \log_b(M) + \log_b(N).
> $$

This property explains that the logarithm of a product is equal to the sum of the logarithms of the factors. Intuitively, this makes sense because multiplying numbers is equivalent to adding their exponents when they have the same base.

> **Quotient Property:**
>
> $$
> \log_b\left(\frac{M}{N}\right) = \log_b(M) - \log_b(N).
> $$

This shows that dividing numbers corresponds to subtracting their logarithms. This property is especially useful when you need to simplify expressions that involve division.

> **Power Property:**
>
> $$
> \log_b(M^p) = p\,\log_b(M).
> $$

When an exponent is within a logarithm, it can be moved in front as a multiplier. This property is handy for solving equations where the variable is an exponent.

> **Change of Base Formula:**
>
> $$
> \log_b(a) = \frac{\log_k(a)}{\log_k(b)}.
> $$

This formula allows you to convert a logarithm with one base to another base. It is particularly useful when calculators only allow the evaluation of logarithms in certain bases, such as $10$ or $e$.

### Example 1: Basic Evaluation

Evaluate the logarithm $\log_2(8)$.

Step 1. Write the definition in its equivalent exponential form:

$$
\log_2(8) = c \quad \Longleftrightarrow \quad 2^c = 8.
$$

Step 2. Recognize that $2^3 = 8$. Therefore, 

$$
\log_2(8) = 3.
$$

This example reinforces the definition of the logarithm by showing the direct relationship between exponentiation and logarithms.

### Example 2: Using the Product Property

Simplify the expression $\log_2(8) + \log_2(4)$.

Step 1. Apply the product property of logarithms:

$$
\log_2(8) + \log_2(4) = \log_2(8 \times 4) = \log_2(32).
$$

Step 2. Recognize that $2^5 = 32$. Thus,

$$
\log_2(32) = 5.
$$

This method shows how the product property reduces a sum of logarithms into a single logarithm, simplifying the evaluation process.

### Example 3: Using the Quotient and Power Properties

Simplify and evaluate the expression $\log_3(81) - 2\,\log_3(3)$.

Step 1. Express $81$ as a power of $3$. Since $81 = 3^4$, use the power property:

$$
\log_3(81) = \log_3(3^4) = 4.
$$

Step 2. Evaluate $\log_3(3)$ knowing that $3^1 = 3$, hence

$$
\log_3(3) = 1.
$$

Step 3. Substitute these values into the expression:

$$
4 - 2\,(1) = 4 - 2 = 2.
$$

This example demonstrates the combination of two logarithm properties to simplify and evaluate an expression. Verifying each step ensures that the logical flow from exponential form to logarithmic form remains clear.

### Real-World Application: Financial Growth

![Exponential growth graph using $P(t)=P_0\,e^{rt}$ and doubling time $T=\frac{\ln(2)}{r}$.](images/plot_1_06-03-lesson-introduction-to-logarithms-and-their-properties.md.png)

In financial calculations, logarithms are utilized to determine the time needed for an investment to grow exponentially. Consider the growth formula

$$
P(t) = P_0\,e^{rt},
$$

where $P_0$ is the initial investment, $r$ is the growth rate, and $t$ is time. To find the doubling time $T$, set $P(T) = 2P_0$:

$$
2P_0 = P_0\,e^{rT}.
$$

Dividing both sides by $P_0$ gives

$$
2 = e^{rT}.
$$

Taking the natural logarithm of both sides yields

$$
\ln(2) = rT.
$$

Thus, the doubling time is

$$
T = \frac{\ln(2)}{r}.
$$

This example is especially valuable in finance because it shows how logarithms can directly solve for time in exponential growth scenarios, making it easier to plan investments or analyze economic trends.

### Summary

Understanding logarithms and their properties equips you with essential tools to simplify expressions and solve equations involving exponential forms. These skills are not only fundamental in algebra but are also widely applicable in engineering, computer science, and various fields that depend on exponential growth and decay models.

By mastering these concepts, you build a strong foundation for advanced mathematical problem-solving, an important step in preparing for the College Algebra CLEP exam.