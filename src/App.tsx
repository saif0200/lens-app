import { useState, useEffect, useRef } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
}

const MOCK_AI_RESPONSES = [
  "I understand what you're asking about.",
  "That's an interesting question. Let me help you with that.",
  "I can see what you mean. Here's what I think.",
  "Good point! I've processed your request.",
  "Thanks for sharing that. I'm here to assist.",
];

function App() {
  const [showInput, setShowInput] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const modKey = isMac ? "⌘" : "Ctrl";

  const handleToggleWindow = () => {
    invoke("toggle_window");
  };

  const handleAsk = () => {
    // Prevent rapid toggling to avoid animation breaks
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setShowInput(!showInput);

    // Reset animation lock after animation completes (280ms entrance, 150ms exit)
    const animDuration = showInput ? 150 : 280;
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, animDuration);
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;

    const userMessage: Message = {
      id: Date.now(),
      text: inputValue,
      timestamp: new Date(),
      type: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Expand chat on first message
    if (!hasExpanded) {
      setHasExpanded(true);
      setShowInput(true);
    }

    // Add typing indicator
    const typingId = Date.now() + 1;
    const typingMessage: Message = {
      id: typingId,
      text: '',
      timestamp: new Date(),
      type: 'typing',
    };

    setMessages((prev) => [...prev, typingMessage]);

    // After 500ms, remove typing and add AI response
    setTimeout(() => {
      const randomResponse = MOCK_AI_RESPONSES[Math.floor(Math.random() * MOCK_AI_RESPONSES.length)];
      const aiMessage: Message = {
        id: Date.now(),
        text: randomResponse,
        timestamp: new Date(),
        type: 'ai',
      };

      setMessages((prev) => prev.filter(msg => msg.id !== typingId).concat(aiMessage));
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    // Listen for global shortcut event from Rust backend
    const unlisten = listen("ask-triggered", () => {
      handleAsk();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [showInput]); // Only re-create listener when showInput changes for proper toggle

  // Auto-scroll to latest user message (position at top)
  useEffect(() => {
    if (latestUserMessageRef.current) {
      latestUserMessageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  return (
    <div className={`app ${showInput ? "with-input" : ""} ${hasExpanded ? "chat-expanded" : ""}`}>
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
        <div className={`chat-wrapper ${hasExpanded ? "expanded" : ""}`}>
          {hasExpanded && (
            <div className="messages-area">
              {messages.map((message, index) => {
                // Find the last user message
                const isLatestUserMessage = message.type === 'user' &&
                  index === messages.map(m => m.type).lastIndexOf('user');

                return (
                  <div
                    key={message.id}
                    className={`message message-${message.type}`}
                    ref={isLatestUserMessage ? latestUserMessageRef : null}
                  >
                    {message.type === 'user' && (
                      <div className="message-text">{message.text}</div>
                    )}
                    {message.type === 'ai' && (
                      <div className="ai-text">{message.text}</div>
                    )}
                    {message.type === 'typing' && (
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="input-area">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about your screen or conversation, or ${modKey} ↵ for Assist`}
            />
            <button className="send-button" aria-label="Send" onClick={handleSendMessage}>
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
    </div>
  );
}

export default App;
