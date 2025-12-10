import { useState, useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import "./styles/index.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { sendMessage } from "./ai";
import { Message, AIProvider, ReasoningEffort, AttachmentData } from "./types";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { storage } from "./services/storage";
import { cleanAiText } from "./utils/textUtils";
import { useClipboard } from "./hooks/useClipboard";
import { OPENAI_MODELS, GEMINI_MODELS } from "./config/models";
import { UpdateChecker } from "./components/UpdatePopup";

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
  const [currentProvider, setCurrentProvider] = useState<AIProvider>('gemini');
  const [openaiModel, setOpenaiModel] = useState(OPENAI_MODELS[0].id);
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODELS[0].id);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('low');
  const [isGeminiThinkingEnabled, setIsGeminiThinkingEnabled] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const webSearchEnabledRef = useRef(false);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [attachments, setAttachments] = useState<{ id: string; file: File; preview: string; base64: string; mimeType: string; text?: string }[]>([]);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(new Set());
  const { copiedId: copiedMessageId, copy: copyMessage } = useClipboard<number>();
  const { copiedId: copiedCodeBlockId, copy: copyCodeBlock } = useClipboard<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAnimatingRef = useRef(false);
  const lastScrollKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFocusTimeRef = useRef(0);
  const prevShowInputRef = useRef(showInput);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastWindowSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isMac =
    typeof navigator !== "undefined"
      ? navigator.platform.toUpperCase().includes("MAC")
      : false;
  const modKey = isMac ? "⌘" : "Ctrl";

  // Keep ref in sync with state for immediate access
  useEffect(() => {
    webSearchEnabledRef.current = isWebSearchEnabled;
  }, [isWebSearchEnabled]);

  const toggleThought = (messageId: number) => {
    setExpandedThoughts(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
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
              void copyCodeBlock(blockId, childText);
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
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    invoke("toggle_window");

    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 300);
  };

  const handleOpenSettings = async (options?: { avoidMainWindow?: boolean }) => {
    const avoidMainWindow = options?.avoidMainWindow ?? false;
    try {
      const settingsWidth = 400;
      const settingsHeight = 500;
      let settingsWindow = await WebviewWindow.getByLabel('settings');

      if (!avoidMainWindow) {
        if (settingsWindow) {
          await settingsWindow.show();
          await settingsWindow.setFocus();
          return;
        }

        settingsWindow = new WebviewWindow('settings', {
          url: 'settings.html',
          title: 'Settings',
          width: settingsWidth,
          height: settingsHeight,
          resizable: false,
          transparent: true,
          hiddenTitle: true,
          titleBarStyle: 'overlay',
          alwaysOnTop: true,
        });
      } else {
        const currentWindow = getCurrentWindow();
        const [position, size, monitor] = await Promise.all([
          currentWindow.outerPosition(),
          currentWindow.outerSize(),
          currentMonitor(),
        ]);
        const gap = 16;
        const displayLeft = monitor?.position.x ?? 0;
        const displayTop = monitor?.position.y ?? 0;
        const displayRight = monitor ? monitor.position.x + monitor.size.width : Number.POSITIVE_INFINITY;
        const displayBottom = monitor ? monitor.position.y + monitor.size.height : Number.POSITIVE_INFINITY;

        let targetX = position.x + size.width + gap;
        if (targetX + settingsWidth > displayRight) {
          targetX = Math.max(position.x - settingsWidth - gap, displayLeft);
        }

        let targetY = position.y;
        if (targetY + settingsHeight > displayBottom) {
          targetY = Math.max(displayTop, displayBottom - settingsHeight);
        }

        if (settingsWindow) {
          await settingsWindow.setPosition(new PhysicalPosition(targetX, targetY));
          await settingsWindow.setAlwaysOnTop(true);
          await settingsWindow.show();
          await settingsWindow.setFocus();
          return;
        }

        settingsWindow = new WebviewWindow('settings', {
          url: 'settings.html',
          title: 'Settings',
          width: settingsWidth,
          height: settingsHeight,
          resizable: false,
          transparent: true,
          hiddenTitle: true,
          titleBarStyle: 'overlay',
          alwaysOnTop: true,
          x: targetX,
          y: targetY,
        });
      }

      settingsWindow.once('tauri://created', function () {
        // webview window successfully created
      });

      settingsWindow.once('tauri://error', function (e) {
        // an error happened creating the webview window
        console.error("Error creating settings window", e);
      });
    } catch (error) {
      console.error("Error opening settings window", error);
    }
  };

  const handleScreenShareToggle = async () => {
    if (isScreenShareEnabled) {
      setIsScreenShareEnabled(false);
      return;
    }

    setIsScreenShareEnabled(true);
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

  const handleAskButton = () => {
    // Don't allow ask to work when window is hidden
    if (!isWindowVisible) return;

    // Prevent rapid toggling to avoid animation breaks
    if (isAnimatingRef.current) return;

    // Simple toggle for button clicks
    if (showInput) {
      isAnimatingRef.current = true;
      setShowInput(false);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 200);
    } else {
      isAnimatingRef.current = true;
      setShowInput(true);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 320);
    }
  };

  const handleAsk = (forcedFocus = false) => {
    // Don't allow ask to work when window is hidden
    if (!isWindowVisible) return;

    // Prevent rapid toggling to avoid animation breaks
    if (isAnimatingRef.current) return;

    const isInputFocused = document.activeElement === inputRef.current;
    const timeSinceFocus = Date.now() - lastFocusTimeRef.current;
    // If window just got focus (within 200ms) OR we forced focus from Rust
    const justGainedFocus = timeSinceFocus < 200 || forcedFocus;

    if (showInput && isInputFocused && !justGainedFocus) {
      isAnimatingRef.current = true;
      setShowInput(false);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 200);
    } else if (!showInput) {
      isAnimatingRef.current = true;
      setShowInput(true);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 320);
    } else {
      inputRef.current?.focus();
      // Add a small lockout to prevent double-triggering
      isAnimatingRef.current = true;
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 100);
    }
  };

  const handleResetChat = () => {
    // First, trigger the exit animation by closing the input
    setShowInput(false);

    // Then, after the exit animation completes, clear the chat state
    setTimeout(() => {
      setMessages([]);
      setHasExpanded(false);
      setInputValue("");
      setAttachments([]);
      setIsScreenShareEnabled(false);
    }, 200);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    // Replace typing indicator with stopped message
    setMessages((prev) => {
      const withoutTyping = prev.filter(msg => msg.type !== 'typing');
      const stoppedMessage: Message = {
        id: Date.now(),
        text: "Response stopped.",
        timestamp: new Date(),
        type: 'ai',
      };
      return [...withoutTyping, stoppedMessage];
    });
  };

  // Detect if message should trigger auto web search
  const shouldAutoEnableWebSearch = (text: string): boolean => {
    // Check for URLs (with or without protocol)
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i;
    if (urlPattern.test(text)) return true;

    // Check for search-related phrases (case insensitive)
    const searchPhrases = [
      /\bsearch\s+(for|the|about|up)\b/i,
      /\blook\s+up\b/i,
      /\bfind\s+(me\s+)?(information|info|details|articles?|news)\b/i,
      /\bwhat('s| is| are)\s+(the\s+)?(latest|current|recent|new)\b/i,
      /\bgoogle\b/i,
      /\bbrowse\b/i,
      /\bcheck\s+(the\s+)?(web|internet|online)\b/i,
    ];

    return searchPhrases.some(pattern => pattern.test(text));
  };

  const handleSendMessage = async () => {
    if ((inputValue.trim() === "" && attachments.length === 0) || isGenerating) return;

    const messageText = inputValue;
    setInputValue("");
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsGenerating(true);

    let attachmentDataList: AttachmentData[] | undefined;
    let screenshotIncluded = false;
    let screenshotDataUrl: string | null = null;
    let screenshotMimeType: string | undefined;

    if (currentAttachments.length > 0) {
      attachmentDataList = currentAttachments.map(att => ({
        base64: att.base64,
        mimeType: att.mimeType,
        name: att.file.name,
        text: att.text,
        file: att.file,
        id: att.id
      }));
    } else if (isScreenShareEnabled) {
      const capturedBase64 = await captureScreenshot();
      if (capturedBase64) {
        attachmentDataList = [{
          base64: capturedBase64,
          mimeType: 'image/png',
          name: 'Screen Capture.png'
        }];
        screenshotIncluded = true;
        screenshotDataUrl = `data:image/png;base64,${capturedBase64}`;
        screenshotMimeType = 'image/png';
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
      screenshotMimeType,
      attachments: currentAttachments.map(att => ({
        preview: att.preview,
        mimeType: att.mimeType,
        name: att.file.name
      }))
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

    // Filter out typing indicators for history
    const history = messages.filter(msg => msg.type !== 'typing');

    // Call AI provider and wait for complete response
    // Auto-enable web search if message contains URLs or search-related phrases
    const autoWebSearch = shouldAutoEnableWebSearch(messageText);
    const webSearchValue = webSearchEnabledRef.current || autoWebSearch;
    console.log('[App] Sending message with webSearchEnabled:', webSearchValue, '(manual:', webSearchEnabledRef.current, ', auto:', autoWebSearch, ')');
    sendMessage(
      currentProvider,
      userMessage.text,
      history,
      attachmentDataList,
      abortControllerRef.current.signal,
      {
        reasoningEffort,
        thinkingEnabled: isGeminiThinkingEnabled,
        webSearchEnabled: webSearchValue,
        model: currentProvider === 'openai' ? openaiModel : geminiModel
      }
    )
      .then((response) => {
        const cleanedResponse = cleanAiText(response.text);
        const aiMessage: Message = {
          id: Date.now(),
          text: cleanedResponse,
          timestamp: new Date(),
          type: 'ai',
          sources: response.sources,
          thought: response.thought,
          thoughtDuration: response.thoughtDuration
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
        console.error(`${currentProvider === 'openai' ? 'OpenAI' : 'Gemini'} API error:`, error);

        // Don't do anything if request was aborted - handleStopGeneration already handled it
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          // Already handled by handleStopGeneration
          return;
        }

        const isMissingApiKey = error instanceof Error && error.message.includes("API key not found");

        const errorMessage: Message = {
          id: Date.now(),
          text: isMissingApiKey
            ? "API key not found. Please set it in settings."
            : "Sorry, I couldn't process that request. Please try again.",
          timestamp: new Date(),
          type: 'ai',
        };

        if (isMissingApiKey) {
          void handleOpenSettings({ avoidMainWindow: true });
        }

        const finalizeError = () => {
          setMessages((prev) =>
            prev.filter(msg => msg.id !== typingId).concat(errorMessage)
          );
          setIsGenerating(false);
          abortControllerRef.current = null;
        };

        if (isMissingApiKey) {
          window.setTimeout(finalizeError, 1000);
        } else {
          finalizeError();
        }
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const processFile = (file: File) => {
    // Check if file is text-based (code, txt, md, etc.)
    // This is a heuristic list, can be expanded
    const isText = file.type.startsWith('text/') ||
      /\.(js|jsx|ts|tsx|json|md|css|html|xml|yml|yaml|py|rb|java|c|cpp|h|rs|go|php|txt|sh|bat|ps1)$/i.test(file.name);

    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();

    if (isText) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Create base64 for consistency (though we prefer 'text' for AI)
        // Use a safe way to encode UTF-8 text to base64
        const base64 = btoa(unescape(encodeURIComponent(text)));

        const newAttachment = {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file,
          preview: '', // No image preview for text
          base64,
          mimeType: file.type || 'text/plain',
          text
        };

        setAttachments(prev => [...prev, newAttachment]);
        setIsScreenShareEnabled(false);
      };
      reader.readAsText(file);
    } else {
      // Binary files (Images, PDFs, etc.)
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        const newAttachment = {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file,
          preview: isImage ? result : '', // Only images get a preview URL
          base64,
          mimeType: file.type || 'application/octet-stream'
        };

        setAttachments(prev => [...prev, newAttachment]);
        setIsScreenShareEnabled(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => processFile(file));
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      Array.from(e.clipboardData.files).forEach(file => processFile(file));
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleZoom = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoomLevel((prev) => Math.min(prev + 0.1, 3));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener("keydown", handleZoom);
    return () => window.removeEventListener("keydown", handleZoom);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      lastFocusTimeRef.current = Date.now();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

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
    // Apply content protection setting on startup
    const enabled = storage.getContentProtection();
    if (enabled) {
      invoke("set_content_protection", { enabled });
    }
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
    if (typeof window === "undefined") {
      return;
    }

    // Dynamically resize window based on state
    const resizeWindow = () => {
      const baseWidth = 545;
      let baseHeight: number;

      // Both providers now have a footer
      const extraHeight = 40;
      const attachmentsHeight = attachments.length > 0 ? 80 : 0;

      if (!showInput) {
        // Pill mode - minimal height (even if chat exists)
        baseHeight = 60;
      } else if (hasExpanded) {
        // Chat history visible - full height
        baseHeight = 305 + extraHeight + attachmentsHeight;
      } else {
        // Just input visible - medium height
        baseHeight = 120 + extraHeight + attachmentsHeight;
      }

      const width = baseWidth * zoomLevel;
      const height = baseHeight * zoomLevel;

      // Only delay if we are closing the input (transitioning from true to false)
      const isClosing = prevShowInputRef.current && !showInput;
      const delay = isClosing ? 200 : 0;

      prevShowInputRef.current = showInput;

      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }

      const performResize = () => {
        const lastSize = lastWindowSizeRef.current;
        if (
          lastSize &&
          Math.abs(lastSize.width - width) < 0.5 &&
          Math.abs(lastSize.height - height) < 0.5
        ) {
          return;
        }

        lastWindowSizeRef.current = { width, height };

        void invoke("resize_window", { width, height }).catch((error) => {
          console.error("Window resize failed:", error);
        });
      };

      if (delay > 0) {
        resizeTimeoutRef.current = window.setTimeout(() => {
          performResize();
          resizeTimeoutRef.current = null;
        }, delay);
      } else {
        performResize();
      }
    };

    resizeWindow();

    return () => {
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
    };
  }, [showInput, hasExpanded, currentProvider, attachments.length, zoomLevel]);

  useEffect(() => {
    // Listen for global shortcut event from Rust backend
    const unlistenAsk = listen<boolean>("ask-triggered", (event) => {
      handleAsk(event.payload);
    });

    const unlistenScreenShare = listen("screen-share-triggered", () => {
      void handleScreenShareToggle();
    });

    const unlistenToggleWindow = listen("toggle-window-triggered", () => {
      handleToggleWindow();
    });

    return () => {
      unlistenAsk.then((fn) => fn());
      unlistenScreenShare.then((fn) => fn());
      unlistenToggleWindow.then((fn) => fn());
    };
  }, [showInput, isWindowVisible, isScreenShareEnabled]); // Re-create when visibility or screen share state changes

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

        // Check if the last user message has an attachment
        const lastUserMessage = messages.filter(m => m.type === 'user').pop();
        const hasAttachment = lastUserMessage?.screenshotIncluded || (lastUserMessage?.attachments && lastUserMessage.attachments.length > 0) || false;

        // Reduce spacer height if there's an attachment (30% instead of 50%)
        const spacerMultiplier = hasAttachment ? 0.3 : 0.5;
        const spacerHeight = Math.max(viewportHeight * spacerMultiplier, messageHeight + 20);
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
  }, [scrollTargetKey, messages]);
  const shouldShowResetButton = messages.length > 0 && showInput;

  const cycleReasoningEffort = () => {
    setReasoningEffort((prev) => {
      if (currentProvider === 'gemini' && geminiModel.includes('gemini-3-pro')) {
        return prev === 'low' ? 'high' : 'low';
      }
      if (prev === 'low') return 'medium';
      if (prev === 'medium') return 'high';
      return 'low';
    });
  };

  const currentModelId = currentProvider === 'openai' ? openaiModel : geminiModel;
  const currentModels = currentProvider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;
  const currentModelName = currentModels.find(m => m.id === currentModelId)?.name || currentModelId;

  useEffect(() => {
    // Ensure reasoning effort is valid for Gemini 3 Pro (only low/high)
    if (currentProvider === 'gemini' && geminiModel.includes('gemini-3-pro') && reasoningEffort === 'medium') {
      setReasoningEffort('low');
    }
  }, [currentProvider, geminiModel, reasoningEffort]);

  return (
    <div
      className={`app ${showInput ? "with-input" : ""} ${hasExpanded ? "chat-expanded" : ""}`}
      style={{ zoom: zoomLevel } as React.CSSProperties}
    >
      <UpdateChecker />
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
          onClick={() => setCurrentProvider(prev => prev === 'gemini' ? 'openai' : 'gemini')}
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
          onClick={handleAskButton}
        >
          <span className="action-label">Ask</span>
          <span className="keycap">{modKey}</span>
          <span className="keycap keycap-enter">↵</span>
        </button>

        <button
          className={`toolbar-segment toolbar-action screen-share-toggle ${isScreenShareEnabled ? "active" : ""} ${attachments.length > 0 ? "disabled" : ""}`}
          data-tauri-drag-region-disabled
          aria-label={`Screen share ${isScreenShareEnabled ? "on" : "off"}`}
          aria-pressed={isScreenShareEnabled}
          disabled={attachments.length > 0}
          onClick={() => {
            if (attachments.length === 0) {
              void handleScreenShareToggle();
            }
          }}
          title={
            attachments.length > 0
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
            aria-label="Menu"
            title="Settings"
            onClick={() => {
              void handleOpenSettings();
            }}
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
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="message-attachments">
                          {message.attachments.slice(0, 4).map((att, index) => (
                            <div key={index} className="message-attachment-item">
                              {att.mimeType.startsWith('image/') ? (
                                <div className="message-attachment-thumb">
                                  <img src={att.preview} alt={att.name} />
                                </div>
                              ) : (
                                <div className="message-attachment-file">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  <span className="file-name">{att.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {message.attachments.length > 4 && (
                            <div className="message-attachment-more">
                              +{message.attachments.length - 4}
                            </div>
                          )}
                        </div>
                      )}
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
                      {message.thought && (
                        <div className="thought-container">
                          <button
                            className="thought-toggle"
                            onClick={() => toggleThought(message.id)}
                          >
                            <span className="thought-label">
                              Thought for {message.thoughtDuration || 0} seconds
                            </span>
                            <svg
                              className={`thought-chevron ${expandedThoughts.has(message.id) ? 'expanded' : ''}`}
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <div className={`thought-content-wrapper ${expandedThoughts.has(message.id) ? 'expanded' : ''}`}>
                            <div className="thought-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {message.thought}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="ai-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {message.text}
                        </ReactMarkdown>
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="sources-container">
                          {message.sources.map((source, index) => (
                            <a
                              key={index}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-chip"
                            >
                              {(() => {
                                try {
                                  const urlObj = new URL(source.url);
                                  const hostname = urlObj.hostname.replace('www.', '');

                                  // Check if it's a proxy domain
                                  const isProxy = hostname.includes('vertexaisearch') || hostname.includes('googleusercontent');

                                  let displayTitle = source.title;
                                  let isTitleUrl = false;
                                  try {
                                    // Check if title is a URL
                                    if (displayTitle.startsWith('http://') || displayTitle.startsWith('https://')) {
                                      isTitleUrl = true;
                                    }
                                  } catch { }

                                  if (isTitleUrl) {
                                    // If title is a URL, try to extract something meaningful or hide it
                                    try {
                                      const titleUrlObj = new URL(displayTitle);
                                      const path = titleUrlObj.pathname;
                                      if (path && path !== '/' && path.length > 1) {
                                        // Use the last segment of the path as title
                                        const segments = path.split('/').filter(Boolean);
                                        if (segments.length > 0) {
                                          displayTitle = segments[segments.length - 1];
                                          // Decode it to make it readable
                                          displayTitle = decodeURIComponent(displayTitle).replace(/[-_]/g, ' ');
                                        } else {
                                          displayTitle = '';
                                        }
                                      } else {
                                        // Just domain, so hide title part
                                        displayTitle = '';
                                      }
                                    } catch {
                                      // If parsing fails, just hide it
                                      displayTitle = '';
                                    }
                                  }

                                  return (
                                    <>
                                      {!isProxy && <span className="source-domain">{hostname}</span>}
                                      {displayTitle && displayTitle !== hostname && (
                                        <>
                                          {!isProxy && <span className="source-divider">-</span>}
                                          <span className="source-title">{displayTitle}</span>
                                        </>
                                      )}
                                      {isProxy && !displayTitle && <span className="source-title">Source</span>}
                                    </>
                                  );
                                } catch (e) {
                                  return null;
                                }
                              })()}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="message-actions">
                        <button
                          type="button"
                          className={`ai-copy-button ${copiedMessageId === message.id ? "copied" : ""}`}
                          onClick={() => {
                            void copyMessage(message.id, message.text);
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
          {attachments.length > 0 && (
            <div className="attachments-area">
              {attachments.map((att) => (
                <div key={att.id} className="attachment-preview">
                  {att.mimeType.startsWith('image/') ? (
                    <img src={att.preview} alt="Attachment" />
                  ) : (
                    <div className="file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="file-ext">{att.file.name.split('.').pop()}</span>
                    </div>
                  )}
                  <button
                    className="remove-attachment"
                    onClick={() => setAttachments(prev => prev.filter(p => p.id !== att.id))}
                    aria-label="Remove attachment"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="input-area">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
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
                disabled={inputValue.trim() === "" && attachments.length === 0}
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
          <div className="input-footer">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
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
            {(currentProvider === 'openai' || (currentProvider === 'gemini' && geminiModel.includes('gemini-3-pro'))) ? (
              <button
                className={`reasoning-toggle effort-${reasoningEffort}`}
                onClick={cycleReasoningEffort}
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
            ) : (currentProvider === 'gemini') ? (
              <button
                className={`web-search-toggle ${isGeminiThinkingEnabled ? 'active' : ''}`}
                onClick={() => {
                  const newState = !isGeminiThinkingEnabled;
                  setIsGeminiThinkingEnabled(newState);
                }}
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
            ) : null}
            <button
              className={`web-search-toggle ${isWebSearchEnabled ? 'active' : ''}`}
              onClick={() => {
                const newValue = !isWebSearchEnabled;
                webSearchEnabledRef.current = newValue; // Update ref immediately
                setIsWebSearchEnabled(newValue);
              }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (currentProvider === 'openai') {
                    setOpenaiModel(val);
                  } else {
                    setGeminiModel(val);
                  }
                }}
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
            <span style={{ fontSize: '10px', opacity: 0.5, marginLeft: '8px', alignSelf: 'center' }}>v0.1.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
