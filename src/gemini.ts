import { GoogleGenAI } from "@google/genai";
import { Message, SendMessageOptions, Source, AttachmentData } from "./types";

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GOOGLE_GENAI_API_KEY,
});

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
): Promise<{ text: string; sources?: Source[] }> {
  try {
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
      ...recentHistory.map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })),
      // Add current message
      {
        role: "user" as const,
        parts: userParts,
      },
    ];

    // Determine model and tools
    const model = options.model || "models/gemini-flash-latest";
    
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
        includeThoughts: false 
      };
    } else {
      // Gemini 2.5 Flash / Flash-Lite: Uses thinkingBudget
      // -1 triggers dynamic thinking, 0 disables it
      thinkingConfig = {
        thinkingBudget: thinkingEnabled ? -1 : 0,
        includeThoughts: false
      };
    }

    // Generate complete response
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        abortSignal,
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig,
      },
    });

    // Extract sources from grounding metadata
    const sources: Source[] = [];
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks && Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            url: chunk.web.uri
          });
        }
      }
    }

    // Fallback: Extract markdown links from text if no grounding metadata found
    const text = response.text || "";
    if (sources.length === 0) {
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
      let match;
      while ((match = linkRegex.exec(text)) !== null) {
        const [_, title, url] = match;
        if (!sources.some(s => s.url === url)) {
          sources.push({ title, url });
        }
      }
    }

    // Return the complete response text and sources
    return {
      text,
      sources: sources.length > 0 ? sources : undefined
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
