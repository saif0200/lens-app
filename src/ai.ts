import { Message, AIProvider, SendMessageOptions, Source, AttachmentData } from "./types";
import { sendMessageToGemini } from "./gemini";
import { sendMessageToOpenAI } from "./openai";

export async function sendMessage(
  provider: AIProvider,
  message: string,
  conversationHistory: Message[],
  attachments?: AttachmentData[],
  abortSignal?: AbortSignal,
  options: SendMessageOptions = {}
): Promise<{ text: string; sources?: Source[]; thought?: string; thoughtDuration?: number }> {
  if (provider === 'openai') {
    return sendMessageToOpenAI(message, conversationHistory, attachments, abortSignal, options);
  } else {
    return sendMessageToGemini(message, conversationHistory, attachments, abortSignal, options);
  }
}
