export type Source = { title: string; url: string };
export type ProductShot = "practice" | "progress" | "practice-profile" | "workbook-controls";
export type ArticleImage = { src: string; alt: string; caption: string; width: number; height: number };
export type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
  example?: { title: string; text: string };
  diagram?: "loop" | "review" | "strands" | "discovery" | "estimate";
  sources?: Source[];
  shot?: ProductShot;
  images?: ArticleImage[];
  links?: { href: string; label: string }[];
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
  image?: ArticleImage;
  questions?: { question: string; answer: string }[];
};
