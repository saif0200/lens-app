import { useState, useRef, useCallback } from "react";

interface UseClipboardOptions {
  resetDelay?: number;
}

interface UseClipboardReturn<T extends string | number> {
  copiedId: T | null;
  copy: (id: T, text: string) => Promise<void>;
}

/**
 * Hook for managing clipboard copy operations with visual feedback
 * @param options - Configuration options
 * @param options.resetDelay - Time in ms before resetting the copied state (default: 800)
 */
export function useClipboard<T extends string | number>(
  options: UseClipboardOptions = {}
): UseClipboardReturn<T> {
  const { resetDelay = 800 } = options;
  const [copiedId, setCopiedId] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(async (id: T, text: string) => {
    if (!navigator.clipboard) {
      console.warn("Clipboard API not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
        timerRef.current = null;
      }, resetDelay);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, [resetDelay]);

  return { copiedId, copy };
}
