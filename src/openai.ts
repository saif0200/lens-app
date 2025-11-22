import OpenAI from "openai";
import { Message, SendMessageOptions, Source } from "./types";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Since we are running in Tauri/Vite frontend
});



export async function sendMessageToOpenAI(
  message: string,
  conversationHistory: Message[],
  screenshotBase64?: string,
  abortSignal?: AbortSignal,
  options: SendMessageOptions = {}
): Promise<{ text: string; sources?: Source[] }> {
  try {
    const { reasoningEffort = 'low', webSearchEnabled = false } = options;
    const history = conversationHistory.filter((msg) => msg.type !== 'typing');
    const historySummary = summarizeHistory(history);

    const inputMessages: any[] = [];
    if (historySummary) {
      inputMessages.push({
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Conversation recap: ${historySummary}`,
          },
        ],
      });
    }

    // Add current message
    const currentContent: any[] = [{ type: "input_text", text: message }];
    if (screenshotBase64) {
      currentContent.push({
        type: "input_image",
        image_url: `data:image/png;base64,${screenshotBase64}`,
        detail: "auto"
      });
    }

    inputMessages.push({
      role: "user",
      content: currentContent
    });

    const tools: any[] = [];
    if (webSearchEnabled) {
      tools.push({ type: "web_search_preview" });
    }

    // @ts-ignore - responses API might not be in types yet
    const response = await client.responses.create({
      model: "gpt-5.1-codex-mini",
      input: inputMessages,
      max_output_tokens: 4096,
      reasoning: { effort: reasoningEffort },
      tools: tools.length > 0 ? tools : undefined,
    }, { signal: abortSignal });

    return extractOpenAIResponse(response);

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get response from OpenAI"
    );
  }
}

function extractOpenAIResponse(response: any): { text: string; sources?: Source[] } {
  let text = "";
  const sources: Source[] = [];

  const primary = response?.output_text?.trim();
  if (primary) {
    text = primary;
  } else {
    const fallback: string[] = [];
    const outputs = Array.isArray(response?.output) ? response.output : [];

    for (const item of outputs) {
      if (!item) continue;

      // Check for tool calls (web search)
      if (item.type === "tool_call" && item.tool_call?.type === "web_search_preview") {
        // Try to extract sources from tool output if available
        // Note: The exact structure of web_search_preview output in responses API is not fully documented
        // but we can try to find it in the tool_call object or subsequent tool_output
        // For now, we'll look for a 'citations' or 'results' field in the tool_call
        const searchData = item.tool_call;
        // This is a best-effort extraction based on common patterns
        if (searchData.citations && Array.isArray(searchData.citations)) {
           for (const citation of searchData.citations) {
             if (citation.url && citation.title) {
               sources.push({ title: citation.title, url: citation.url });
             }
           }
        }
      }

      if (item.type !== "message" || !Array.isArray(item.content)) {
        continue;
      }

      for (const content of item.content) {
        if (!content) {
          continue;
        }

        let contentText: string | undefined;

        if (content.type === "output_text" || content.type === "reasoning_text") {
          contentText = content.text;
        } else if (content.type === "refusal") {
          contentText = content.refusal;
        }

        if (contentText) {
          const trimmed = contentText.trim();
          if (trimmed) {
            fallback.push(trimmed);
          }
        }
      }
    }
    text = fallback.join("\n\n").trim();
  }

  // Fallback: Extract markdown links from text
  // This ensures that if the model cites sources in the text (e.g. [Title](url)),
  // they also appear as source chips even if the tool output extraction failed.
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    const [_, title, url] = match;
    // Avoid duplicates
    if (!sources.some(s => s.url === url)) {
      sources.push({ title, url });
    }
  }

  return { text, sources: sources.length > 0 ? sources : undefined };
}

const HISTORY_SUMMARY_MAX_LENGTH = 600;

function summarizeHistory(history: Message[]): string {
  const recent = history.slice(-6);
  const lines: string[] = [];

  for (const msg of recent) {
    const label = msg.type === "user" ? "User" : "AI";
    const baseText = msg.text.replace(/\n+/g, " ").trim();
    if (!baseText) continue;

    const suffix = msg.screenshotIncluded ? " (shared screen)" : "";
    lines.push(`${label}: ${baseText}${suffix}`);
  }

  let summary = lines.join(" | ");
  if (summary.length > HISTORY_SUMMARY_MAX_LENGTH) {
    summary = summary.slice(summary.length - HISTORY_SUMMARY_MAX_LENGTH);
  }

  return summary;
}
