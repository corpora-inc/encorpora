**STRUCTURE.md**

Each filename fully determines the structure and content. The AI must strictly follow the format without deviation. All files should be detailed and comprehensive.

**Filename Convention:**

`XX-00-00-unit-intro-unit-title.md`
`XX-YY-00-chapter-intro-chapter-title.md`
`XX-YY-ZZ-section-detailed-topic-title.md`

**Interpretation Rules:**

- **Unit Introduction (`XX-00-00`)**
  - Starts with `# Unit Title`
  - A comprehensive introduction to the unit, providing a broad historical overview. No subheaders.

- **Chapter Introduction (`XX-YY-00`)**
  - Starts with `## Chapter Title`
  - A detailed introduction summarizing key themes in the chapter. No subheaders.

- **Detailed Section (`XX-YY-ZZ`)**
  - Starts with `### Section Title`
  - A long, fully developed, fact-filled historical section with as many structured subheaders (`####`, `#####`, etc.) as needed.

The file returned should comprehensively achieve the purpose: unit intro, chapter intro, or comprehensive section. The examples below illustrate the structure.

**Examples:**

Filename: `03-00-00-unit-intro-ancient-civilizations.md`
Generated Content:
```md
# Ancient Civilizations

Comprehensive Unit Introduction with NO SUBHEADERS.
```

Filename: `03-02-00-chapter-intro-ancient-rome.md`
Generated Content:
```md
## Ancient Rome

Comprehensive Chapter Introduction with NO SUBHEADERS
```

Filename: `03-02-01-section-the-roman-republic-and-the-senate.md`
Generated Content:
```md
### The Roman Republic and the Senate
Comprehensive Section with full content and structured subheaders.

#### The Structure of the Senate
The Senate was originally an advisory body but gained legislative authority over time...

#### Power Struggles in the Republic
Over time, tensions between patricians and plebeians led to political reforms and upheavals...

[Extensive, detailed content follows.]
```

The filename defines the content structure precisely.
