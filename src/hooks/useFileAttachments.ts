import { useState, useRef, useCallback } from "react";

export interface Attachment {
  id: string;
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
  text?: string;
}

interface UseFileAttachmentsReturn {
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  processFile: (file: File) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export function useFileAttachments(
  onAttachmentAdded?: () => void
): UseFileAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const isText = file.type.startsWith('text/') ||
                   /\.(js|jsx|ts|tsx|json|md|css|html|xml|yml|yaml|py|rb|java|c|cpp|h|rs|go|php|txt|sh|bat|ps1)$/i.test(file.name);

    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();

    if (isText) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const base64 = btoa(unescape(encodeURIComponent(text)));

        const newAttachment: Attachment = {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file,
          preview: '',
          base64,
          mimeType: file.type || 'text/plain',
          text
        };

        setAttachments(prev => [...prev, newAttachment]);
        onAttachmentAdded?.();
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        const newAttachment: Attachment = {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file,
          preview: isImage ? result : '',
          base64,
          mimeType: file.type || 'application/octet-stream'
        };

        setAttachments(prev => [...prev, newAttachment]);
        onAttachmentAdded?.();
      };
      reader.readAsDataURL(file);
    }
  }, [onAttachmentAdded]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => processFile(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      Array.from(e.clipboardData.files).forEach(file => processFile(file));
      e.preventDefault();
    }
  }, [processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    setAttachments,
    fileInputRef,
    processFile,
    handleFileSelect,
    handlePaste,
    removeAttachment,
    clearAttachments,
  };
}
