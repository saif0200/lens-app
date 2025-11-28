import type { Source } from "../types";

/**
 * Extracts markdown links from text and returns them as Source objects
 */
export function extractMarkdownLinks(text: string): Source[] {
  const sources: Source[] = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    const [, title, url] = match;
    // Avoid duplicates
    if (!sources.some(s => s.url === url)) {
      sources.push({ title, url });
    }
  }

  return sources;
}

/**
 * Removes citation markers and cleans up response text
 */
export function cleanResponseText(text: string): string {
  // 1. Remove numeric citations [1](url) -> empty
  text = text.replace(/\[\d+\]\(https?:\/\/[^\)]+\)/g, "");

  // 2. Remove links wrapped in parentheses ([Title](url))
  text = text.replace(/[ \t]*\(\[([^\]]+)\]\((https?:\/\/[^\)]+)\)\)/g, "");

  // 3. Remove generic links [website](url)
  text = text.replace(/[ \t]*\[(website|source|link|page)\]\((https?:\/\/[^\)]+)\)/gi, "");

  // 4. Remove list items that are just generic links
  text = text.replace(/^\s*[\-\*1-9\.]+\s*\[(website|source|link|page)\]\((https?:\/\/[^\)]+)\)\s*$/gim, "");

  // 5. Remove "Sources:" header if it's at the end
  text = text.replace(/(Sources?|References?):\s*$/gi, "");

  // 6. Replace named links [Title](url) -> Title
  text = text.replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g, "$1");

  // 7. Remove standalone numeric citations like [1], [2]
  text = text.replace(/\[\d+\]/g, "");

  // 8. Remove OpenAI style source markers like 【11†source】
  text = text.replace(/【\d+†source】/g, "");

  // 9. Clean up any double spaces or trailing spaces left behind
  text = text.replace(/  +/g, " ").trim();

  return text;
}

/**
 * Simple citation removal (used by Gemini)
 */
export function removeCitations(text: string): string {
  // Remove numeric citations [1](url) -> empty
  text = text.replace(/\[\d+\]\(https?:\/\/[^\)]+\)/g, "");
  // Remove standalone numeric citations like [1], [2]
  text = text.replace(/\[\d+\]/g, "");
  // Clean up any double spaces
  text = text.replace(/  +/g, " ").trim();
  return text;
}

/**
 * Cleans Google Vertex AI Search URLs and extracts the actual destination URL
 */
export function cleanUrl(url: string): string {
  if (!url) return url;

  // Check if it's a Google Vertex AI Search URL or Google redirect
  if (url.includes('vertexaisearch.cloud.google.com') || url.includes('google.com/url')) {
    // 1. Try to extract from query parameters
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      const candidates = ['url', 'original_url', 'q', 'source_url', 'uri', 'redir'];
      for (const key of candidates) {
        const val = params.get(key);
        if (val && val.startsWith('http')) {
          return val;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try to find a nested URL in the string (decoded or raw)
    const match = url.match(/(https?:\/\/.+)/);
    if (match && match[1]) {
      const potentialUrl = match[1];
      if (potentialUrl !== url) {
         return potentialUrl;
      }

      const secondHttpIndex = url.indexOf('http', 4);
      if (secondHttpIndex !== -1) {
        return url.substring(secondHttpIndex);
      }
    }

    // 3. Try decoding and looking again
    try {
        const decoded = decodeURIComponent(url);
        if (decoded !== url) {
            const matchDecoded = decoded.match(/(https?:\/\/.+)/);
            if (matchDecoded && matchDecoded[1]) {
                 const potentialUrl = matchDecoded[1];
                 if (potentialUrl !== decoded) {
                     return potentialUrl;
                 }
                 const secondHttpIndex = decoded.indexOf('http', 4);
                 if (secondHttpIndex !== -1) {
                    return decoded.substring(secondHttpIndex);
                 }
            }
        }
    } catch {
        // ignore
    }
  }
  return url;
}
