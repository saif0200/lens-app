export interface ModelConfig {
  id: string;
  name: string;
}

export const OPENAI_MODELS: ModelConfig[] = [
  { id: 'gpt-5-nano', name: 'GPT-5 nano' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini' },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
  { id: 'gpt-5.1', name: 'GPT-5.1' },
  { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex mini' },
];

export const GEMINI_MODELS: ModelConfig[] = [
  { id: 'gemini-flash-latest', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
];

export const DEFAULT_OPENAI_MODEL = OPENAI_MODELS[0].id;
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;
