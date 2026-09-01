"use client";

/** 1.9 What's New dialog — shows on first run after version change. */
import { useEffect, useState } from "react";
import { APP_VERSION } from "../lib/version";

const LAST_VERSION_KEY = "poolr.lastVersion";

const WHATS_NEW: Record<string, string[]> = {
  "0.5.7": [
    "Network Meta-Analysis (frequentist + Bayesian)",
    "Multilevel / Multivariate / RVE",
    "Diagnostic Test Accuracy (bivariate + HSROC)",
    "IPD Meta-Analysis (Cox frailty)",
    "Dose-Response (linear, Emax)",
    "Proportion GLMM (logit, double-arcsine)",
    "Prediction intervals + model averaging",
    "Survival extensions (RMST, KM reconstruction)",
    "Living Systematic Review",
    "Reporting (LaTeX, HTML, Python, Stata)",
    "Collaboration (snapshots, diff)",
    "67 engine tests",
  ],
};

export function useWhatsNew() {
  const [show, setShow] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    const last = localStorage.getItem(LAST_VERSION_KEY);
    if (last !== APP_VERSION) {
      setVersion(APP_VERSION);
      setShow(true);
    }
  }, []);

  const dismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
    }
    setShow(false);
  };

  return { show, version, dismiss, items: WHATS_NEW[version] ?? [] };
}

export function WhatsNewModal({ show, version, items, onDismiss }: {
  show: boolean; version: string; items: string[];
  onDismiss: (dontShowAgain: boolean) => void;
}) {
  const [dontShow, setDontShow] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-semibold">What's New in v{version}</h2>
        <p className="mb-4 text-[12px] text-[var(--color-text-muted)]">New features and improvements</p>
        <ul className="mb-4 max-h-60 space-y-1.5 overflow-y-auto">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              {item}
            </li>
          ))}
        </ul>
        <label className="mb-3 flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          Don't show again for this version
        </label>
        <button className="btn-primary w-full" onClick={() => onDismiss(dontShow)}>Got it</button>
      </div>
    </div>
  );
}
