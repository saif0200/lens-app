import type { AIProvider, ReasoningEffort } from "../types";
import type { ModelConfig } from "../config/models";

interface InputFooterProps {
  currentProvider: AIProvider;
  currentModelId: string;
  currentModelName: string;
  currentModels: ModelConfig[];
  geminiModel: string;
  reasoningEffort: ReasoningEffort;
  isGeminiThinkingEnabled: boolean;
  isWebSearchEnabled: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCycleReasoningEffort: () => void;
  onToggleThinking: () => void;
  onToggleWebSearch: () => void;
  onModelChange: (modelId: string) => void;
}

export function InputFooter({
  currentProvider,
  currentModelId,
  currentModelName,
  currentModels,
  geminiModel,
  reasoningEffort,
  isGeminiThinkingEnabled,
  isWebSearchEnabled,
  fileInputRef,
  onFileSelect,
  onCycleReasoningEffort,
  onToggleThinking,
  onToggleWebSearch,
  onModelChange,
}: InputFooterProps) {
  const showReasoningToggle = currentProvider === 'openai' || (currentProvider === 'gemini' && geminiModel.includes('gemini-3-pro'));
  const showThinkingToggle = currentProvider === 'gemini' && !geminiModel.includes('gemini-3-pro');

  return (
    <div className="input-footer">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        multiple
        style={{ display: 'none' }}
      />
      <button
        className="attachment-button"
        aria-label="Add attachment"
        title="Add attachment"
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showReasoningToggle && (
        <button
          className={`reasoning-toggle effort-${reasoningEffort}`}
          onClick={onCycleReasoningEffort}
          title={`Reasoning Effort: ${reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1)}`}
          aria-label="Toggle reasoning effort"
        >
          <span className="reasoning-icon">
            {reasoningEffort === 'low' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {reasoningEffort === 'medium' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {reasoningEffort === 'high' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" fill="currentColor" opacity="0.2" />
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="reasoning-label">
            {reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1)}
          </span>
        </button>
      )}

      {showThinkingToggle && (
        <button
          className={`web-search-toggle ${isGeminiThinkingEnabled ? 'active' : ''}`}
          onClick={onToggleThinking}
          title={`Thinking: ${isGeminiThinkingEnabled ? 'On' : 'Off'}`}
          aria-label="Toggle thinking"
          aria-pressed={isGeminiThinkingEnabled}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" fill="currentColor" opacity="0.2" />
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="reasoning-label">Thinking</span>
        </button>
      )}

      <button
        className={`web-search-toggle ${isWebSearchEnabled ? 'active' : ''}`}
        onClick={onToggleWebSearch}
        title={`Web Search: ${isWebSearchEnabled ? 'On' : 'Off'}`}
        aria-label="Toggle web search"
        aria-pressed={isWebSearchEnabled}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="reasoning-label">Web Search</span>
      </button>

      <div style={{ flexGrow: 1 }} />

      <div className="model-selector-wrapper">
        <span className="model-selector-value">{currentModelName}</span>
        <select
          className="model-selector"
          value={currentModelId}
          onChange={(e) => onModelChange(e.target.value)}
          aria-label="Select AI Model"
        >
          {currentModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <svg className="model-selector-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
