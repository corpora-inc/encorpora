**STRUCTURE.md**

Each hexagram is represented by exactly seven files, using the following naming convention:

```
NN-00-hexagram-XX-title.md
NN-01-hexagram-XX-changing-line-1.md
NN-02-hexagram-XX-changing-line-2.md
NN-03-hexagram-XX-changing-line-3.md
NN-04-hexagram-XX-changing-line-4.md
NN-05-hexagram-XX-changing-line-5.md
NN-06-hexagram-XX-changing-line-6.md
```

- **NN**: Two-digit identifier for the hexagram number (e.g., “01” for hexagram 1, “02” for hexagram 2, …, “64” for hexagram 64).
- **XX**: Also the hexagram number, ensuring clarity in the file name.
- In each file, the “00” file (e.g., `01-00-hexagram-01-qian-the-creative.md`) is the core text for the hexagram and must begin with a top-level header (`#`). This file includes the full traditional Chinese texts and multiple literal English translations for the following layers:
  - Zhou Yi core text
  - Ten Wings commentaries
  - Wang Bi’s commentary
  - Later editorial traditions (Song dynasty onward)
- The files labeled “01” through “06” (e.g., `01-01-hexagram-01-changing-line-1.md`, etc.) are dedicated to the individual changing lines. Each of these files must begin with a secondary header (`##`). Within these files, organize the content into four sections—one for each traditional layer (Zhou Yi, Ten Wings, Wang Bi, and later editorial traditions)—each section starting with a tertiary header (`###`).

**Example for Hexagram 1 (Qian – The Creative):**

```
01-00-hexagram-01-qian-the-creative.md   → begins with `#`
01-01-hexagram-01-changing-line-1.md       → begins with `##`
01-02-hexagram-01-changing-line-2.md       → begins with `##`
01-03-hexagram-01-changing-line-3.md       → begins with `##`
01-04-hexagram-01-changing-line-4.md       → begins with `##`
01-05-hexagram-01-changing-line-5.md       → begins with `##`
01-06-hexagram-01-changing-line-6.md       → begins with `##`
```

**Example for Hexagram 2 (Kun – The Receptive):**

```
02-00-hexagram-02-kun-the-receptive.md
02-01-hexagram-02-changing-line-1.md
02-02-hexagram-02-changing-line-2.md
02-03-hexagram-02-changing-line-3.md
02-04-hexagram-02-changing-line-4.md
02-05-hexagram-02-changing-line-5.md
02-06-hexagram-02-changing-line-6.md
```

This structure ensures consistency across the book and enables pandoc+LaTeX to automatically generate a precise Table of Contents. Each hexagram’s core file begins with a single top-level header (`#`), and every changing line file begins with a secondary header (`##`), with further subdivision into the four required traditional layers (each starting with `###`). This strict organization guarantees that every section is self-contained and deeply focused on its specific content.