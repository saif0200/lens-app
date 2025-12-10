import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./styles/index.css";
import { storage } from "./services/storage";
import { ShortcutRecorder } from "./components/ShortcutRecorder";

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

  const handleClear = (keyType: 'openai' | 'gemini') => {
    if (keyType === 'openai') {
      setOpenaiKey("");
      storage.removeOpenAIKey();
    } else {
      setGeminiKey("");
      storage.removeGeminiKey();
    }
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
        <label className="settings-label">OpenAI API Key</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="settings-input"
          />
          <button
            onClick={() => handleClear('openai')}
            className="settings-button"
            style={{ width: 'auto', padding: '0 12px', whiteSpace: 'nowrap' }}
            title="Clear API Key"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="settings-section">
        <label className="settings-label">Gemini API Key</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className="settings-input"
          />
          <button
            onClick={() => handleClear('gemini')}
            className="settings-button"
            style={{ width: 'auto', padding: '0 12px', whiteSpace: 'nowrap' }}
            title="Clear API Key"
          >
            Clear
          </button>
        </div>
      </div>

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
