/**
 * Cleans AI response text for display
 * - Normalizes line endings
 * - Trims trailing whitespace from lines
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

  const tightenedPunctuation = trimmedLineEnds
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
