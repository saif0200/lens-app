import type { Source } from "../types";

interface SourceChipProps {
  source: Source;
}

export function SourceChip({ source }: SourceChipProps) {
  try {
    const urlObj = new URL(source.url);
    const hostname = urlObj.hostname.replace('www.', '');

    const isProxy = hostname.includes('vertexaisearch') || hostname.includes('googleusercontent');

    let displayTitle = source.title;
    let isTitleUrl = false;
    try {
      if (displayTitle.startsWith('http://') || displayTitle.startsWith('https://')) {
        isTitleUrl = true;
      }
    } catch {}

    if (isTitleUrl) {
      try {
        const titleUrlObj = new URL(displayTitle);
        const path = titleUrlObj.pathname;
        if (path && path !== '/' && path.length > 1) {
          const segments = path.split('/').filter(Boolean);
          if (segments.length > 0) {
            displayTitle = segments[segments.length - 1];
            displayTitle = decodeURIComponent(displayTitle).replace(/[-_]/g, ' ');
          } else {
            displayTitle = '';
          }
        } else {
          displayTitle = '';
        }
      } catch {
        displayTitle = '';
      }
    }

    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="source-chip"
      >
        {!isProxy && <span className="source-domain">{hostname}</span>}
        {displayTitle && displayTitle !== hostname && (
          <>
            {!isProxy && <span className="source-divider">-</span>}
            <span className="source-title">{displayTitle}</span>
          </>
        )}
        {isProxy && !displayTitle && <span className="source-title">Source</span>}
      </a>
    );
  } catch {
    return null;
  }
}

interface SourcesContainerProps {
  sources: Source[];
}

export function SourcesContainer({ sources }: SourcesContainerProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-container">
      {sources.map((source, index) => (
        <SourceChip key={index} source={source} />
      ))}
    </div>
  );
}
