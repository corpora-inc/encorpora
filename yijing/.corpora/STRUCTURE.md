**STRUCTURE.md**

We organize each hexagram into seven files: one main file for the hexagram itself (which includes a six-digit binary notation in its filename) and six files for the changing lines (which do not include binary). All files are named according to the following rules:

1. **Main Hexagram File (includes binary)**

   ```
   NN-00-hexagram-XX-pinyin-english-bbbbbb.md
   ```
   - **NN**: Two-digit identifier for the hexagram (e.g., `64` for Hexagram 64).
   - **XX**: The same hexagram number again, ensuring clarity (e.g., `64-wei-ji-before-completion`).
   - **pinyin**: The pinyin romanization of the Chinese name (e.g., `wei-ji`).
   - **english**: A short descriptive English title (e.g., `before-completion`).
   - **bbbbbb**: Six-digit binary representation of the hexagram's lines, **from the bottom line first to the top line last**.

   **Content Requirements:**
   - Begin with a top-level header (`#`), using this format:
     ```
     # NN - (Chinese Characters) (pinyin) (English Title)
     ```
     For instance:
     ```
     # 64 - 未濟 (wei ji) Before Completion
     ```
   - After the header, include the LaTeX command for the hexagram diagram, for example:
     ```
     \hexagram{0}{1}{0}{1}{0}{1}
     ```
   - Provide the full Chinese text and multiple literal English translations for:
     - Zhou Yi core text
     - Ten Wings commentaries
     - Wang Bi commentary
     - Later editorial traditions (Song dynasty onward)
   - Give a concise and detailed summary, focusing on clarifying key terms and context that follow directly from the traditional texts.

2. **Changing-Line Files (no binary in the filename)**

   ```
   NN-01-hexagram-XX-changing-line-1.md
   NN-02-hexagram-XX-changing-line-2.md
   NN-03-hexagram-XX-changing-line-3.md
   NN-04-hexagram-XX-changing-line-4.md
   NN-05-hexagram-XX-changing-line-5.md
   NN-06-hexagram-XX-changing-line-6.md
   ```
   **Content Requirements:**
   - Begin with a secondary header (`##`), for example:
     ```
     ## Changing Line 1
     ```
   - Divide the file into four sections, each starting with a tertiary header (`###`):
     1. **Zhou Yi** (core text)
     2. **Ten Wings**
     3. **Wang Bi**
     4. **Later Editorial Traditions**
   - Provide the full Chinese text and multiple literal English translations specifically for that changing line.
   - Focus on the line in question and explicate in as much detail as possible. Other files will have the general hexagram information and the other changing lines.

**Example**
For Hexagram 64 (wei ji – before completion) with binary `010101`:

- Main Hexagram File:
  ```
  64-00-hexagram-64-wei-ji-before-completion-010101.md
  ```
  Inside the file:
  ```markdown
  # 64 - 未濟 (wei ji) Before Completion

  \hexagram{0}{1}{0}{1}{0}{1}

  Full Chinese text + multiple literal translations for: Zhou Yi, Ten Wings, Wang Bi, Later Editorial Traditions
  ```

- Changing-Line Files:
  ```
  64-01-hexagram-64-changing-line-1.md
  64-02-hexagram-64-changing-line-2.md
  64-03-hexagram-64-changing-line-3.md
  64-04-hexagram-64-changing-line-4.md
  64-05-hexagram-64-changing-line-5.md
  64-06-hexagram-64-changing-line-6.md
  ```
  Each starts with:
  ```markdown
  ## Changing Line X

  ### Zhou Yi
  [Full Chinese text + literal translations]

  ### Ten Wings
  [Full Chinese text + commentary]

  ### Wang Bi
  [Full Chinese text + commentary]

  ### Later Editorial Traditions
  [Full Chinese text + commentary]
  ```

By following this naming convention and file structure, pandoc+LaTeX will generate a coherent Table of Contents, and each file remains narrowly focused on its specific scope: the main hexagram file for the entire hexagram and its layers, and each changing-line file for the single line's traditional texts and translations.
