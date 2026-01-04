/**
 * Base path utilities for handling the ENCORPORA_BASE_PATH environment variable
 */

const basePath = process.env.NEXT_PUBLIC_ENCORPORA_BASE_PATH || "";

/**
 * Prepends the base path to a URL
 * @param path - The path to prepend the base path to
 * @returns The path with the base path prepended
 */
export function withBasePath(path: string): string {
  if (!path) return basePath;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path; // Don't modify absolute URLs
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
