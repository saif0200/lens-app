import type { HTMLAttributes } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useClipboard } from "../hooks/useClipboard";

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  node?: unknown;
};

const languageDisplayNames: Record<string, string> = {
  js: "JavaScript",
  jsx: "JavaScript (JSX)",
  ts: "TypeScript",
  tsx: "TypeScript (TSX)",
  py: "Python",
  rb: "Ruby",
  cpp: "C++",
  cs: "C#",
  sh: "Shell",
  bash: "Bash",
  yml: "YAML",
  yaml: "YAML",
  json: "JSON",
  md: "Markdown",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  text: "Plain Text",
};

export function CodeBlock({
  inline,
  className,
  children,
  node,
  ...props
}: MarkdownCodeProps) {
  void node;
  const { copiedId: copiedCodeBlockId, copy: copyCodeBlock } = useClipboard<string>();

  const childText = Array.isArray(children)
    ? children
        .map((child) => (typeof child === "string" ? child : ""))
        .join("")
    : typeof children === "string"
      ? children
      : "";

  const isInline = inline ?? !/\r|\n/.test(childText);

  if (isInline) {
    const combinedClassName = ["ai-code-inline", className]
      .filter(Boolean)
      .join(" ");
    return (
      <code className={combinedClassName} {...props}>
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  const languageDisplay = languageDisplayNames[language.toLowerCase()]
    || language.charAt(0).toUpperCase() + language.slice(1);

  const blockId = `code-${childText.length}-${childText.substring(0, 20).replace(/\s/g, '')}`;

  return (
    <div className="ai-code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language-tag">{languageDisplay}</span>
        <button
          type="button"
          className="code-copy-button"
          onClick={() => {
            void copyCodeBlock(blockId, childText);
          }}
          aria-label="Copy code"
        >
          {copiedCodeBlockId === blockId ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <polyline
                  points="3,8 6,11 13,4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span className="code-copy-label">Copied</span>
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  ry="2"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span className="code-copy-label">Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="ai-code-block">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
          codeTagProps={{
            style: {
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
            }
          }}
        >
          {childText}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
