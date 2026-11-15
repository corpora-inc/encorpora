import { philosophyArticles } from "./philosophy.js";
import { productArticles } from "./product-articles.js";
import type { Article } from "./types.js";

export const articles: Article[] = [...philosophyArticles, ...productArticles];
export const articleByPath = new Map(articles.map((article) => [article.path, article]));
if (articleByPath.size !== articles.length) throw new Error("Duplicate public article path");
export const libraryRoutes = articles.map((article) => article.path);
