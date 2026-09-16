// Auto-updater: checks GitHub daily, asks user before downloading/installing.
import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from './version';
import { loadSettings, saveSettings } from './settings';

export interface UpdateInfo {
  available: boolean;
  version: string;
  body?: string;
  date?: string;
}

// Tauri updater JS API
declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      updater: {
        check: () => Promise<{ shouldUpdate: boolean; manifest?: { version: string; body?: string; date?: string } }>;
        downloadAndInstall: () => Promise<void>;
      };
    };
  }
}

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const tauri = window.__TAURI_INTERNALS__;
      if (!tauri?.updater) {
        setUpdateInfo({ available: false, version: APP_VERSION });
        return;
      }
      const result = await tauri.updater.check();
      setUpdateInfo({
        available: result.shouldUpdate,
        version: result.manifest?.version ?? APP_VERSION,
        body: result.manifest?.body,
        date: result.manifest?.date,
      });
      // Persist last check time
      const settings = loadSettings();
      settings.lastUpdateCheck = new Date().toISOString();
      saveSettings(settings);
    } catch (e) {
      console.warn('Update check failed:', e);
      setUpdateInfo({ available: false, version: APP_VERSION });
    } finally {
      setChecking(false);
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    try {
      await window.__TAURI_INTERNALS__?.updater.downloadAndInstall();
    } catch (e) {
      console.error('Download failed:', e);
    }
  }, []);

  // Check on mount if auto-update is enabled
  useEffect(() => {
    const settings = loadSettings();
    if (settings.autoUpdateEnabled !== false) {
      checkForUpdates();
    }
    // Daily interval
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return { updateInfo, checking, checkForUpdates, downloadUpdate };
}
