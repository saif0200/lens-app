export interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
  screenshotIncluded?: boolean;
  screenshotData?: string;
}

export type AIProvider = 'gemini' | 'openai';
