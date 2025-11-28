import OpenAI from "openai";
import type {
  EasyInputMessage,
  ResponseInputContent,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputText,
} from "openai/resources/responses/responses";
import { Message, SendMessageOptions, Source, AttachmentData } from "./types";
import { storage } from "./services/storage";
import { extractMarkdownLinks, cleanResponseText } from "./utils/responseProcessor";

function getOpenAIClient() {
  const apiKey = storage.getOpenAIKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not found. Please set it in settings.");
  }
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });
}

type InputTextPart = ResponseInputText;
type InputImagePart = ResponseInputImage;
type InputFilePart = ResponseInputFile;
type InputContent = ResponseInputContent;
type ResponseInputMessage = EasyInputMessage;

const MAX_HISTORY_MESSAGES = 10;

// Editable default verbosity for Responses text outputs.
// Change this constant to adjust the verbosity without touching the UI.
const DEFAULT_OPENAI_VERBOSITY: 'low' | 'medium' | 'high' = 'medium';



export async function sendMessageToOpenAI(
  message: string,
  conversationHistory: Message[],
  attachments?: AttachmentData[],
  abortSignal?: AbortSignal,
  options: SendMessageOptions = {}
): Promise<{ text: string; sources?: Source[] }> {
  const client = getOpenAIClient();
  const uploadedFileIds: string[] = [];
  const fileUploadPromises = new Map<string, Promise<string>>();

  try {
    const {
      reasoningEffort = 'low',
      webSearchEnabled = false,
      model = "gpt-5.1-codex-mini",
      verbosity = DEFAULT_OPENAI_VERBOSITY,
    } = options;
    const history = conversationHistory.filter((msg) => msg.type !== 'typing');
    const inputMessages: ResponseInputMessage[] = buildConversationInputs(history);

    // Add current message
    const currentContent: InputContent[] = [createInputTextPart(message)];
    
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const mimeType = attachment.mimeType || 'application/octet-stream';
        if (mimeType.startsWith('image/')) {
          currentContent.push(createInputImagePart(attachment.base64, mimeType));
        } else if (attachment.text && attachment.text.trim().length > 0) {
          // Handle text-based attachments (code, txt, etc.)
          currentContent.push(
            createInputTextPart(
              `

--- Attachment: ${attachment.name || 'Untitled'} ---\n${attachment.text}\n-------------------\n`
            )
          );
        } else {
          const cacheKey = getAttachmentCacheKey(attachment);
          try {
            let fileIdPromise = fileUploadPromises.get(cacheKey);
            if (!fileIdPromise) {
              fileIdPromise = uploadAttachmentFile(client, attachment);
              fileUploadPromises.set(cacheKey, fileIdPromise);
            }
            const fileId = await fileIdPromise;
            uploadedFileIds.push(fileId);
            currentContent.push({
              type: "input_file",
              file_id: fileId
            });
          } catch (uploadError) {
            fileUploadPromises.delete(cacheKey);
            console.warn("Falling back to inline file data for attachment:", uploadError);
            const inlinePart = buildInlineFilePart(attachment);
            if (inlinePart) {
              currentContent.push(inlinePart);
            }
          }
        }
      }
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
    const textConfig = verbosity ? { verbosity } : undefined;

    const response = await client.responses.create({
      model,
      input: inputMessages,
      max_output_tokens: 4096,
      reasoning: { effort: reasoningEffort },
      text: textConfig,
      tools: tools.length > 0 ? tools : undefined,
      store: true,
    }, { signal: abortSignal });

    const parsedResponse = extractOpenAIResponse(response);

    console.info("[OpenAI] Response received", {
      model,
      reasoningEffort,
      webSearchEnabled,
      textPreview: parsedResponse.text.slice(0, 120),
      totalSources: parsedResponse.sources?.length ?? 0,
      hasOutput: parsedResponse.text.length > 0
    });

    return parsedResponse;

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to get response from OpenAI"
    );
  } finally {
    if (uploadedFileIds.length > 0) {
      await Promise.allSettled(
        uploadedFileIds.map(async (fileId) => {
          try {
            await client.files.delete(fileId);
          } catch (cleanupError) {
            console.warn("Failed to delete temporary file:", cleanupError);
          }
        })
      );
    }
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
        const searchData = item.tool_call;
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

  // Extract markdown links as sources using shared utility
  const linkSources = extractMarkdownLinks(text);
  for (const linkSource of linkSources) {
    if (!sources.some(s => s.url === linkSource.url)) {
      sources.push(linkSource);
    }
  }

  // Clean up response text using shared utility
  text = cleanResponseText(text);

  return { text, sources: sources.length > 0 ? sources : undefined };
}

function buildConversationInputs(history: Message[]): ResponseInputMessage[] {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  return recent
    .map((msg): ResponseInputMessage | undefined => {
      const text = msg.text?.trim();
      // Allow empty text if there is an image
      if (!text && !msg.screenshotIncluded) {
        return undefined;
      }
      
      const role: ResponseInputMessage["role"] = msg.type === 'user' ? 'user' : 'assistant';
      const content: any[] = [];
      
      if (text) {
        if (role === 'assistant') {
          content.push({ type: "output_text", text });
        } else {
          content.push(createInputTextPart(text));
        }
      }
      
      if (msg.type === 'user' && msg.screenshotIncluded && msg.screenshotData) {
         content.push({
            type: "input_image",
            detail: "auto",
            image_url: msg.screenshotData
         });
      }

      return {
        role,
        content,
        type: 'message',
      };
    })
    .filter((msg): msg is ResponseInputMessage => Boolean(msg));
}

function getAttachmentCacheKey(attachment: AttachmentData): string {
  if (attachment.id) {
    return attachment.id;
  }
  const prefix = attachment.name ?? 'file';
  const hashSegment = attachment.base64 ? attachment.base64.slice(0, 32) : Math.random().toString(36).slice(2);
  return `${prefix}:${attachment.mimeType}:${hashSegment}`;
}

async function uploadAttachmentFile(client: OpenAI, attachment: AttachmentData): Promise<string> {
  const fileToUpload = attachment.file ?? createFileFromAttachment(attachment);

  if (!fileToUpload) {
    throw new Error("Cannot upload attachment because the File object is missing");
  }

  const uploaded = await client.files.create({
    file: fileToUpload,
    purpose: "user_data",
    expires_after: {
      anchor: "created_at",
      seconds: 60 * 60
    }
  });

  return uploaded.id;
}

function createFileFromAttachment(attachment: AttachmentData): File | undefined {
  if (!attachment.base64) {
    return undefined;
  }

  try {
    const binaryString = atob(attachment.base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const mimeType = attachment.mimeType || 'application/octet-stream';
    const blob = new Blob([bytes], { type: mimeType });
    const filename = attachment.name || `attachment-${Date.now()}`;
    return new File([blob], filename, { type: mimeType });
  } catch (error) {
    console.warn("Failed to recreate File from attachment base64:", error);
    return undefined;
  }
}

function buildInlineFilePart(attachment: AttachmentData): InputFilePart | undefined {
  if (!attachment.base64) {
    return undefined;
  }

  const mimeType = attachment.mimeType || 'application/octet-stream';
  const dataPrefix = attachment.base64.startsWith('data:')
    ? attachment.base64
    : `data:${mimeType};base64,${attachment.base64}`;

  return {
    type: "input_file",
    filename: attachment.name || 'attachment',
    file_data: dataPrefix
  };
}

function createInputTextPart(text: string): InputTextPart {
  return {
    type: "input_text",
    text,
  };
}

function createInputImagePart(base64: string, mimeType: string): InputImagePart {
  return {
    type: "input_image",
    detail: "auto",
    image_url: `data:${mimeType};base64,${base64}`,
  };
}

