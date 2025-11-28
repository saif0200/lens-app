import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

interface UseWindowOptions {
  showInput: boolean;
  hasExpanded: boolean;
  attachmentsCount: number;
  zoomLevel: number;
}

interface UseWindowReturn {
  isWindowVisible: boolean;
  isAnimating: boolean;
  handleToggleWindow: () => void;
  handleOpenSettings: (options?: { avoidMainWindow?: boolean }) => Promise<void>;
}

export function useWindow(options: UseWindowOptions): UseWindowReturn {
  const { showInput, hasExpanded, attachmentsCount, zoomLevel } = options;
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const isAnimatingRef = useRef(false);
  const prevShowInputRef = useRef(showInput);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastWindowSizeRef = useRef<{ width: number; height: number } | null>(null);

  const handleToggleWindow = () => {
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    invoke("toggle_window");

    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 300);
  };

  const handleOpenSettings = async (settingsOptions?: { avoidMainWindow?: boolean }) => {
    const avoidMainWindow = settingsOptions?.avoidMainWindow ?? false;
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
        console.error("Error creating settings window", e);
      });
    } catch (error) {
      console.error("Error opening settings window", error);
    }
  };

  // Listen for window visibility events
  useEffect(() => {
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

  // Window resize logic
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const resizeWindow = () => {
      const baseWidth = 545;
      let baseHeight: number;

      const extraHeight = 40;
      const attachmentsHeight = attachmentsCount > 0 ? 80 : 0;

      if (!showInput) {
        baseHeight = 60;
      } else if (hasExpanded) {
        baseHeight = 305 + extraHeight + attachmentsHeight;
      } else {
        baseHeight = 120 + extraHeight + attachmentsHeight;
      }

      const width = baseWidth * zoomLevel;
      const height = baseHeight * zoomLevel;

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
  }, [showInput, hasExpanded, attachmentsCount, zoomLevel]);

  return {
    isWindowVisible,
    isAnimating: isAnimatingRef.current,
    handleToggleWindow,
    handleOpenSettings,
  };
}
