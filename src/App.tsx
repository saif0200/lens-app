import "./App.css";

function App() {

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <div className="app">
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
          aria-label="Ask (inactive)"
        >
          <span className="action-label">Ask</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap">↵</span>
        </button>

        <button
          className="toolbar-segment toolbar-action"
          data-tauri-drag-region-disabled
          aria-label="Show or hide (inactive)"
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
    </div>
  );
}

export default App;
