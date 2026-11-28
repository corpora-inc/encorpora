/** What the bundler gives these pages (vite), declared here so the kit type-checks without vite's types on its path. */
interface ImportMeta {
  readonly env: { readonly BASE_URL: string };
}
declare module "*.css";
