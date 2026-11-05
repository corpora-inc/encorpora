// Page eyebrows and headings, shared by the rendered pages and their social
// cards so a shared link always previews the heading the reader will see.
export const pageCopy = {
  "/": { label: "AMP Mathematics", heading: "Math practice", emphasis: "that adapts." },
  "/amp/": { label: "AMP Mathematics", heading: "Practice with a reason for every step." },
  "/esa/": { label: "Education funds", heading: "Explore education funding and savings." },
  "/parents/": { label: "For parents", heading: "Know what you’re choosing." },
  "/schools/": { label: "Schools · Districts · Private schools", heading: "Review AMP for your school." },
  "/support/": { label: "Corpora support", heading: "Get help with AMP." },
  "/try/": { label: "Try AMP", heading: "Start with free practice." },
  "/samples/": { label: "AMP · Printable sample", heading: "Three problems. Space to think." },
} as const satisfies Record<string, { label: string; heading: string; emphasis?: string }>;
export type CopyRoute = keyof typeof pageCopy;
