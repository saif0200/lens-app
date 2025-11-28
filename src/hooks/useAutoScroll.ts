import { useEffect, useRef } from "react";
import type { Message } from "../types";

interface UseAutoScrollOptions {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function useAutoScroll(options: UseAutoScrollOptions): void {
  const { messages, messagesEndRef } = options;
  const lastScrollKeyRef = useRef<string | null>(null);

  const scrollTargetMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const scrollTargetKey = scrollTargetMessage
    ? JSON.stringify([
        scrollTargetMessage.id,
        scrollTargetMessage.type,
        scrollTargetMessage.type === "ai" ? scrollTargetMessage.text : null,
      ])
    : null;

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
      const messagesContainer = node.parentElement;
      if (messagesContainer) {
        const lastAiMessage = messagesContainer.querySelector('.message-ai:last-of-type');
        const viewportHeight = messagesContainer.clientHeight;
        const messageHeight = lastAiMessage ? lastAiMessage.scrollHeight : 0;

        const lastUserMessage = messages.filter(m => m.type === 'user').pop();
        const hasAttachment = lastUserMessage?.screenshotIncluded || (lastUserMessage?.attachments && lastUserMessage.attachments.length > 0) || false;

        const spacerMultiplier = hasAttachment ? 0.3 : 0.5;
        const spacerHeight = Math.max(viewportHeight * spacerMultiplier, messageHeight + 20);
        node.style.minHeight = `${spacerHeight}px`;
      }

      if (scrollTargetMessage?.type !== "ai") {
        node.scrollIntoView({
          behavior: scrollTargetMessage?.type === "typing" ? "smooth" : "auto",
          block: "end",
          inline: "nearest"
        });
      }
    });
  }, [scrollTargetKey, messages, messagesEndRef, scrollTargetMessage]);
}
