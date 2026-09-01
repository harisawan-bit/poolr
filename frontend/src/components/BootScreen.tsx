"use client";

/**
 * poolr BootScreen — system check splash replacing the old "Hello" greeting.
 * Shows an animated logo + a live checklist of startup checks, then hands off
 * to the app (or ProfileSetup on first run). Reduced-motion safe.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, WifiOff } from "lucide-react";
import { engineHealth } from "../lib/api";

type CheckStatus = "pending" | "ok" | "warn";

interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
}

const INITIAL_CHECKS: CheckItem[] = [
  { id: "engine", label: "Engine status", status: "pending" },
  { id: "storage", label: "Local storage", status: "pending" },
  { id: "project", label: "Project data", status: "pending" },
  { id: "ai", label: "AI providers", status: "pending" },
  { id: "theme", label: "Theme loaded", status: "pending" },
];

const MIN_DURATION_MS = 2500;

interface BootScreenProps {
  /** Called once all checks finish and the ready state has been shown. */
  onFinish?: () => void;
}

export default function BootScreen({ onFinish }: BootScreenProps) {
  const reduced = useReducedMotion();
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [ready, setReady] = useState(false);
  const [engineOnline, setEngineOnline] = useState<boolean | null>(null);
  const finishedRef = useRef(false);

  // Run all checks in parallel on mount.
  useEffect(() => {
    let alive = true;
    const start = Date.now();

    const finishIfDone = (next: CheckItem[]) => {
      if (!alive) return;
      const elapsed = Date.now() - start;
      const allDone = next.every((c) => c.status !== "pending");
      if (allDone && elapsed >= MIN_DURATION_MS) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          setReady(true);
          // Brief pause on "Ready" before handing off.
          setTimeout(() => { if (alive) onFinish?.(); }, reduced ? 50 : 600);
        }
      } else if (allDone) {
        // All checks done but minimum not reached — wait out the remainder.
        const remaining = MIN_DURATION_MS - elapsed;
        setTimeout(() => {
          if (!alive || finishedRef.current) return;
          finishedRef.current = true;
          setReady(true);
          setTimeout(() => { if (alive) onFinish?.(); }, reduced ? 50 : 600);
        }, remaining);
      }
    };

    const updateCheck = (id: string, status: CheckStatus) => {
      setChecks((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, status } : c));
        finishIfDone(next);
        return next;
      });
    };

    // 1) Engine status — real health check.
    engineHealth()
      .then((ok: boolean) => {
        if (!alive) return;
        setEngineOnline(ok);
        updateCheck("engine", ok ? "ok" : "warn");
      })
      .catch(() => { if (alive) updateCheck("engine", "warn"); });

    // 2) Local storage — verify we can read/write.
    try {
      const probe = "__poolr_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      // Slight delay so the spinner is visible.
      setTimeout(() => alive && updateCheck("storage", "ok"), reduced ? 50 : 200);
    } catch {
      updateCheck("storage", "warn");
    }

    // 3) Project data — check for a stored last-project path.
    try {
      const last = localStorage.getItem("poolr.lastProjectPath");
      setTimeout(() => alive && updateCheck("project", last ? "ok" : "warn"), reduced ? 50 : 350);
    } catch {
      updateCheck("project", "warn");
    }

    // 4) AI providers — no live ping; just confirm config key is readable.
    try {
      const providers = localStorage.getItem("poolr.aiProviders");
      setTimeout(() => alive && updateCheck("ai", providers ? "ok" : "warn"), reduced ? 50 : 480);
    } catch {
      updateCheck("ai", "warn");
    }

    // 5) Theme loaded — class is applied by ThemeProvider before this mounts.
    const themeClass = document.documentElement.classList.contains("dark") ||
      !document.documentElement.classList.contains("dark");
    setTimeout(() => alive && updateCheck("theme", themeClass ? "ok" : "warn"), reduced ? 50 : 580);

    // Safety: if checks never all resolve, force-finish at 4s.
    const safety = setTimeout(() => {
      if (!alive || finishedRef.current) return;
      finishedRef.current = true;
      setChecks((prev) => prev.map((c) => c.status === "pending" ? { ...c, status: "warn" } : c));
      setReady(true);
      setTimeout(() => { if (alive) onFinish?.(); }, reduced ? 50 : 600);
    }, 4000);

    return () => { alive = false; clearTimeout(safety); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDone = checks.every((c) => c.status !== "pending");

  const statusIcon = useCallback((status: CheckStatus) => {
    if (status === "pending") {
      return (
        <Loader2
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin text-[var(--color-text-muted)]"
        />
      );
    }
    return (
      <Check
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${status === "ok" ? "text-[var(--color-include)]" : "text-[var(--color-unsure)]"}`}
      />
    );
  }, []);

  return (
    <section
      aria-label="poolr system check"
      className="flex flex-col items-center justify-center gap-6 py-10"
    >
      {/* Animated logo */}
      <motion.div
        animate={
          reduced
            ? {}
            : {
                scale: [1, 1.04, 1],
                opacity: [0.85, 1, 0.85],
              }
        }
        aria-hidden="true"
        className="relative"
        transition={{
          duration: 2.4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "loop",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-label="poolr">
          <circle cx="10" cy="9" r="5.2" stroke="var(--color-accent)" strokeWidth="2.4" />
          <path d="M10 14.2V22" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-[18px] font-semibold tracking-tight text-[var(--color-text)]">
          poolr
        </h1>
        <p className="mt-0.5 text-[11px] tracking-wide text-[var(--color-text-muted)]">
          {ready ? "ready" : "running system checks…"}
        </p>
      </div>

      {/* Checklist */}
      <ul className="w-full max-w-[260px] space-y-1.5" role="list">
        {checks.map((check, i) => (
          <motion.li
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 rounded-[var(--radius-btn)] px-2.5 py-1.5"
            initial={{ opacity: 0, y: 4 }}
            key={check.id}
            transition={{
              duration: reduced ? 0 : 0.22,
              delay: reduced ? 0 : i * 0.05,
              ease: "easeOut",
            }}
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              {statusIcon(check.status)}
            </span>
            <span
              className={`text-[12.5px] ${
                check.status === "pending"
                  ? "text-[var(--color-text-muted)]"
                  : check.status === "ok"
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-unsure)]"
              }`}
            >
              {check.label}
            </span>
          </motion.li>
        ))}
      </ul>

      {/* Offline warning */}
      <AnimatePresence>
        {engineOnline === false && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 rounded-[var(--radius-btn)] border border-[var(--color-unsure)]/30 bg-[var(--color-unsure)]/10 px-2.5 py-1.5 text-[11px] text-[var(--color-unsure)]"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            role="status"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <WifiOff aria-hidden="true" className="h-3 w-3" />
            Local mode — connect engine for advanced features
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ready indicator */}
      <AnimatePresence>
        {ready && allDone && (
          <motion.p
            animate={{ opacity: 1 }}
            className="text-[11px] font-medium tracking-wide text-[var(--color-include)]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            Ready
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}