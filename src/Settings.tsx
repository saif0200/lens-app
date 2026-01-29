import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./styles/index.css";
import { storage } from "./services/storage";
import { ShortcutRecorder } from "./components/ShortcutRecorder";
import { useAutoUpdate } from "./hooks/useAutoUpdate";

interface Shortcuts {
  toggle: string;
  ask: string;
  screen_share: string;
}

function Settings() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [contentProtection, setContentProtection] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcuts>({ toggle: '', ask: '', screen_share: '' });
  const [saved, setSaved] = useState(false);

  const {
    checking,
    available,
    info,
    downloading,
    progress,
    checkForUpdates,
    downloadAndInstall
  } = useAutoUpdate(true);

  useEffect(() => {
    const storedOpenaiKey = storage.getOpenAIKey();
    const storedGeminiKey = storage.getGeminiKey();
    const storedContentProtection = storage.getContentProtection();

    if (storedOpenaiKey) setOpenaiKey(storedOpenaiKey);
    if (storedGeminiKey) setGeminiKey(storedGeminiKey);
    if (storedContentProtection) {
      setContentProtection(true);
      invoke("set_content_protection", { enabled: true });
    } else {
      // If content protection was not stored as true, ensure it's off
      invoke("set_content_protection", { enabled: false });
    }

    invoke<Shortcuts>('get_shortcuts').then(setShortcuts).catch(console.error);
  }, []);

  // No changes needed for handleSave implementation itself, just logic inside
  const handleSave = async () => {
    // 1. Save API Keys
    if (openaiKey) {
      storage.setOpenAIKey(openaiKey);
    } else {
      storage.removeOpenAIKey();
    }

    if (geminiKey) {
      storage.setGeminiKey(geminiKey);
    } else {
      storage.removeGeminiKey();
    }

    // 2. Save Content Protection
    storage.setContentProtection(contentProtection);
    invoke("set_content_protection", { enabled: contentProtection });

    // 3. Save Shortcuts
    try {
      await invoke('set_shortcuts', { newShortcuts: shortcuts });
    } catch (e) {
      console.error("Failed to save shortcuts:", e);
      // Show error to user?
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };


  const handleShortcutChange = async (action: string, newValue: string): Promise<boolean> => {
    // Basic conflict check in frontend
    const isConflict = Object.entries(shortcuts).some(([key, val]) => {
      if (key === action) return false;
      return val === newValue;
    });

    if (isConflict) {
      console.warn("Shortcut conflict detected in frontend");
      return false;
    }

    setShortcuts(prev => ({ ...prev, [action]: newValue }));
    return true;
  };

  return (
    <div className="settings-container">
      <div className="settings-drag-handle" data-tauri-drag-region />
      <h2 className="settings-header">Settings</h2>

      <div className="settings-section">
        <label className="settings-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span>Invisible to Screen Capture</span>
          <input
            type="checkbox"
            checked={contentProtection}
            onChange={(e) => setContentProtection(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
        </label>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          When enabled, the app window will be invisible in screenshots and screen sharing.
        </p>
      </div>



      <div className="settings-section">
        <label className="settings-label">Shortcuts</label>
        <div className="settings-shortcuts-list">
          <div className="shortcut-item">
            <span>Toggle Window</span>
            <ShortcutRecorder
              value={shortcuts.toggle}
              onChange={(val) => handleShortcutChange('toggle', val)}
            />
          </div>
          <div className="shortcut-item">
            <span>Ask AI</span>
            <ShortcutRecorder
              value={shortcuts.ask}
              onChange={(val) => handleShortcutChange('ask', val)}
            />
          </div>
          <div className="shortcut-item">
            <span>Screen Share</span>
            <ShortcutRecorder
              value={shortcuts.screen_share}
              onChange={(val) => handleShortcutChange('screen_share', val)}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <label className="settings-label">App Updates</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {checking ? 'Checking for updates...' :
                available ? `New version available: ${info?.version}` :
                  downloading ? `Downloading... ${progress}%` :
                    'App is up to date'}
            </span>
            {available ? (
              <button
                className="settings-button success"
                onClick={downloadAndInstall}
                disabled={downloading}
                style={{ width: 'auto', minWidth: '120px', height: '32px', padding: '0 10px', fontSize: '13px' }}
              >
                {downloading ? `${progress}%` : 'Update & Restart'}
              </button>
            ) : (
              <button
                className="settings-button"
                onClick={checkForUpdates}
                disabled={checking}
                style={{ width: 'auto', minWidth: '120px', height: '32px', padding: '0 10px', fontSize: '13px' }}
              >
                Check
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button
          onClick={handleSave}
          className={`settings-button ${saved ? "success" : ""}`}
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
