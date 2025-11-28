import { useState, useEffect, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  body: string | null;
}

interface UpdateState {
  checking: boolean;
  available: boolean;
  info: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  error: string | null;
}

export function useAutoUpdate(checkOnMount = true, checkIntervalMs = 3600000) {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    available: false,
    info: null,
    downloading: false,
    progress: 0,
    error: null,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState(prev => ({ ...prev, checking: true, error: null }));

    try {
      const result = await check();

      if (result) {
        setUpdate(result);
        setState(prev => ({
          ...prev,
          checking: false,
          available: true,
          info: {
            version: result.version,
            body: result.body ?? null,
          },
        }));
        return true;
      } else {
        setState(prev => ({
          ...prev,
          checking: false,
          available: false,
          info: null,
        }));
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check for updates';
      setState(prev => ({
        ...prev,
        checking: false,
        error: errorMsg,
      }));
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) {
      setState(prev => ({ ...prev, error: 'No update available' }));
      return;
    }

    setState(prev => ({ ...prev, downloading: true, progress: 0, error: null }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const progress = Math.round((downloaded / contentLength) * 100);
              setState(prev => ({ ...prev, progress }));
            }
            break;
          case 'Finished':
            setState(prev => ({ ...prev, progress: 100 }));
            break;
        }
      });

      // Relaunch the app after successful install
      await relaunch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to install update';
      setState(prev => ({
        ...prev,
        downloading: false,
        error: errorMsg,
      }));
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({
      ...prev,
      available: false,
      info: null,
    }));
    setUpdate(null);
  }, []);

  // Check for updates on mount
  useEffect(() => {
    if (checkOnMount) {
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates]);

  // Periodic update checks
  useEffect(() => {
    if (checkIntervalMs <= 0) return;

    const interval = setInterval(checkForUpdates, checkIntervalMs);
    return () => clearInterval(interval);
  }, [checkIntervalMs, checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
