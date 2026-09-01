"use client";

/** 3.4 Telemetry/analytics — privacy-first, opt-in, local-only. */
const TELEMETRY_KEY = "poolr.telemetry";
const CONSENT_KEY = "poolr.analyticsConsent";

export interface TelemetryEvent {
  timestamp: string;
  category: string;
  action: string;
  details?: Record<string, unknown>;
}

export interface TelemetryState {
  enabled: boolean;
  sessionStart: string;
  events: TelemetryEvent[];
}

function getState(): TelemetryState {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: false, sessionStart: new Date().toISOString(), events: [] };
}

function saveState(state: TelemetryState): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function isAnalyticsEnabled(): boolean {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setAnalyticsConsent(enabled: boolean): void {
  localStorage.setItem(CONSENT_KEY, enabled ? "true" : "false");
  const state = getState();
  state.enabled = enabled;
  saveState(state);
}

export function trackEvent(category: string, action: string, details?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;
  const state = getState();
  state.events.push({
    timestamp: new Date().toISOString(),
    category,
    action,
    details,
  });
  // Keep last 1000 events
  if (state.events.length > 1000) state.events = state.events.slice(-1000);
  saveState(state);
}

export function getTelemetryData(): TelemetryState {
  return getState();
}

export function exportTelemetry(): string {
  return JSON.stringify(getState(), null, 2);
}

export function clearTelemetry(): void {
  localStorage.removeItem(TELEMETRY_KEY);
}
