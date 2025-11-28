import type { AIProvider } from "../types";

interface ToolbarProps {
  currentProvider: AIProvider;
  onProviderToggle: () => void;
  onAskButton: () => void;
  onScreenShareToggle: () => void;
  onToggleWindow: () => void;
  onResetChat: () => void;
  onOpenSettings: () => void;
  isScreenShareEnabled: boolean;
  hasAttachments: boolean;
  shouldShowResetButton: boolean;
  modKey: string;
}

export function Toolbar({
  currentProvider,
  onProviderToggle,
  onAskButton,
  onScreenShareToggle,
  onToggleWindow,
  onResetChat,
  onOpenSettings,
  isScreenShareEnabled,
  hasAttachments,
  shouldShowResetButton,
  modKey,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className="toolbar-segment drag-handle"
        data-tauri-drag-region
        aria-label="Drag toolbar"
        title="Drag to move"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="5" cy="4" r="1.5" fill="currentColor" />
          <circle cx="11" cy="4" r="1.5" fill="currentColor" />
          <circle cx="5" cy="8" r="1.5" fill="currentColor" />
          <circle cx="11" cy="8" r="1.5" fill="currentColor" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="11" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </button>

      <button
        className="toolbar-segment toolbar-action provider-toggle"
        data-tauri-drag-region-disabled
        aria-label={`Switch to ${currentProvider === 'gemini' ? 'OpenAI' : 'Gemini'}`}
        onClick={onProviderToggle}
        title={`Current provider: ${currentProvider === 'gemini' ? 'Gemini' : 'OpenAI'}`}
      >
        <span className="action-label">
          {currentProvider === 'gemini' ? 'Gemini' : 'OpenAI'}
        </span>
      </button>

      <button
        className="toolbar-segment toolbar-action"
        data-tauri-drag-region-disabled
        aria-label="Ask"
        onClick={onAskButton}
      >
        <span className="action-label">Ask</span>
        <span className="keycap">{modKey}</span>
        <span className="keycap keycap-enter">↵</span>
      </button>

      <button
        className={`toolbar-segment toolbar-action screen-share-toggle ${isScreenShareEnabled ? "active" : ""} ${hasAttachments ? "disabled" : ""}`}
        data-tauri-drag-region-disabled
        aria-label={`Screen share ${isScreenShareEnabled ? "on" : "off"}`}
        aria-pressed={isScreenShareEnabled}
        disabled={hasAttachments}
        onClick={() => {
          if (!hasAttachments) {
            onScreenShareToggle();
          }
        }}
        title={
          hasAttachments
            ? "Screen sharing is disabled when attachments are present"
            : isScreenShareEnabled
            ? "Stop sharing your current screen capture"
            : "Capture your screen for the next message"
        }
      >
        <span className="action-label">Share</span>
        <span className="keycap">{modKey}</span>
        <span className="keycap">S</span>
        <span className="screen-share-indicator" aria-hidden="true" />
      </button>

      <button
        className="toolbar-segment toolbar-action"
        data-tauri-drag-region-disabled
        aria-label="Show or hide"
        onClick={onToggleWindow}
      >
        <span className="action-label">Show/Hide</span>
        <span className="keycap">{modKey}</span>
        <span className="keycap">\</span>
      </button>

      {shouldShowResetButton ? (
        <button
          className="toolbar-segment toolbar-menu reset-button"
          data-tauri-drag-region-disabled
          aria-label="Reset chat"
          title="Reset chat"
          onClick={onResetChat}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2 2L10 10M10 2L2 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : (
        <button
          className="toolbar-segment toolbar-menu"
          data-tauri-drag-region-disabled
          aria-label="Menu"
          title="Settings"
          onClick={onOpenSettings}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="8" cy="3" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="13" r="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
    </div>
  );
}
