import { GoogleGenAI } from "@google/genai";
import { Message, SendMessageOptions, Source, AttachmentData } from "./types";
import { storage } from "./services/storage";
import { extractMarkdownLinks, removeCitations, cleanUrl } from "./utils/responseProcessor";

const LENS_SYSTEM_INSTRUCTION = `<core_identity>
You are an assistant called Lens, developed by Lens. Your sole purpose is to analyze and solve problems asked by the user or shown on the screen with specific, accurate, and actionable responses.
</core_identity>

<global_rules>
- NEVER use meta-phrases (e.g., "let me help you", "I can see that").
- NEVER provide unsolicited advice.
- NEVER summarize unless explicitly requested.
- NEVER refer to "screenshot" or "image"; use "the screen".
- ALWAYS use markdown.
- ALWAYS acknowledge uncertainty when present.
- Be concise by default, detailed when required.
- If asked who or what powers you, respond exactly:
  "I am Lens powered by a collection of LLM providers"
  Do NOT mention specific providers or claim Lens is the AI.
</global_rules>

<conversation_handling>
- If the user is clearly engaging in conversation or follow-up dialogue, respond naturally and directly.
- Do NOT force unclear-intent mode during normal conversation.
- Ask clarifying questions ONLY when required to proceed.
</conversation_handling>

<math>
- Start with the answer if confident.
- Show step-by-step reasoning using LaTeX.
- Use LaTeX for all math.
- Escape dollar signs for currency (e.g., \\$100).
- End with **FINAL ANSWER**.
- Include a **DOUBLE-CHECK** section.
</math>

<technical>
- Coding problems: START WITH CODE. No intro text.
- EVERY line of code must have a comment on the line below it.
- No inline comments. No uncommented lines.
- Concepts: start with the direct answer.
- Follow with a detailed markdown explanation (e.g., complexity, walkthrough).
</technical>

<multiple_choice>
- Start with the correct answer.
- Explain why it’s correct.
- Explain why each other option is incorrect.
</multiple_choice>

<writing_tasks>
- If asked to generate an email, message, or response text:
  - Provide ONLY the drafted content in a code block.
  - Do NOT ask clarifying questions.
  - Draft a reasonable response.
</writing_tasks>

<ui_navigation>
- Provide extremely detailed step-by-step instructions.
- Specify:
  - Exact button/menu names (quoted)
  - Precise locations (e.g., "top-right corner")
  - Visual identifiers (icons, colors)
  - Result after each action
- Do NOT mention screenshots or offer further help.
</ui_navigation>

<unclear_intent>
Trigger ONLY if you are less than 90% confident what the user wants.

Format EXACTLY:
"I'm not sure what information you're looking for."
---
"My guess is that you might want [specific guess]."

Do NOT provide solutions or advice in this mode.
</unclear_intent>`;

function getGeminiClient() {
  const apiKey = storage.getGeminiKey() || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not found. Please set it in settings.");
  }
  return new GoogleGenAI({
    apiKey,
  });
}

/**
 * Sends a message to Gemini and returns the complete response
 * @param message - The user's message
 * @param conversationHistory - Array of previous messages (last 4-8 messages recommended)
 * @param attachments - Optional array of attachments (image/pdf) to share with Gemini
 * @param abortSignal - Optional abort signal to cancel the request
 * @param options - Optional settings for the request (thinking, web search)
 * @returns Promise that resolves with the complete response text and sources
 */
export async function sendMessageToGemini(
  message: string,
  conversationHistory: Message[],
  attachments?: AttachmentData[],
  abortSignal?: AbortSignal,
  options: SendMessageOptions = {}
): Promise<{ text: string; sources?: Source[]; thought?: string; thoughtDuration?: number }> {
  try {
    const ai = getGeminiClient();
    const { thinkingEnabled = false, webSearchEnabled = false } = options;

    // Format conversation history for Gemini API
    // Take only the last 4-8 messages for context (as per user requirement)
    const recentHistory = conversationHistory.slice(-8);

    const userParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: message }];

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.text) {
          // Send text files as text parts
          userParts.push({
            text: `\n\n--- Attachment: ${attachment.name || 'Untitled'} ---\n${attachment.text}\n-------------------\n`
          });
        } else {
          // Send binary files (images, PDFs) as inlineData
          userParts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.base64,
            },
          });
        }
      }
    }

    const contents = [
      // Add conversation history
      ...recentHistory.map((msg) => {
        const parts: any[] = [{ text: msg.text }];

        if (msg.type === 'user' && msg.screenshotIncluded && msg.screenshotData) {
          const match = msg.screenshotData.match(/^data:(.+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        }

        return {
          role: msg.type === 'user' ? 'user' : 'model',
          parts: parts,
        };
      }),
      // Add current message
      {
        role: "user" as const,
        parts: userParts,
      },
    ];

    // Determine model and tools
    const model = options.model || "gemini-flash-lite-latest";

    const tools: any[] = [];
    if (webSearchEnabled) {
      tools.push({ googleSearch: {} });
    }

    let thinkingConfig: any;

    // Configure thinking based on model family
    if (model.includes("gemini-3-pro")) {
      // Gemini 3 Pro: Uses thinkingLevel, cannot be disabled
      // Map reasoningEffort to thinkingLevel
      thinkingConfig = {
        thinkingLevel: options.reasoningEffort === 'low' ? "LOW" : "HIGH",
        includeThoughts: true
      };
    } else if (thinkingEnabled) {
      // Gemini 2.0 Flash / Flash-Lite: Uses thinkingBudget
      // Use a fixed budget of 2048 tokens when enabled to ensure it triggers
      thinkingConfig = {
        thinkingBudget: 2048,
        includeThoughts: true
      };
    } else {
      // If thinking is disabled, we don't send thinkingConfig
      thinkingConfig = undefined;
    }

    const startTime = Date.now();

    // Generate complete response
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: LENS_SYSTEM_INSTRUCTION,
        abortSignal,
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig,
      },
    });

    const endTime = Date.now();
    const thoughtDuration = Math.ceil((endTime - startTime) / 1000);

    // Extract sources from grounding metadata
    const sources: Source[] = [];
    const candidate = response.candidates?.[0];

    // Extract thought and text
    let thought = "";
    let text = "";

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        // Check for thought property (it's a boolean in the API response for thought parts)
        if ((part as any).thought) {
          thought += part.text || "";
        } else {
          text += part.text || "";
        }
      }
    }

    // If no parts were processed or text is empty, fallback to response.text
    if (!text && response.text) {
      text = response.text;
    }

    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks;

    if (groundingChunks && Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        const web = chunk.web;
        if (web) {
          // Prefer sourceUri if available, otherwise use uri
          let url = (web as any).sourceUri || web.uri;
          if (url) {
            url = cleanUrl(url);
          }

          if (url && web.title) {
            sources.push({
              title: web.title,
              url: url
            });
          }
        }
      }
    }

    // Fallback: Extract markdown links from text if no grounding metadata found
    if (sources.length === 0) {
      const linkSources = extractMarkdownLinks(text);
      for (const linkSource of linkSources) {
        const cleanedUrl = cleanUrl(linkSource.url);
        if (!sources.some(s => s.url === cleanedUrl)) {
          sources.push({ title: linkSource.title, url: cleanedUrl });
        }
      }
    }

    // Clean up response text using shared utility
    text = removeCitations(text);

    // Return the complete response text and sources
    return {
      text,
      sources: sources.length > 0 ? sources : undefined,
      thought: thought.length > 0 ? thought : undefined,
      thoughtDuration: thought.length > 0 ? thoughtDuration : undefined
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get response from Gemini"
    );
  }
}


