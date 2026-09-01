"use client";

/** 3.2 Crash reporting — captures unhandled errors, stores locally, offers send. */
const CRASH_LOG_KEY = "poolr.crashLogs";
const MAX_CRASH_LOGS = 50;

export interface CrashEntry {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  version: string;
}

export function logCrash(error: Error, componentStack?: string): void {
  const entry: CrashEntry = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    componentStack,
    version: "0.5.7",
  };

  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    const logs: CrashEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    if (logs.length > MAX_CRASH_LOGS) logs.length = MAX_CRASH_LOGS;
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(logs));
  } catch {
    /* storage full or unavailable — silently drop */
  }
}

export function getCrashLogs(): CrashEntry[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearCrashLogs(): void {
  localStorage.removeItem(CRASH_LOG_KEY);
}

export function sendCrashReport(entry: CrashEntry, includeProjectData: boolean): Promise<boolean> {
  // Stub: would POST to crash reporter endpoint
  // For now, just save to localStorage as "sent"
  return new Promise((resolve) => {
    try {
      const sent = JSON.parse(localStorage.getItem("poolr.sentCrashes") || "[]");
      sent.push({ ...entry, includeProjectData, sentAt: new Date().toISOString() });
      localStorage.setItem("poolr.sentCrashes", JSON.stringify(sent));
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}
