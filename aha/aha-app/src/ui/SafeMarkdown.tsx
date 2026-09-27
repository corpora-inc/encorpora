import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** Generated prose has no links, images, HTML, event handlers or IPC surfaces. */
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="math-prose">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              trust: false,
              strict: "error",
              throwOnError: false,
              maxExpand: 100,
              maxSize: 10,
            },
          ],
        ]}
        disallowedElements={[
          "a",
          "img",
          "iframe",
          "script",
          "style",
          "video",
          "audio",
          "form",
          "input",
        ]}
        unwrapDisallowed
        components={{ code: ({ children: code }) => <code>{code}</code> }}
      >
        {children.slice(0, 12000)}
      </ReactMarkdown>
    </div>
  );
}
