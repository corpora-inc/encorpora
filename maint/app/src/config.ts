import { brand } from "./brands/index.ts";

/**
 * The product, from the brand this build was made for (VITE_BRAND). The name
 * lives here and only here; every screen reads it from this constant.
 */
export const BRAND = brand(import.meta.env.VITE_BRAND as string | undefined);

export const PRODUCT = Object.freeze({
  name: BRAND.name,
  bundleId: BRAND.bundleId,
  publisher: BRAND.publisher,
  namespace: BRAND.namespace,
});
