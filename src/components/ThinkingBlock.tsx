import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface ThinkingBlockProps {
  thought: string;
  thoughtDuration: number;
  isExpanded: boolean;
  onToggle: () => void;
  markdownComponents: Components;
}

export function ThinkingBlock({
  thought,
  thoughtDuration,
  isExpanded,
  onToggle,
  markdownComponents,
}: ThinkingBlockProps) {
  return (
    <div className="thought-container">
      <button className="thought-toggle" onClick={onToggle}>
        <span className="thought-label">
          Thought for {thoughtDuration || 0} seconds
        </span>
        <svg
          className={`thought-chevron ${isExpanded ? 'expanded' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={`thought-content-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <div className="thought-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {thought}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
