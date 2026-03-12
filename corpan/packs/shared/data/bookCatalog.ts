import type { BookCatalogEntry } from "../core/types"

/**
 * Load the book catalog from the data server.
 * Returns available books with metadata and language info.
 */
export async function loadBookCatalog(baseUrl: string): Promise<BookCatalogEntry[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/data/catalog.json`
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Failed to load book catalog: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}
