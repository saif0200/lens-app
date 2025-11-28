import type { Attachment } from "../hooks/useFileAttachments";

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div className="attachment-preview">
      {attachment.mimeType.startsWith('image/') ? (
        <img src={attachment.preview} alt="Attachment" />
      ) : (
        <div className="file-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="file-ext">{attachment.file.name.split('.').pop()}</span>
        </div>
      )}
      <button
        className="remove-attachment"
        onClick={() => onRemove(attachment.id)}
        aria-label="Remove attachment"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

interface AttachmentsAreaProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function AttachmentsArea({ attachments, onRemove }: AttachmentsAreaProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachments-area">
      {attachments.map((att) => (
        <AttachmentPreview key={att.id} attachment={att} onRemove={onRemove} />
      ))}
    </div>
  );
}
