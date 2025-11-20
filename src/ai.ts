import { Message, AIProvider } from "./types";
import { sendMessageToGemini } from "./gemini";
import { sendMessageToOpenAI } from "./openai";

export async function sendMessage(
  provider: AIProvider,
  message: string,
  conversationHistory: Message[],
  screenshotBase64?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  if (provider === 'openai') {
    return sendMessageToOpenAI(message, conversationHistory, screenshotBase64, abortSignal);
  } else {
    return sendMessageToGemini(message, conversationHistory, screenshotBase64, abortSignal);
  }
}
