import { GoogleGenAI } from "@google/genai";
import { Message, SendMessageOptions, Source, AttachmentData } from "./types";

function getGeminiClient() {
  const apiKey = localStorage.getItem("gemini_api_key");
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
    const model = options.model || "models/gemini-2.5-flash";
    
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
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            url: chunk.web.uri
          });
        }
      }
    }

    // Process text with inline citations if grounding supports are present
    if (groundingMetadata?.groundingSupports && groundingChunks) {
      text = addCitationsToText(text, groundingMetadata);
    } else if (sources.length === 0) {
      // Fallback: Extract markdown links from text if no grounding metadata found
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

/**
 * Adds inline citations to the text based on grounding metadata
 * Follows the pattern recommended in Gemini API documentation
 */
function addCitationsToText(text: string, groundingMetadata: any): string {
  const supports = groundingMetadata.groundingSupports;
  const chunks = groundingMetadata.groundingChunks;

  if (!supports || !chunks || !Array.isArray(supports) || !Array.isArray(chunks)) {
    return text;
  }

  // Sort supports by end index in descending order to avoid shifting issues
  const sortedSupports = [...supports].sort((a, b) => {
    const endA = a.segment?.endIndex ?? 0;
    const endB = b.segment?.endIndex ?? 0;
    return endB - endA;
  });

  let newText = text;

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    const chunkIndices = support.groundingChunkIndices;

    if (typeof endIndex !== 'number' || !chunkIndices || !Array.isArray(chunkIndices)) {
      continue;
    }

    // Create citation string like [1](url)
    const citationLinks: string[] = [];
    for (const index of chunkIndices) {
      if (index >= 0 && index < chunks.length) {
        const chunk = chunks[index];
        const uri = chunk.web?.uri;
        if (uri) {
          citationLinks.push(`[${index + 1}](${uri})`);
        }
      }
    }

    if (citationLinks.length > 0) {
      const citationString = " " + citationLinks.join(" ");
      // Insert at the correct position
      if (endIndex <= newText.length) {
        newText = newText.slice(0, endIndex) + citationString + newText.slice(endIndex);
      }
    }
  }

  return newText;
}
