import { useState, useEffect } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [showInput, setShowInput] = useState(false);
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const modKey = isMac ? "⌘" : "Ctrl";

  const handleToggleWindow = () => {
    invoke("toggle_window");
  };

  const handleAsk = () => {
    setShowInput(!showInput);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleAsk();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showInput]);

  return (
    <div className={`app ${showInput ? "with-input" : ""}`}>
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
          className="toolbar-segment toolbar-action"
          data-tauri-drag-region-disabled
          aria-label="Ask"
          onClick={handleAsk}
        >
          <span className="action-label">Ask</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap">↵</span>
        </button>

        <button
          className="toolbar-segment toolbar-action"
          data-tauri-drag-region-disabled
          aria-label="Show or hide"
          onClick={handleToggleWindow}
        >
          <span className="action-label">Show/Hide</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap">\</span>
        </button>

        <button
          className="toolbar-segment toolbar-menu"
          data-tauri-drag-region-disabled
          aria-label="Menu (inactive)"
          title="More options"
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
      </div>

      <div className="input-container">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder={`Ask about your screen or conversation, or ${modKey} ↵ for Assist`}
          />
          <button className="send-button" aria-label="Send">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 19.5L21.5 12L4.5 4.5V10.5L15.5 12L4.5 13.5V19.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
