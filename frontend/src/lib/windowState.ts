"use client";

/** 1.8 Window size memory — saves/restores window position and size. */
import { useState, useEffect } from "react";

const WINDOW_KEY = "poolr.windowSize";

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export function saveWindowState(state: WindowState): void {
  try {
    localStorage.setItem(WINDOW_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function loadWindowState(): WindowState | null {
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function useWindowState() {
  const [state, setState] = useState<WindowState | null>(null);

  useEffect(() => {
    const saved = loadWindowState();
    if (saved) {
      setState(saved);
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        // @ts-ignore
        const appWindow = window.__TAURI__?.appWindow;
        if (appWindow && !saved.maximized) {
          appWindow.setSize({ width: saved.width, height: saved.height }).catch(() => {});
          appWindow.setPosition({ x: saved.x, y: saved.y }).catch(() => {});
        }
      }
    }

    const handler = () => {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        // @ts-ignore
        const appWindow = window.__TAURI__?.appWindow;
        if (appWindow) {
          appWindow.outerSize().then((size: any) => appWindow.outerPosition().then((pos: any) => {
            saveWindowState({ x: pos.x, y: pos.y, width: size.width, height: size.height, maximized: false });
          })).catch(() => {});
        }
      }
    };

    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return state;
}
