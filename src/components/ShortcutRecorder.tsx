import { useState, useEffect, useRef } from 'react';

interface ShortcutRecorderProps {
    value: string;
    onChange: (value: string) => Promise<boolean>;
    disabled?: boolean;
}

const MODIFIER_MAP: Record<string, string> = {
    'Control': 'Ctrl',
    'Meta': 'Command',
    'Shift': 'Shift',
    'Alt': 'Alt',
    'CommandOrControl': '⌘',
    'Super': '⌘',
    'Command': '⌘',
};

// Map weird key namings to something readable
const KEY_DISPLAY_MAP: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Backspace': '⌫',
    'Escape': 'Esc',
    'Delete': 'Del',
    'Tab': '⇥',
    'CapsLock': 'Caps',
    'PageUp': 'PgUp',
    'PageDown': 'PgDn',
    'Home': 'Home',
    'End': 'End',
    'Insert': 'Ins',
};

export function ShortcutRecorder({ value, onChange, disabled }: ShortcutRecorderProps) {
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState(false);
    // currentCombo stores standard JS key names: 'Meta', 'Shift', 'a', 'ENTER'
    const [currentCombo, setCurrentCombo] = useState<Set<string>>(new Set());
    const inputRef = useRef<HTMLDivElement>(null);

    // Parse value string (e.g. "CommandOrControl+Shift+T") into explicit keys for display
    const getDisplayKeys = (shortcutStr: string): string[] => {
        if (!shortcutStr) return [];
        return shortcutStr.split('+');
    };

    // Use refs to keep track of current keys without stale closures in event listeners
    const comboRef = useRef<Set<string>>(new Set());

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();

        // Cancel on Escape
        if (e.key === 'Escape') {
            setRecording(false);
            setCurrentCombo(new Set());
            comboRef.current = new Set();
            return;
        }

        const newCombo = new Set(comboRef.current);

        // Normalize key
        let key = e.key;

        const isMac = navigator.platform.toUpperCase().includes('MAC');

        if (isMac) {
            if (key === 'Meta') newCombo.add('CommandOrControl');
            else if (key === 'Control') newCombo.add('Control');
            else if (key === 'Alt') newCombo.add('Alt');
            else if (key === 'Shift') newCombo.add('Shift');
            else {
                if (key.length === 1) key = key.toUpperCase();
                newCombo.add(key);
            }
        } else {
            // Windows/Linux
            if (key === 'Control') newCombo.add('CommandOrControl');
            else if (key === 'Meta') newCombo.add('Super');
            else if (key === 'Alt') newCombo.add('Alt');
            else if (key === 'Shift') newCombo.add('Shift');
            else {
                if (key.length === 1) key = key.toUpperCase();
                newCombo.add(key);
            }
        }

        comboRef.current = newCombo;
        setCurrentCombo(newCombo);
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') return;

        const keys = Array.from(comboRef.current);
        const modifiers = keys.filter(k => ['CommandOrControl', 'Alt', 'Shift', 'Super', 'Command', 'Control', 'Meta'].includes(k));
        const nonModifiers = keys.filter(k => !modifiers.includes(k));

        if (nonModifiers.length > 0) {
            // Unify modifiers
            const uniqueMods = Array.from(new Set(modifiers));

            // Sort modifiers: Ctrl/Cmd > Alt > Shift
            uniqueMods.sort((a, b) => {
                const order: Record<string, number> = {
                    'CommandOrControl': 0,
                    'Command': 0,
                    'Meta': 0,
                    'Super': 0,
                    'Control': 0,
                    'Ctrl': 0,
                    'Alt': 1,
                    'Shift': 2
                };
                return (order[a] ?? 9) - (order[b] ?? 9);
            });

            const finalString = [...uniqueMods, ...nonModifiers].join('+');

            setRecording(false);
            try {
                const success = await onChange(finalString);
                if (!success) {
                    setError(true);
                    setTimeout(() => setError(false), 1000);
                }
            } catch (err) {
                console.error(err);
                setError(true);
                setTimeout(() => setError(false), 1000);
            }
            // Reset
            comboRef.current = new Set();
            setCurrentCombo(new Set());
        } else {
            // Modifiers released - remove from set
            const newCombo = new Set(comboRef.current);
            if (e.key === 'Shift') newCombo.delete('Shift');
            if (e.key === 'Alt') newCombo.delete('Alt');
            if (e.key === 'Meta' || e.key === 'Control') {
                // We need to be careful what we delete.
                // We added specific things in handleKeyDown.
                // It's safer to just clear modifiers if we are confused,
                // but let's try to match logic.
                newCombo.delete('CommandOrControl');
                newCombo.delete('Control');
                newCombo.delete('Meta');
                newCombo.delete('Super');
            }

            comboRef.current = newCombo;
            setCurrentCombo(newCombo);
        }
    };

    useEffect(() => {
        if (recording) {
            // Reset state on start
            comboRef.current = new Set();
            setCurrentCombo(new Set());
            setError(false);

            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
            };
        }
    }, [recording]);

    const renderKey = (key: string) => {
        // Beautify key for display
        let display = key;
        const isMac = navigator.platform.toUpperCase().includes('MAC');

        // Handle mapped display names
        if (KEY_DISPLAY_MAP[key]) {
            display = KEY_DISPLAY_MAP[key];
        } else if (key === 'CommandOrControl') {
            display = isMac ? '⌘' : 'Ctrl';
        } else if (MODIFIER_MAP[key]) {
            display = MODIFIER_MAP[key];
        } else {
            // Capitalize simple letters
            if (display.length === 1) display = display.toUpperCase();
        }

        return <kbd className="key-cap">{display}</kbd>;
    };

    const keysToRender = recording
        ? Array.from(currentCombo)
        : getDisplayKeys(value);

    // Sort keys for display: Modifiers first
    keysToRender.sort((a, b) => {
        const isModA = ['CommandOrControl', 'Alt', 'Shift', 'Command', 'Control', 'Meta', 'Super'].includes(a);
        const isModB = ['CommandOrControl', 'Alt', 'Shift', 'Command', 'Control', 'Meta', 'Super'].includes(b);
        if (isModA && !isModB) return -1;
        if (!isModA && isModB) return 1;
        return 0; // Keep relative order otherwise
    });

    return (
        <div
            className={`shortcut-recorder ${recording ? 'recording' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => {
                if (!disabled && !recording) {
                    setRecording(true);
                    inputRef.current?.focus();
                }
            }}
            ref={inputRef}
            tabIndex={0}
            onBlur={() => {
                if (recording) setRecording(false);
            }}
        >
            {/* If recording and empty, show "Press keys..." */}
            {recording && keysToRender.length === 0 && (
                <span className="shortcut-placeholder">Press keys...</span>
            )}

            {/* Render keys */}
            {(keysToRender.length > 0) && (
                <div className="shortcut-keys">
                    {keysToRender.map((k, i) => (
                        <span key={`${k}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                            {renderKey(k)}
                            {i < keysToRender.length - 1 && <span style={{ margin: '0 2px', opacity: 0.5 }}>+</span>}
                        </span>
                    ))}
                </div>
            )}

            {/* If not recording and empty, show placeholder */}
            {!recording && keysToRender.length === 0 && (
                <span className="shortcut-placeholder">Click to record</span>
            )}
        </div>
    );
}
