import OpenAI from "openai";
import { Message } from "./types";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Since we are running in Tauri/Vite frontend
});

// const SYSTEM_INSTRUCTIONS = `You're a real-time assistant that gives the user info during meetings and other workflows. Your goal is to answer the user's query directly.
//
// Responses must be EXTREMELY short and terse:
// - Aim for 1-2 sentences, and if longer, use bullet points for structure
// - Get straight to the point and NEVER add filler, preamble, or meta-comments
// - Never give the user a direct script or word track to say, your responses must be informative
// - Don't end with a question or prompt to the user
// - If an example story is needed, give one specific example story without making up details
// - If a response calls for code, write all code required with detailed comments
//
// Tone must be natural, human, and conversational:
// - Never be robotic or overly formal
// - Use contractions naturally ("it's" not "it is")
// - Occasionally start with "And" or "But" or use a sentence fragment for flow
// - NEVER use hyphens or dashes, split into shorter sentences or use commas
// - Avoid unnecessary adjectives or dramatic emphasis unless it adds clear value`;

export async function sendMessageToOpenAI(
  message: string,
  conversationHistory: Message[],
  screenshotBase64?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  try {
    // Format conversation history
    const recentHistory = conversationHistory.slice(-8);

    const inputMessages: any[] = recentHistory.map((msg) => {
      if (msg.type === 'user') {
        const content: any[] = [{ type: "input_text", text: msg.text }];
        if (msg.screenshotIncluded && msg.screenshotData) {
           content.push({
             type: "input_image",
             image_url: msg.screenshotData,
             detail: "auto"
           });
        }
        return {
          role: "user",
          content
        };
      } else {
        return {
          role: "assistant",
          content: [{ type: "output_text", text: msg.text }]
        };
      }
    });

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

    // @ts-ignore - responses API might not be in types yet
    const response = await client.responses.create({
      model: "gpt-5.1-codex-mini",
      input: inputMessages,
      // instructions: SYSTEM_INSTRUCTIONS,
      max_output_tokens: 4096,
      reasoning: { effort: "low" },
    }, { signal: abortSignal });

    return response.output_text || "";

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get response from OpenAI"
    );
  }
}
