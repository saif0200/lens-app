import { useState, useEffect, useRef } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { sendMessageToGemini } from "./gemini";

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
}

function App() {
  const [showInput, setShowInput] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAnimatingRef = useRef(false);
  const lastScrollKeyRef = useRef<string | null>(null);
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const modKey = isMac ? "⌘" : "Ctrl";

  const handleToggleWindow = () => {
    invoke("toggle_window");
  };

  const handleAsk = () => {
    // Don't allow ask to work when window is hidden
    if (!isWindowVisible) return;

    // Prevent rapid toggling to avoid animation breaks
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setShowInput(!showInput);

    // Reset animation lock after animation completes (300ms entrance, 150ms exit)
    const animDuration = showInput ? 150 : 300;
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, animDuration);
  };

  const handleResetChat = () => {
    // First, trigger the exit animation by closing the input
    setShowInput(false);

    // Then, after the exit animation completes (150ms), clear the chat state
    setTimeout(() => {
      setMessages([]);
      setHasExpanded(false);
      setInputValue("");
    }, 150);
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

    // Convert conversation history to format expected by Gemini
    const conversationHistory = messages
      .filter(msg => msg.type !== 'typing')
      .map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'model' as const,
        text: msg.text,
      }));

    // Call Gemini and wait for complete response
    sendMessageToGemini(userMessage.text, conversationHistory)
      .then((responseText) => {
        const aiMessage: Message = {
          id: Date.now(),
          text: responseText,
          timestamp: new Date(),
          type: 'ai',
        };
        // Remove typing indicator and add AI response
        setMessages((prev) =>
          prev.filter(msg => msg.id !== typingId).concat(aiMessage)
        );
      })
      .catch((error) => {
        // Handle errors by showing error message
        console.error('Gemini API error:', error);
        const errorMessage: Message = {
          id: Date.now(),
          text: "Sorry, I couldn't process that request. Please try again.",
          timestamp: new Date(),
          type: 'ai',
        };
        setMessages((prev) =>
          prev.filter(msg => msg.id !== typingId).concat(errorMessage)
        );
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    // Listen for window visibility events
    const unlistenShow = listen("window-shown", () => {
      setIsWindowVisible(true);
    });

    const unlistenHide = listen("window-hidden", () => {
      setIsWindowVisible(false);
    });

    return () => {
      unlistenShow.then((fn) => fn());
      unlistenHide.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    // Listen for global shortcut event from Rust backend
    const unlisten = listen("ask-triggered", () => {
      handleAsk();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [showInput, isWindowVisible]); // Re-create when visibility changes

  useEffect(() => {
    // Listen for ESC key to reset chat
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && messages.length > 0 && showInput) {
        handleResetChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messages.length, showInput]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (showInput && inputRef.current) {
      // Use requestAnimationFrame to focus after render completes
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  }, [showInput]);

  const scrollTargetMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const scrollTargetKey = scrollTargetMessage
    ? JSON.stringify([
        scrollTargetMessage.id,
        scrollTargetMessage.type,
        scrollTargetMessage.type === "ai" ? scrollTargetMessage.text : null,
      ])
    : null;

  // Auto-scroll to latest visible message, including streaming updates
  useEffect(() => {
    if (!scrollTargetKey) {
      lastScrollKeyRef.current = null;
      return;
    }

    if (lastScrollKeyRef.current === scrollTargetKey) {
      return;
    }

    const node = messagesEndRef.current;
    if (!node) {
      return;
    }

    lastScrollKeyRef.current = scrollTargetKey;

    requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: scrollTargetMessage?.type === "typing" ? "auto" : "smooth",
        block: "end",
      });
    });
  }, [scrollTargetKey]);

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

        <button
          className={`reset-button ${messages.length > 0 && showInput ? "visible" : ""}`}
          data-tauri-drag-region-disabled
          aria-label="Reset chat"
          title="Reset chat"
          onClick={handleResetChat}
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
      </div>

      <div className="input-container">
        <div className={`chat-wrapper ${hasExpanded ? "expanded" : ""}`}>
          {hasExpanded && (
            <div className="messages-area">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message message-${message.type}`}
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
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          <div className="input-area">
            <input
              ref={inputRef}
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
