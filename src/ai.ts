import { Message, AIProvider, SendMessageOptions, Source } from "./types";
import { sendMessageToGemini } from "./gemini";
import { sendMessageToOpenAI } from "./openai";

export async function sendMessage(
  provider: AIProvider,
  message: string,
  conversationHistory: Message[],
  screenshotBase64?: string,
  abortSignal?: AbortSignal,
  options: SendMessageOptions = {}
): Promise<{ text: string; sources?: Source[] }> {
  if (provider === 'openai') {
    return sendMessageToOpenAI(message, conversationHistory, screenshotBase64, abortSignal, options);
  } else {
    return sendMessageToGemini(message, conversationHistory, screenshotBase64, abortSignal, options);
  }
}
