# Book Structure Guide for LLM

## Purpose
This document defines the structure of book content files based on their filenames, ensuring that the LLM generates text with the appropriate level of granularity. The filename dictates the section level, controlling headers and content scope.

## File Naming Convention
Each file follows this format:

```
XX-YY-ZZ-title.md
```
Where:
- `XX` represents the top-level section.
- `YY` represents a subsection.
- `ZZ` represents a detailed lesson (if applicable).

## Content Generation Rules

### **XX-00-00-title.md**
- Uses `#` (H1) as the only header.
- Provides an **introduction** to the section with a paragraph or a few.
- Can include **blockquotes** or other engaging elements.
- **No additional headers** should be used.

**Example:**

```
# Introduction to Algebra

Algebra is the foundation of modern mathematics...

> “Mathematics is the language with which God wrote the universe.” – Galileo
```

### **XX-YY-00-title.md**
- Uses `##` (H2) as the only header.
- Introduces a **subsection** with an overview or key concepts.
- Can include text, examples, or figures.
- **No additional headers affecting TOC.**

**Example:**

```
## Solving Linear Equations

Linear equations are a fundamental part of algebra...
```

### **XX-YY-ZZ-title.md** (where ZZ ≠ 00)
- Uses `###` (H3) as the **main header**.
- Provides a **complete lesson**, expanding on the topic.
- Can use **further subheaders** (`####`, `#####`, etc.) as needed.
- Includes structured explanations, examples, exercises, and details.

**Example:**

```
### Solving One-Variable Equations

#### Step 1: Isolating the Variable

To solve an equation, start by...
```

## Summary
- `XX-00-00`: **Introduction** – `#` only, no additional headers.
- `XX-YY-00`: **Subsection** – `##` only, no deeper headers.
- `XX-YY-ZZ`: **Full Lesson** – `###` with subheaders as needed.

This ensures a structured flow, consistent table of contents, and logical book progression.