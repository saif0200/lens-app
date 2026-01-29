/**
 * Cleans AI response text for display
 * - Normalizes line endings
 * - Trims trailing whitespace from lines
 * - Collapses single newlines to spaces (for flowing prose)
 * - Preserves paragraph breaks (double newlines), code blocks, lists, and headings
 * - Tightens punctuation spacing
 * - Escapes math delimiters for ReactMarkdown
 */
export function cleanAiText(text: string): string {
  if (!text) {
    return text;
  }

  const normalizedLineEndings = text.replace(/\r\n/g, "\n");
  const trimmedLineEnds = normalizedLineEndings
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // Collapse single newlines to spaces while preserving structure
  // Split by code blocks first to protect them
  const codeBlockPattern = /(```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = trimmedLineEnds.split(codeBlockPattern);

  const processed = parts.map((part, index) => {
    // Odd indices are code blocks (captured groups), preserve them
    if (index % 2 === 1) {
      return part;
    }

    // For non-code parts, collapse single newlines
    // First, protect double newlines by replacing with placeholder
    const withPlaceholder = part.replace(/\n\n+/g, '\n\n');

    // Split by double newlines to process each paragraph separately
    const paragraphs = withPlaceholder.split(/\n\n/);

    return paragraphs.map(para => {
      // Don't collapse newlines in:
      // - Lines starting with - or * or + (list items)
      // - Lines starting with # (headings)
      // - Lines starting with > (blockquotes)
      // - Lines starting with numbers followed by . (numbered lists)
      // - Lines that are entirely empty
      const lines = para.split('\n');
      const result: string[] = [];
      let accumulator = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isStructural = /^(\s*[-*+]|\s*\d+\.|\s*#|>|\s*$)/.test(line);

        if (isStructural) {
          // Flush accumulator if any
          if (accumulator) {
            result.push(accumulator.trim());
            accumulator = '';
          }
          result.push(line);
        } else {
          // Accumulate prose lines with spaces
          if (accumulator) {
            accumulator += ' ' + line;
          } else {
            accumulator = line;
          }
        }
      }

      // Flush remaining accumulator
      if (accumulator) {
        result.push(accumulator.trim());
      }

      return result.join('\n');
    }).join('\n\n');
  }).join('');

  const tightenedPunctuation = processed
    .replace(/([^\s])\s+([.,!?;:])/g, "$1$2")
    .replace(/([^\s])\s+([\)\]\}])/g, "$1$2");

  // Escape math delimiters so ReactMarkdown doesn't consume the backslashes
  const escapedMath = tightenedPunctuation
    .replace(/\\\(/g, "\\\\(")
    .replace(/\\\)/g, "\\\\)")
    .replace(/\\\[/g, "\\\\[")
    .replace(/\\\]/g, "\\\\]");

  return escapedMath.trim();
}
