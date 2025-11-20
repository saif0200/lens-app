import { GoogleGenAI } from "@google/genai";
import { Message } from "./types";

// System instructions for the AI assistant
const SYSTEM_INSTRUCTIONS = `You're a real-time assistant that gives the user info during meetings and other workflows. Your goal is to answer the user's query directly.

Responses must be EXTREMELY short and terse:
- Aim for 1-2 sentences, and if longer, use bullet points for structure
- Get straight to the point and NEVER add filler, preamble, or meta-comments
- Never give the user a direct script or word track to say, your responses must be informative
- Don't end with a question or prompt to the user
- If an example story is needed, give one specific example story without making up details
- If a response calls for code, write all code required with detailed comments

Tone must be natural, human, and conversational:
- Never be robotic or overly formal
- Use contractions naturally ("it's" not "it is")
- Occasionally start with "And" or "But" or use a sentence fragment for flow
- NEVER use hyphens or dashes, split into shorter sentences or use commas
- Avoid unnecessary adjectives or dramatic emphasis unless it adds clear value`;

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GOOGLE_GENAI_API_KEY,
});

/**
 * Sends a message to Gemini and returns the complete response
 * @param message - The user's message
 * @param conversationHistory - Array of previous messages (last 4-8 messages recommended)
 * @param screenshotBase64 - Optional base64-encoded PNG screenshot to share with Gemini
 * @param abortSignal - Optional abort signal to cancel the request
 * @returns Promise that resolves with the complete response text
 */
export async function sendMessageToGemini(
  message: string,
  conversationHistory: Message[],
  screenshotBase64?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  try {
    // Format conversation history for Gemini API
    // Take only the last 4-8 messages for context (as per user requirement)
    const recentHistory = conversationHistory.slice(-8);

    const userParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: message }];

    if (screenshotBase64) {
      userParts.push({
        inlineData: {
          mimeType: "image/png",
          data: screenshotBase64,
        },
      });
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

    // Generate complete response
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        abortSignal,
      },
    });

    // Return the complete response text
    return response.text || "";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get response from Gemini"
    );
  }
}
