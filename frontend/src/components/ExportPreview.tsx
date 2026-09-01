"use client";

interface ExportPreviewProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (format: string, includeFigures: boolean, includeRawData: boolean) => void;
}

import { useState } from "react";

export function ExportPreviewModal({ open, onClose, onGenerate }: ExportPreviewProps) {
  const [format, setFormat] = useState<"docx" | "latex" | "html">("docx");
  const [includeFigures, setIncludeFigures] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(false);

  if (!open) return null;

  const pageCount = format === "latex" ? 8 : format === "html" ? 12 : 10;
  const fileSize = format === "latex" ? 250 : format === "html" ? 500 : 350;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold">Export Preview</h2>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Format</div>
            <select value={format} onChange={(e) => setFormat(e.target.value as "docx" | "latex" | "html")} className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-[12px]">
              <option value="docx">Word (.docx)</option>
              <option value="latex">LaTeX (.tex)</option>
              <option value="html">HTML (.html)</option>
            </select>
          </div>
          <div className="flex gap-4 text-[12px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeFigures} onChange={(e) => setIncludeFigures(e.target.checked)} />
              Include figures
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeRawData} onChange={(e) => setIncludeRawData(e.target.checked)} />
              Include raw data
            </label>
          </div>
          <div className="rounded bg-white/[0.04] p-3 text-[11px] text-[var(--color-text-muted)]">
            <div>Estimated pages: {pageCount}</div>
            <div>Estimated file size: {fileSize} KB</div>
            {includeRawData && <div>Raw data tables included</div>}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => onGenerate(format, includeFigures, includeRawData)}>Generate {format.toUpperCase()}</button>
        </div>
      </div>
    </div>
  );
}
