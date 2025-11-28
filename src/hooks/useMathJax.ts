import { useEffect } from "react";
import type { Message } from "../types";

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

interface UseMathJaxOptions {
  messages: Message[];
}

export function useMathJax(options: UseMathJaxOptions): void {
  const { messages } = options;

  // Initial MathJax setup
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

  // Re-typeset when AI messages are added
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
}
