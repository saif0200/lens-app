export interface ModelConfig {
  id: string;
  name: string;
}

export const OPENAI_MODELS: ModelConfig[] = [
  { id: 'gpt-5-nano', name: 'GPT-5 nano' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini' },
  { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex mini' },
];

export const GEMINI_MODELS: ModelConfig[] = [
  { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash-Lite' },
];

export const DEFAULT_OPENAI_MODEL = OPENAI_MODELS[0].id;
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;
