import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/** 1.3 Color blindness mode + 1.4 Auto dark/light schedule */

type ColorBlindMode = "none" | "protanopia" | "deuteranopia" | "tritanopia";
type Theme = "light" | "dark";

const CB_KEY = "poolr.colorBlindMode";
const SCHEDULE_KEY = "poolr.themeSchedule";

export interface ThemeSchedule {
  autoSwitch: boolean;
  sunriseHour: number;
  sunriseMinute: number;
  sunsetHour: number;
  sunsetMinute: number;
}

function readCB(): ColorBlindMode {
  return (localStorage.getItem(CB_KEY) as ColorBlindMode) ?? "none";
}

function readSchedule(): ThemeSchedule {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { autoSwitch: false, sunriseHour: 7, sunriseMinute: 0, sunsetHour: 19, sunsetMinute: 0 };
}

export function applyColorBlindClass(mode: ColorBlindMode): void {
  document.documentElement.classList.remove("colorblind-protanopia", "colorblind-deuteranopia", "colorblind-tritanopia");
  if (mode !== "none") {
    document.documentElement.classList.add(`colorblind-${mode}`);
  }
}

export function getThemeForSchedule(schedule: ThemeSchedule): Theme {
  if (!schedule.autoSwitch) return "dark";
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const sunrise = schedule.sunriseHour * 60 + schedule.sunriseMinute;
  const sunset = schedule.sunsetHour * 60 + schedule.sunsetMinute;
  return minutes >= sunrise && minutes < sunset ? "light" : "dark";
}

export function useColorBlind() {
  const [mode, setMode] = useState<ColorBlindMode>(readCB);
  useEffect(() => { applyColorBlindClass(mode); localStorage.setItem(CB_KEY, mode); }, [mode]);
  return { mode, setMode };
}

export function useAutoTheme(): Theme | null {
  const [autoTheme, setAutoTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const schedule = readSchedule();
    if (!schedule.autoSwitch) return;
    const check = () => setAutoTheme(getThemeForSchedule(schedule));
    check();
    const interval = setInterval(check, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return autoTheme;
}

export function ColorBlindProvider({ children }: { children: ReactNode }) {
  useEffect(() => { applyColorBlindClass(readCB()); }, []);
  return children;
}
