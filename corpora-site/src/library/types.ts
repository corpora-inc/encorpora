export type Source = { title: string; url: string };
export type ProductShot = "practice" | "progress" | "practice-profile" | "workbook-controls";
export type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
  example?: { title: string; text: string };
  diagram?: "loop" | "review" | "strands" | "discovery" | "estimate";
  sources?: Source[];
  shot?: ProductShot;
};
export type Article = {
  path: string;
  label: string;
  title: string;
  description: string;
  introduction: string;
  sections: Section[];
  related: string[];
  sample?: number;
  image?: { src: string; alt: string; caption: string; width: number; height: number };
  questions?: { question: string; answer: string }[];
};
