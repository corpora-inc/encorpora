## Understanding Complex Numbers and Basic Operations

Complex numbers extend the idea of the one-dimensional number line to the two-dimensional complex plane. A complex number is written in the form

$$
a + bi
$$

where $a$ is the real part, $b$ is the imaginary part, and $i$ is the imaginary unit with the property

$$
i^2 = -1.
$$

This lesson explains how to perform basic operations with complex numbers including addition, subtraction, multiplication, and division.

### Addition and Subtraction

When adding or subtracting complex numbers, combine the real parts and the imaginary parts separately.

For example, consider

$$
(3+4i) + (2-5i).
$$

Step 1: Group real and imaginary parts.

$$
(3+2) + (4i-5i).
$$

Step 2: Compute the groups:

$$
5 - i.
$$

Thus, the sum is $5-i$.

Similarly, for subtraction, evaluate

$$
(6+3i) - (4+5i).
$$

Step 1: Group real and imaginary parts.

$$
(6-4) + (3i-5i).
$$

Step 2: Compute the groups:

$$
2 - 2i.
$$

So, the result is $2-2i$.

### Multiplication

To multiply complex numbers, use the distributive property (FOIL method) and the rule $i^2=-1$.

Consider the product

$$
(1+2i)(3+4i).
$$

Step 1: Multiply using FOIL:

$$
1\cdot3 + 1\cdot4i + 2i\cdot3 + 2i\cdot4i.
$$

This gives

$$
3 + 4i + 6i + 8i^2.
$$

Step 2: Combine like terms and replace $i^2$ with $-1$:

$$
3 + (4i+6i) + 8(-1) = 3 + 10i - 8.
$$

Step 3: Simplify the real parts:

$$
-5 + 10i.
$$

Thus, the product is $-5+10i$.

### Division

Dividing complex numbers involves removing the imaginary part from the denominator. This is achieved by multiplying the numerator and denominator by the complex conjugate of the denominator.

The complex conjugate of a complex number $a+bi$ is $a-bi$.

For example, evaluate

$$
\frac{2+3i}{1-2i}.
$$

Step 1: Multiply the numerator and the denominator by the conjugate of the denominator.

$$
\frac{2+3i}{1-2i} \times \frac{1+2i}{1+2i}.
$$

Step 2: Multiply the numerator:

$$
(2+3i)(1+2i).
$$

Using FOIL:

$$
2\cdot1 + 2\cdot2i + 3i\cdot1 + 3i\cdot2i = 2 + 4i + 3i + 6i^2.
$$

Substitute $i^2=-1$:

$$
2 + 7i - 6 = -4 + 7i.
$$

Step 3: Multiply the denominator using the difference of squares formula:

$$
(1-2i)(1+2i)=1^2-(2i)^2=1-4i^2.
$$

Substitute $i^2=-1$:

$$
1-4(-1)=1+4=5.
$$

Step 4: Write the result as separate real and imaginary parts:

$$
\frac{-4+7i}{5} = -\frac{4}{5}+\frac{7}{5}i.
$$

Thus, the division gives the result $-\frac{4}{5}+\frac{7}{5}i$.

### Real-World Applications

Complex numbers play a significant role in applications such as electrical engineering and physics. For example:

- In electrical engineering, complex numbers represent alternating current (AC) circuits. The real part corresponds to resistance while the imaginary part corresponds to reactance. This helps in analyzing circuit behavior.

- In engineering mechanics, vibrations and oscillations are often modeled using complex numbers. They simplify the calculations and provide insight into systems that have both magnitude and phase.

Understanding these basic operations with complex numbers is essential for advanced topics such as complex functions, signal processing, and quantum mechanics.

Practice these operations to build a solid foundation for more advanced algebraic concepts.