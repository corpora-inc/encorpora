import  type { Book } from 'epubjs';

/**
 * Defines the structure of a single search result.
 */
export type SearchResult = {
  cfi: string;
  excerpt: string;
};

/**
 * Searches for a query within an epubjs Book object.
 * It iterates through each section of the book, performs the search,
 * and generates an excerpt for each match.
 *
 * @param book The epubjs Book object to search within.
 * @param query The string to search for.
 * @param contextLength The number of characters to include before and after the match in the excerpt.
 * @returns A promise that resolves to an array of search results.
 */
export const searchInBook = async (
  book: Book,
  query: string,
  contextLength: number = 15
): Promise<SearchResult[]> => {
  if (!query) {
    return [];
  }

  await book.ready;
  const results: SearchResult[] = [];
  const promises: Promise<void>[] = [];

  // Filter out table of contents, navigation items, and front matter
  const contentItems: any[] = [];
  book.spine.each((item: any) => {
    // Exclude common TOC, navigation, and front matter file patterns
    const href = item.href.toLowerCase();
    if (!href.includes('toc') && 
        !href.includes('nav') && 
        !href.includes('contents') &&
        !href.includes('navigation') &&
        !href.includes('cover') &&
        !href.includes('title') &&
        !href.includes('copyright') &&
        !href.includes('dedication') &&
        !href.includes('foreword') &&
        !href.includes('preface') &&
        !href.includes('acknowledgment') &&
        !href.includes('front') &&
        !href.includes('frontmatter') &&
        item.linear !== 'no') {
      contentItems.push(item);
    }
  });

  contentItems.forEach((item: any) => {
    const promise = (async () => {
      try {
        await item.load(book.load.bind(book));
        const doc = item.document;
        const textNodes: Node[] = [];

        const treeWalker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let node;
        while ((node = treeWalker.nextNode())) {
          textNodes.push(node);
        }

        const fullText = textNodes
          .map((n) => n.textContent)
          .join("")
          .toLowerCase();
        const searchQuery = query.toLowerCase();
        let pos = fullText.indexOf(searchQuery);

        // Find all occurrences of the search query in the chapter
        while (pos !== -1) {
          let nodeIndex = 0;
          let foundOffset = pos;

          // Find the specific text node that contains the start of the match
          while (nodeIndex < textNodes.length) {
            const nodeText = textNodes[nodeIndex].textContent || "";
            if (foundOffset < nodeText.length) break;
            foundOffset -= nodeText.length;
            nodeIndex++;
          }

          if (nodeIndex < textNodes.length) {
            const range = doc.createRange();
            try {
              range.setStart(textNodes[nodeIndex], foundOffset);
              range.setEnd(
                textNodes[nodeIndex],
                foundOffset + searchQuery.length
              );

              // Generate the CFI and a text excerpt for the result
              const cfi = item.cfiFromRange(range);
              const excerpt = fullText.substring(
                Math.max(0, pos - contextLength),
                pos + searchQuery.length + contextLength
              );

              results.push({ cfi, excerpt: `...${excerpt}...` });
            } catch (e) {
              console.warn("Skipping invalid range:", e);
            }
          }

          pos = fullText.indexOf(searchQuery, pos + 1);
        }

        item.unload();
      } catch (error) {
        console.error("Error searching chapter:", error);
      }
    })();
    promises.push(promise);
  });

  // Wait for all chapters to be searched
  await Promise.all(promises);
  return results;
};