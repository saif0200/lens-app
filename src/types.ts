export interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
  screenshotIncluded?: boolean;
  screenshotData?: string;
  sources?: Source[];
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
