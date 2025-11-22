export interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
  screenshotIncluded?: boolean;
  screenshotData?: string;
  screenshotMimeType?: string;
  attachments?: {
    preview: string;
    mimeType: string;
    name: string;
  }[];
  sources?: Source[];
}

export interface AttachmentData {
  base64: string;
  mimeType: string;
  name?: string;
  text?: string;
  id?: string;
  file?: File;
}

export type AIProvider = 'gemini' | 'openai';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface SendMessageOptions {
  reasoningEffort?: ReasoningEffort;
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
}

export interface Source {
  title: string;
  url: string;
}
