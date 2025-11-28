import { useAutoUpdate, UpdateInfo } from '../hooks/useAutoUpdate';

interface UpdatePopupProps {
  info: UpdateInfo;
  downloading: boolean;
  progress: number;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdatePopup({ info, downloading, progress, onInstall, onDismiss }: UpdatePopupProps) {
  return (
    <div className="update-popup-overlay">
      <div className="update-popup">
        <div className="update-popup-header">
          <span className="update-icon">🔄</span>
          <h3>Update Available</h3>
        </div>

        <div className="update-popup-content">
          <p className="update-version">Version {info.version} is ready to install</p>
          {info.body && (
            <div className="update-notes">
              <p className="update-notes-label">What's new:</p>
              <p className="update-notes-content">{info.body}</p>
            </div>
          )}
        </div>

        {downloading ? (
          <div className="update-progress">
            <div className="update-progress-bar">
              <div
                className="update-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="update-progress-text">
              {progress < 100 ? `Downloading... ${progress}%` : 'Installing...'}
            </span>
          </div>
        ) : (
          <div className="update-popup-actions">
            <button className="update-btn-later" onClick={onDismiss}>
              Later
            </button>
            <button className="update-btn-install" onClick={onInstall}>
              Install & Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component that manages its own state
export function UpdateChecker() {
  const { available, info, downloading, progress, downloadAndInstall, dismissUpdate } = useAutoUpdate();

  if (!available || !info) {
    return null;
  }

  return (
    <UpdatePopup
      info={info}
      downloading={downloading}
      progress={progress}
      onInstall={downloadAndInstall}
      onDismiss={dismissUpdate}
    />
  );
}
