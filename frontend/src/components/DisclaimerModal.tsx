import { useEffect } from "react";

const DISCLAIMER =
  "poolr helps researchers plan, screen, and synthesize evidence into a defensible meta-analysis. Always verify outputs against your protocol and preregister before analysis. For research use — not a substitute for clinical judgment.";

export default function DisclaimerModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-[460px] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[14px]">ⓘ</span>
          <h3 className="text-[15px] font-semibold">Research-use disclaimer</h3>
        </div>
        <p className="text-[12.5px] leading-relaxed text-[#b9bbc2]">{DISCLAIMER}</p>
        <div className="mt-3 text-[10.5px] text-[#8b8d96]">
          Developed by M. Haris Awan · © 2026 M. Haris Awan. All rights reserved.
        </div>
        <div className="mt-1 text-[10px] text-[#6f7178]">
          100% Python-free · Tauri 2 + React + C#/.NET engine
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={onClose}>I understand</button>
        </div>
      </div>
    </div>
  );
}
