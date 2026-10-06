import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import { isStacked, texToReact } from "../activity/render/Tex";

const isMath = (className?: string) => /\blanguage-math\b/.test(className ?? "");
const mathText = (children: React.ReactNode) => React.Children.toArray(children).join("");

/** Generated prose has no links, images, HTML, event handlers or IPC surfaces. */
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="math-prose">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath]}
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
        components={{
          // remark-math emits <code class="language-math math-inline"> and <pre><code class="… math-display">.
          // Math is typeset by the activity renderer's KaTeX path (CSP-safe, same command denylist).
          code: ({ className, children: code }) => {
            if (!isMath(className)) return <code>{code}</code>;
            const tex = mathText(code), display = /\bmath-display\b/.test(className!);
            return <span className={display ? "math-display" : `math-inline${isStacked(tex) ? " is-stacked" : ""}`}>{texToReact(tex, display)}</span>;
          },
          pre: ({ children: block }) => {
            const only = React.Children.toArray(block);
            const child = only.length === 1 && React.isValidElement<{ className?: string }>(only[0]) ? only[0] : null;
            return child && isMath(child.props.className) ? <div className="math-block">{block}</div> : <pre>{block}</pre>;
          },
        }}
      >
        {children.slice(0, 12000)}
      </ReactMarkdown>
    </div>
  );
}
