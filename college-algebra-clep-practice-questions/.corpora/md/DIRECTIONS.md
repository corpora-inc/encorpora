# Markdown Generation Instructions for LLM

## **General Structure**
- Each file should begin with a **single H1 header (`#`)** matching the filename topic.
  - Use a concise, descriptive title for the H1 header. For example, `Polynomial Equations` or `Systems of Equations` you don't have to include "CLEP Practice Questions" in the header or over-specify the topic.
- **No subheaders** beyond the main title.
- The content consists **only of practice problems**—no solutions, no lessons, no explanations.
- The questions should match **the exact format of real CLEP College Algebra test questions**.
- Give a ton of practice problems—**the more, the better**. Make them varied and challenging.

## **Math Formatting (Critical)**
- **PREFER** display math:

$$
12 \div 4 = 3
$$

- **ALLOW** inline math like $x = y^2$
- **DO NOT** use `\(` `\)` or `\[` `\]`
- **Backticks** (e.g., `` `12 ÷ 4 = 3` ``) are acceptable only for non-LaTeX math notation.

### **Examples of Correct Math Formatting**

The quotient of $12 \div 4$ is $3$.

$$
12 \div 4 = 3
$$

`12 ÷ 4 = 3`

### **Examples of Incorrect Math Formatting**
```md
The quotient of \(12 \div 4\) is \(3\).
```
```md
\[
12 \div 4 = 3
\]
```

## **Content & Formatting Rules**
- **NO introductions, NO explanations, NO subheaders**—just questions.
- **Each file should only contain a list of CLEP-style practice problems.**
- **NO solutions provided within the files.**
- **Lists, bold, italics** can be used for clarity when formatting answer choices.
- **Blockquotes (`>`) may be used sparingly for test instructions.**

## **Output Consistency**
- Ensure uniform formatting across all files for seamless Pandoc → LaTeX conversion.
- Content should be **concise, structured, and formatted for test practice.**

## Output diversity
- **Vary the types of questions** (multiple choice, fill-in-the-blank, etc.).
- You will see some questions from the context that are in the other files. Try to **avoid duplication** as much as possible.
- DO NOT overuse "B" as the correct answer. **Mix up the correct answers**.

## **Strict Rules**
🚨 **STRICTLY FOLLOW THESE RULES:**
- **ONE HEADER (`#`) PER FILE – NO SUBHEADERS.**
- **NO extra text like 'Introduction to X'.**
- **NO explanations or solutions.**
- **PREFER DISPLAY MATH (`$$ ... $$`).**
- **STRICTLY USE `$` AND `$$` FOR MATH—NOTHING ELSE.**
