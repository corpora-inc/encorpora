import Link from "next/link";

interface Segment {
  id: string;
  chapter: number;
  title?: string;
  paragraph_id: string;
  sentence_index: number;
  block_type: string;
  heading_level?: number;
  text: string;
  text_markdown?: string;
}

interface ChapterData {
  bookId: string;
  bookTitle: string;
  chapter: number;
  chapterTitle: string;
  segments: Segment[];
}

interface BookReaderProps {
  chapter: ChapterData;
  bookHref: string;
  bookTitle: string;
  seriesTitle: string;
  totalChapters: number;
  isRtl?: boolean;
}

type Block =
  | { kind: "heading"; level: number; text: string; key: string }
  | { kind: "paragraph"; sentences: string[]; key: string }
  | { kind: "hr"; key: string };

function groupBlocks(segments: Segment[]): Block[] {
  const blocks: Block[] = [];
  let currentParagraph: {
    id: string;
    sentences: string[];
    key: string;
  } | null = null;

  const flush = () => {
    if (currentParagraph) {
      blocks.push({
        kind: "paragraph",
        sentences: currentParagraph.sentences,
        key: currentParagraph.key,
      });
      currentParagraph = null;
    }
  };

  for (const seg of segments) {
    if (seg.block_type === "heading") {
      flush();
      blocks.push({
        kind: "heading",
        level: seg.heading_level || 2,
        text: seg.text,
        key: seg.id,
      });
      continue;
    }
    if (seg.block_type === "hr") {
      flush();
      blocks.push({ kind: "hr", key: seg.id });
      continue;
    }
    // Text / list_item / blockquote — group by paragraph_id
    const groupKey = `${seg.paragraph_id}:${seg.block_type}`;
    if (!currentParagraph || currentParagraph.id !== groupKey) {
      flush();
      currentParagraph = { id: groupKey, sentences: [], key: seg.id };
    }
    currentParagraph.sentences.push(seg.text);
  }
  flush();
  return blocks;
}

export function BookReader({
  chapter,
  bookHref,
  bookTitle,
  seriesTitle,
  totalChapters,
  isRtl = false,
}: BookReaderProps) {
  const blocks = groupBlocks(chapter.segments);
  // Skip rendering the first heading if it matches the chapter title — we render it separately.
  const firstIsTitleHeading =
    blocks[0]?.kind === "heading" &&
    blocks[0].text.trim() === chapter.chapterTitle.trim();
  const bodyBlocks = firstIsTitleHeading ? blocks.slice(1) : blocks;

  return (
    <div className="px-4 sm:px-6 py-12 sm:py-16">
      <article
        className="max-w-[65ch] mx-auto"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Back link */}
        <nav className="text-sm text-gray-500 mb-12" dir="ltr">
          <Link
            href={bookHref}
            className="hover:text-black transition-colors"
          >
            &larr; {bookTitle}
          </Link>
        </nav>

        {/* Chapter meta */}
        <div className="mb-8 text-xs uppercase tracking-wider font-medium text-gray-400" dir="ltr">
          {seriesTitle} · Preview · Chapter {chapter.chapter} of{" "}
          {totalChapters}
        </div>

        {/* Chapter title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-12">
          {chapter.chapterTitle}
        </h1>

        {/* Body */}
        <div
          className={`prose-like space-y-6 text-gray-800 ${
            isRtl ? "text-right" : ""
          }`}
          style={{
            fontSize: "1.125rem",
            lineHeight: 1.8,
          }}
        >
          {bodyBlocks.map((block) => {
            if (block.kind === "heading") {
              const Tag = (`h${Math.min(Math.max(block.level, 2), 4)}` as unknown) as
                | "h2"
                | "h3"
                | "h4";
              return (
                <Tag
                  key={block.key}
                  className="font-bold text-gray-900 tracking-tight mt-10 mb-4"
                  style={{
                    fontSize:
                      block.level <= 2
                        ? "1.75rem"
                        : block.level === 3
                        ? "1.375rem"
                        : "1.125rem",
                  }}
                >
                  {block.text}
                </Tag>
              );
            }
            if (block.kind === "hr") {
              return (
                <hr
                  key={block.key}
                  className="border-0 border-t border-gray-200 my-8"
                />
              );
            }
            return (
              <p key={block.key}>{block.sentences.join(" ")}</p>
            );
          })}
        </div>

        {/* Footer CTA */}
        <footer className="mt-20 pt-12 border-t border-gray-100" dir="ltr">
          <p className="text-gray-600 mb-6">
            This is a preview of Chapter {chapter.chapter}. The full book —
            with narrated audio in multiple languages — is available in the
            Corpan app.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={bookHref}
              className="inline-flex items-center px-5 py-2.5 bg-white text-gray-900 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-900 transition-colors"
            >
              Book details
            </Link>
            <a
              href="https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Download on iOS
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.corpora.corpan"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get it on Android
            </a>
          </div>
        </footer>
      </article>
    </div>
  );
}
