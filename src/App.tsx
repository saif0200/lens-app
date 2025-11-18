import { useState, useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { sendMessageToGemini } from "./gemini";

const cleanAiText = (text: string): string => {
  if (!text) {
    return text;
  }

  const normalizedLineEndings = text.replace(/\r\n/g, "\n");
  const trimmedLineEnds = normalizedLineEndings
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  const tightenedPunctuation = trimmedLineEnds
    .replace(/([^\s])\s+([.,!?;:])/g, "$1$2")
    .replace(/([^\s])\s+([\)\]\}])/g, "$1$2");

  return tightenedPunctuation.trimEnd();
};

type MathJaxObject = {
  typesetPromise?: (elements?: (Element | Document)[]) => Promise<void>;
  typeset?: (elements?: (Element | Document)[]) => void;
  typesetClear?: (elements?: (Element | Document)[]) => void;
  startup?: {
    promise?: Promise<unknown>;
  };
};

type MathJaxWindow = Window & {
  MathJax?: MathJaxObject;
};

interface Message {
  id: number;
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'typing';
  screenshotIncluded?: boolean;
  screenshotData?: string;
}

type MarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  node?: unknown;
};

type MarkdownCodeProps = HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  node?: unknown;
};

const MarkdownLink = ({ node, ...props }: MarkdownLinkProps) => {
  void node;
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
};

function App() {
  const [showInput, setShowInput] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [copiedCodeBlockId, setCopiedCodeBlockId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAnimatingRef = useRef(false);
  const lastScrollKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const codeBlockCopyResetTimerRef = useRef<number | null>(null);
  const isMac =
    typeof navigator !== "undefined"
      ? navigator.platform.toUpperCase().includes("MAC")
      : false;
  const modKey = isMac ? "⌘" : "Ctrl";

  const handleCopyCodeBlock = async (blockId: string, code: string) => {
    if (!navigator.clipboard) {
      console.warn("Clipboard API not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeBlockId(blockId);

      if (codeBlockCopyResetTimerRef.current) {
        window.clearTimeout(codeBlockCopyResetTimerRef.current);
      }

      codeBlockCopyResetTimerRef.current = window.setTimeout(() => {
        setCopiedCodeBlockId((current) => (current === blockId ? null : current));
        codeBlockCopyResetTimerRef.current = null;
      }, 800);
    } catch (error) {
      console.error("Failed to copy code block:", error);
    }
  };

  const MarkdownCode = ({
    inline,
    className,
    children,
    node,
    ...props
  }: MarkdownCodeProps) => {
    void node;
    const childText = Array.isArray(children)
      ? children
          .map((child) => (typeof child === "string" ? child : ""))
          .join("")
      : typeof children === "string"
        ? children
        : "";

    const isInline =
      inline ?? !/\r|\n/.test(childText);

    if (isInline) {
      const combinedClassName = ["ai-code-inline", className]
        .filter(Boolean)
        .join(" ");
      return (
        <code className={combinedClassName} {...props}>
          {children}
        </code>
      );
    }

    // Extract language from className (e.g., "language-javascript" -> "javascript")
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "text";

    // Format language name for display
    const languageDisplayNames: Record<string, string> = {
      js: "JavaScript",
      jsx: "JavaScript (JSX)",
      ts: "TypeScript",
      tsx: "TypeScript (TSX)",
      py: "Python",
      rb: "Ruby",
      cpp: "C++",
      cs: "C#",
      sh: "Shell",
      bash: "Bash",
      yml: "YAML",
      yaml: "YAML",
      json: "JSON",
      md: "Markdown",
      html: "HTML",
      css: "CSS",
      scss: "SCSS",
      sql: "SQL",
      text: "Plain Text",
    };

    const languageDisplay = languageDisplayNames[language.toLowerCase()]
      || language.charAt(0).toUpperCase() + language.slice(1);

    // Generate unique ID for this code block based on content hash
    const blockId = `code-${childText.length}-${childText.substring(0, 20).replace(/\s/g, '')}`;

    return (
      <div className="ai-code-block-wrapper">
        <div className="code-block-header">
          <span className="code-language-tag">{languageDisplay}</span>
          <button
            type="button"
            className="code-copy-button"
            onClick={() => {
              void handleCopyCodeBlock(blockId, childText);
            }}
            aria-label="Copy code"
          >
            {copiedCodeBlockId === blockId ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <polyline
                    points="3,8 6,11 13,4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <span className="code-copy-label">Copied</span>
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <span className="code-copy-label">Copy code</span>
              </>
            )}
          </button>
        </div>
        <div className="ai-code-block">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: 0,
              background: "transparent",
              fontSize: "12px",
              lineHeight: "1.6",
            }}
            codeTagProps={{
              style: {
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              }
            }}
          >
            {childText}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const markdownComponents = {
    a: MarkdownLink,
    code: MarkdownCode,
  } satisfies Components;

  const handleToggleWindow = () => {
    invoke("toggle_window");
  };

  const handleScreenShareToggle = async () => {
    if (isCapturingScreenshot) {
      return;
    }

    if (isScreenShareEnabled) {
      setIsScreenShareEnabled(false);
      return;
    }

    setIsCapturingScreenshot(true);
    try {
      const screenshot = await captureScreenshot();
      if (screenshot) {
        setIsScreenShareEnabled(true);
      } else {
        console.warn("Screenshot capture did not return data; screen share remains off.");
      }
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const captureScreenshot = async (): Promise<string | null> => {
    try {
      const base64 = await invoke<string>("capture_screen");
      return base64 ?? null;
    } catch (error) {
      console.error("Screen capture failed:", error);
      return null;
    }
  };

  const handleAsk = () => {
    // Don't allow ask to work when window is hidden
    if (!isWindowVisible) return;

    // Prevent rapid toggling to avoid animation breaks
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setShowInput(!showInput);

    // Reset animation lock after animation completes (350ms entrance, 150ms exit)
    const animDuration = !showInput ? 350 : 150;
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
      setIsScreenShareEnabled(false);
    }, 150);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    // Remove typing indicator
    setMessages((prev) => prev.filter(msg => msg.type !== 'typing'));
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === "" || isGenerating) return;

    const messageText = inputValue;
    setInputValue("");
    setIsGenerating(true);

    let screenshotBase64: string | null = null;
    let screenshotIncluded = false;
    let screenshotDataUrl: string | null = null;

    if (isScreenShareEnabled) {
      screenshotBase64 = await captureScreenshot();
      if (screenshotBase64) {
        screenshotIncluded = true;
        screenshotDataUrl = `data:image/png;base64,${screenshotBase64}`;
      } else {
        setIsScreenShareEnabled(false);
      }
    }

    const userMessage: Message = {
      id: Date.now(),
      text: messageText,
      timestamp: new Date(),
      type: 'user',
      screenshotIncluded,
      screenshotData: screenshotDataUrl ?? undefined,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Expand chat on first message
    if (!hasExpanded) {
      setHasExpanded(true);
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

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Convert conversation history to format expected by Gemini
    const conversationHistory = messages
      .filter(msg => msg.type !== 'typing')
      .map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'model' as const,
        text: msg.screenshotIncluded
          ? `${msg.text}\n\n[User shared a screenshot of their screen with this message.]`
          : msg.text,
      }));

    // Call Gemini and wait for complete response
    sendMessageToGemini(userMessage.text, conversationHistory, screenshotBase64 ?? undefined)
      .then((responseText) => {
        const cleanedResponse = cleanAiText(responseText);
        const aiMessage: Message = {
          id: Date.now(),
          text: cleanedResponse,
          timestamp: new Date(),
          type: 'ai',
        };
        // Remove typing indicator and add AI response
        setMessages((prev) =>
          prev.filter(msg => msg.id !== typingId).concat(aiMessage)
        );
        setIsGenerating(false);
        abortControllerRef.current = null;
      })
      .catch((error) => {
        // Handle errors by showing error message
        console.error('Gemini API error:', error);

        // Don't show error if request was aborted
        if (error.name === 'AbortError') {
          setMessages((prev) => prev.filter(msg => msg.id !== typingId));
        } else {
          const errorMessage: Message = {
            id: Date.now(),
            text: "Sorry, I couldn't process that request. Please try again.",
            timestamp: new Date(),
            type: 'ai',
          };
          setMessages((prev) =>
            prev.filter(msg => msg.id !== typingId).concat(errorMessage)
          );
        }
        setIsGenerating(false);
        abortControllerRef.current = null;
      });
  };

  const handleCopyResponse = async (messageId: number, text: string) => {
    if (!navigator.clipboard) {
      console.warn("Clipboard API not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);

      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }

      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
        copyResetTimerRef.current = null;
      }, 800);
    } catch (error) {
      console.error("Failed to copy AI response:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSendMessage();
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
    if (typeof window === "undefined") {
      return;
    }

    const script = document.getElementById("mathjax-script");
    if (!(script instanceof HTMLScriptElement)) {
      return;
    }

    const handleLoad = () => {
      const mathJax = (window as MathJaxWindow).MathJax;
      if (!mathJax) {
        return;
      }

      const startupPromise = mathJax.startup?.promise ?? Promise.resolve();
      void startupPromise
        .then(() => {
          if (typeof mathJax.typesetPromise === "function") {
            return mathJax.typesetPromise();
          }
          mathJax.typeset?.();
          return undefined;
        })
        .catch((error) => {
          console.error("MathJax initial typeset failed:", error);
        });
    };

    if ((window as MathJaxWindow).MathJax?.typesetPromise) {
      handleLoad();
      return;
    }

    script.addEventListener("load", handleLoad);
    return () => {
      script.removeEventListener("load", handleLoad);
    };
  }, []);

  useEffect(() => {
    if (!messages.some((message) => message.type === 'ai')) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const mathJax = (window as MathJaxWindow).MathJax;
      if (!mathJax) {
        return;
      }

      const startupPromise = mathJax.startup?.promise ?? Promise.resolve();
      void startupPromise
        .then(() => {
          if (typeof mathJax.typesetPromise === "function") {
            return mathJax.typesetPromise();
          }
          mathJax.typeset?.();
          return undefined;
        })
        .catch((error) => {
          console.error("MathJax typeset failed:", error);
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [messages]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      if (codeBlockCopyResetTimerRef.current) {
        window.clearTimeout(codeBlockCopyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Dynamically resize window based on state
    const resizeWindow = async () => {
      const width = 545;
      let height: number;

      if (!showInput) {
        // Pill mode - minimal height (even if chat exists)
        height = 60;
      } else if (hasExpanded) {
        // Chat history visible - full height
        height = 305;
      } else {
        // Just input visible - medium height
        height = 105;
      }

      // For entrance: resize immediately so window is ready before CSS animation
      // For exit: delay resize until after CSS exit animation completes
      const delay = showInput ? 0 : 180;

      setTimeout(async () => {
        await invoke("resize_window", { width, height });
      }, delay);
    };

    void resizeWindow();
  }, [showInput, hasExpanded]);

  useEffect(() => {
    // Listen for global shortcut event from Rust backend
    const unlistenAsk = listen("ask-triggered", () => {
      handleAsk();
    });

    const unlistenScreenShare = listen("screen-share-triggered", () => {
      void handleScreenShareToggle();
    });

    return () => {
      unlistenAsk.then((fn) => fn());
      unlistenScreenShare.then((fn) => fn());
    };
  }, [showInput, isWindowVisible, isScreenShareEnabled, isCapturingScreenshot]); // Re-create when visibility or screen share state changes

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
      // Dynamically set spacer height based on viewport and last AI message
      const messagesContainer = node.parentElement;
      if (messagesContainer) {
        const lastAiMessage = messagesContainer.querySelector('.message-ai:last-of-type');
        const viewportHeight = messagesContainer.clientHeight; // Height of visible area
        const messageHeight = lastAiMessage ? lastAiMessage.scrollHeight : 0;
        // Spacer should be at least 50% of viewport or message height + 20px, whichever is larger
        const spacerHeight = Math.max(viewportHeight * 0.5, messageHeight + 20);
        node.style.minHeight = `${spacerHeight}px`;
      }

      // Only scroll for typing indicator and user messages, not AI messages
      if (scrollTargetMessage?.type !== "ai") {
        node.scrollIntoView({
          behavior: scrollTargetMessage?.type === "typing" ? "smooth" : "auto",
          block: "end",
          inline: "nearest"
        });
      }
    });
  }, [scrollTargetKey]);
  const shouldShowResetButton = messages.length > 0 && showInput;

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
          onClick={() => handleAsk()}
        >
          <span className="action-label">Ask</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap">↵</span>
        </button>

        <button
          className={`toolbar-segment toolbar-action screen-share-toggle ${isScreenShareEnabled ? "active" : ""}`}
          data-tauri-drag-region-disabled
          aria-label={`Screen share ${isScreenShareEnabled ? "on" : "off"}`}
          aria-pressed={isScreenShareEnabled}
          onClick={() => {
            void handleScreenShareToggle();
          }}
          disabled={isCapturingScreenshot}
          title={
            isCapturingScreenshot
              ? "Capturing your screen..."
              : isScreenShareEnabled
                ? "Stop sharing your current screen capture"
                : "Capture your screen for the next message"
          }
        >
          <span className="action-label">Share Screen</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap">S</span>
          <span className="screen-share-indicator" aria-hidden="true" />
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

        {shouldShowResetButton ? (
          <button
            className="toolbar-segment toolbar-menu reset-button"
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
        ) : (
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
        )}
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
                    <>
                      <div className="message-text">{message.text}</div>
                      {message.screenshotIncluded && (
                        <div className="message-screen-note">
                          <span className="message-screen-note-label">Sent your screen</span>
                          {message.screenshotData && (
                            <button
                              type="button"
                              className="message-screen-thumb"
                              aria-label="Preview shared screen"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M21 19H3C1.9 19 1 18.1 1 17V7C1 5.9 1.9 5 3 5H21C22.1 5 23 5.9 23 7V17C23 18.1 22.1 19 21 19ZM3 7V17H21V7H3ZM9 15C7.34 15 6 13.66 6 12C6 10.34 7.34 9 9 9C10.66 9 12 10.34 12 12C12 13.66 10.66 15 9 15ZM9 11C8.45 11 8 11.45 8 12C8 12.55 8.45 13 9 13C9.55 13 10 12.55 10 12C10 11.45 9.55 11 9 11ZM18 15H13V13H18V15ZM18 11H14V9H18V11Z"
                                  fill="currentColor"
                                />
                              </svg>
                              <div className="message-screen-preview">
                                <img src={message.screenshotData} alt="Shared screen preview" />
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {message.type === 'ai' && (
                    <div className="ai-text">
                      <div className="ai-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {message.text}
                        </ReactMarkdown>
                      </div>
                      <div className="message-actions">
                        <button
                          type="button"
                          className={`ai-copy-button ${copiedMessageId === message.id ? "copied" : ""}`}
                          onClick={() => {
                            void handleCopyResponse(message.id, message.text);
                          }}
                          aria-label="Copy AI response"
                        >
                          {copiedMessageId === message.id ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <polyline
                                points="3,8 6,11 13,4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                              />
                              <path
                                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
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
              <div ref={messagesEndRef} className="scroll-spacer" />
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
              disabled={isGenerating}
            />
            {isGenerating ? (
              <button
                className="send-button stop-button"
                aria-label="Stop"
                onClick={handleStopGeneration}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="6"
                    y="6"
                    width="12"
                    height="12"
                    rx="2"
                    fill="currentColor"
                  />
                </svg>
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="Send"
                onClick={() => {
                  void handleSendMessage();
                }}
                disabled={inputValue.trim() === ""}
              >
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
