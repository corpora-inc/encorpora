This document describes how to structure the markdown files for each hexagram and its changing lines. Each hexagram is split into **one main file** and **six changing-line files**. The main file includes the binary notation in its filename; the changing-line files do not.

## Main Hexagram File

**Filename Format**
```
NN-00-hexagram-XX-pinyin-english-bbbbbb.md
```
- **NN**: Two-digit identifier for the hexagram (e.g., `64`).
- **XX**: Repeats the hexagram number and short descriptor (e.g., `64-wei-ji-before-completion`).
- **pinyin**: The romanized Chinese name (e.g., `wei-ji`).
- **english**: A brief English title (e.g., `before-completion`).
- **bbbbbb**: Six-digit binary for the lines, bottom line first, top line last.

**Content Requirements**
1. **Begin with a top-level header** (`#`). Example:
   ```
   # 64 - 未濟 (wei ji) Before Completion
   ```
2. Immediately after the header, include the LaTeX `\hexagram{...}` command for the lines:
   ```
   \hexagram{0}{1}{0}{1}{0}{1}
   ```
3. Provide the full Chinese text and multiple literal English translations for each of these layers:
   - **Zhou Yi** (core text)
   - **Ten Wings** (commentaries)
   - **Wang Bi** (commentary)
   - **Later Editorial Traditions** (Song dynasty onward)
4. Present a concise, focused discussion. Clarify key terms and context based on the traditional texts.

## Changing-Line Files

**Filename Format**
```
NN-01-hexagram-XX-changing-line-1.md
NN-02-hexagram-XX-changing-line-2.md
NN-03-hexagram-XX-changing-line-3.md
NN-04-hexagram-XX-changing-line-4.md
NN-05-hexagram-XX-changing-line-5.md
NN-06-hexagram-XX-changing-line-6.md
```
- Same **NN** and **XX** format as the main file, but **no** binary in the filename.
- The suffix `-01` through `-06` corresponds to each changing line (1 through 6).

**Content Requirements**
1. **Begin with a secondary header** (`##`). Example:
   ```
   ## Changing Line 1
   ```
2. Divide the file into four sections, each starting with a tertiary header (`###`):
   - **Zhou Yi** (core text)
   - **Ten Wings**
   - **Wang Bi**
   - **Later Editorial Traditions**
3. Provide the full Chinese text and multiple literal translations for that specific line, followed by a focused commentary in each section.
4. Do not include general overviews of the hexagram or references to other lines.

## Example: Hexagram 64 (wei ji – before completion) with binary `010101`

- **Main Hexagram File**
  ```
  64-00-hexagram-64-wei-ji-before-completion-010101.md
  ```
  ```markdown
  # 64 - 未濟 (wei ji) Before Completion

  \hexagram{0}{1}{0}{1}{0}{1}

  [Full Chinese text + multiple literal translations + commentary for:
   - Zhou Yi
   - Ten Wings
   - Wang Bi
   - Later Editorial Traditions
  ]
  ```

- **Changing-Line Files**
  ```
  64-01-hexagram-64-changing-line-1.md
  64-02-hexagram-64-changing-line-2.md
  64-03-hexagram-64-changing-line-3.md
  64-04-hexagram-64-changing-line-4.md
  64-05-hexagram-64-changing-line-5.md
  64-06-hexagram-64-changing-line-6.md
  ```
  Each begins with:
  ```markdown
  ## Changing Line X

  ### Zhou Yi
  [Full Chinese + literal translations + commentary]

  ### Ten Wings
  [Full Chinese + commentary]

  ### Wang Bi
  [Full Chinese + commentary]

  ### Later Editorial Traditions
  [Full Chinese + commentary]
  ```

Following this structure ensures each file remains narrowly focused and consistently organized for pandoc+LaTeX compilation.