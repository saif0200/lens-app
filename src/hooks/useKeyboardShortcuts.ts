import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

interface UseKeyboardShortcutsOptions {
  showInput: boolean;
  isWindowVisible: boolean;
  isScreenShareEnabled: boolean;
  messagesLength: number;
  onAsk: (forcedFocus?: boolean) => void;
  onToggleWindow: () => void;
  onScreenShareToggle: () => void;
  onResetChat: () => void;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    showInput,
    isWindowVisible,
    isScreenShareEnabled,
    messagesLength,
    onAsk,
    onToggleWindow,
    onScreenShareToggle,
    onResetChat,
    setZoomLevel,
  } = options;

  const lastFocusTimeRef = useRef(0);

  // Zoom keyboard shortcuts
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
  }, [setZoomLevel]);

  // Track window focus
  useEffect(() => {
    const handleFocus = () => {
      lastFocusTimeRef.current = Date.now();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Global shortcut listeners from Rust backend
  useEffect(() => {
    const unlistenAsk = listen<boolean>("ask-triggered", (event) => {
      onAsk(event.payload);
    });

    const unlistenScreenShare = listen("screen-share-triggered", () => {
      void onScreenShareToggle();
    });

    const unlistenToggleWindow = listen("toggle-window-triggered", () => {
      onToggleWindow();
    });

    return () => {
      unlistenAsk.then((fn) => fn());
      unlistenScreenShare.then((fn) => fn());
      unlistenToggleWindow.then((fn) => fn());
    };
  }, [showInput, isWindowVisible, isScreenShareEnabled, onAsk, onToggleWindow, onScreenShareToggle]);

  // ESC key to reset chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && messagesLength > 0 && showInput) {
        onResetChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messagesLength, showInput, onResetChat]);
}
