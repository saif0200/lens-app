import { useState, useEffect } from "react";
import "./App.css";

function Settings() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedOpenaiKey = localStorage.getItem("openai_api_key");
    const storedGeminiKey = localStorage.getItem("gemini_api_key");
    if (storedOpenaiKey) setOpenaiKey(storedOpenaiKey);
    if (storedGeminiKey) setGeminiKey(storedGeminiKey);
  }, []);

  const handleSave = () => {
    if (openaiKey) {
      localStorage.setItem("openai_api_key", openaiKey);
    } else {
      localStorage.removeItem("openai_api_key");
    }

    if (geminiKey) {
      localStorage.setItem("gemini_api_key", geminiKey);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = (keyType: 'openai' | 'gemini') => {
    if (keyType === 'openai') {
      setOpenaiKey("");
      localStorage.removeItem("openai_api_key");
    } else {
      setGeminiKey("");
      localStorage.removeItem("gemini_api_key");
    }
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
