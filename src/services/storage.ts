/**
 * Centralized storage service for managing localStorage operations
 */

const KEYS = {
  OPENAI_API_KEY: "openai_api_key",
  GEMINI_API_KEY: "gemini_api_key",
  CONTENT_PROTECTION: "content_protection",
} as const;

export const storage = {
  // OpenAI API Key
  getOpenAIKey: (): string | null => localStorage.getItem(KEYS.OPENAI_API_KEY),
  setOpenAIKey: (key: string): void => localStorage.setItem(KEYS.OPENAI_API_KEY, key),
  removeOpenAIKey: (): void => localStorage.removeItem(KEYS.OPENAI_API_KEY),

  // Gemini API Key
  getGeminiKey: (): string | null => localStorage.getItem(KEYS.GEMINI_API_KEY),
  setGeminiKey: (key: string): void => localStorage.setItem(KEYS.GEMINI_API_KEY, key),
  removeGeminiKey: (): void => localStorage.removeItem(KEYS.GEMINI_API_KEY),

  // Content Protection
  getContentProtection: (): boolean => localStorage.getItem(KEYS.CONTENT_PROTECTION) === "true",
  setContentProtection: (enabled: boolean): void => localStorage.setItem(KEYS.CONTENT_PROTECTION, String(enabled)),
};
