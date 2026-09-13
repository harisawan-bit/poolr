/**
 * MetaWorkbench — unified layout for meta-analysis pages.
 *
 * Extracts the duplicated "settings → run → results → export" pattern
 * shared by Meta, NetworkMeta, IPDMeta, MultilevelMeta, DiagnosticMeta,
 * ProportionsMeta (each was 276–1196 lines of boilerplate).
 */
import * as React from "react";
import { Card, Button, Pill, EmptyState } from "../components/ui";
import { Loader2, Download, Copy, RotateCcw, Check } from "lucide-react";

export interface WorkbenchProps {
  title: string;
  studyCount: number;
  busy: boolean;
  err: string | null;
  onRun: () => void;
  onReset?: () => void;
  hasResults: boolean;
  children?: React.ReactNode;
  /** Content rendered after the settings card (inside the same card) */
  settingsExtras?: React.ReactNode;
  /** Results rendered as separate cards after the settings card */
  results?: React.ReactNode;
  actions?: React.ReactNode;
  /** Compact single-row settings (replaces the full grid) */
  compactSettings?: React.ReactNode;
}

export function MetaWorkbench({
  title,
  studyCount,
  busy,
  err,
  onRun,
  onReset,
  hasResults,
  children,
  settingsExtras,
  results,
  compactSettings,
}: WorkbenchProps) {
  return (
    <div className="space-y-3">
      <Card
        title={title}
        right={
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{studyCount} studies</Pill>
            {hasResults && onReset && (
              <Button variant="ghost" size="sm" onClick={onReset} title="Clear results to re-run">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}
            <button className="btn-primary min-w-[120px]" onClick={onRun} disabled={busy}>
              {busy ? (
                <span className="flex h-6 items-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Pooling…</span>
                </span>
              ) : (
                "Run"
              )}
            </button>
          </div>
        }
      >
        {compactSettings || (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">{children}</div>
        )}
        {settingsExtras}
        {err && (
          <div className="mt-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
            {err}
          </div>
        )}
      </Card>

      {!hasResults ? (
        busy ? (
          <Card title="Working">
            <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing…
            </div>
          </Card>
        ) : (
          <EmptyState>Configure settings and Run. Results appear here.</EmptyState>
        )
      ) : (
        results
      )}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

export function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? "text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>
        {value}
      </div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

export interface CopyButtonProps {
  label: string;
  text: string;
}

export function CopyButton({ label, text }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

export interface DownloadButtonProps {
  label: string;
  filename: string;
  content: string;
  mime?: string;
  disabled?: boolean;
}

export function DownloadButton({ label, filename, content, mime = "text/plain", disabled }: DownloadButtonProps) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleDownload} disabled={disabled}>
      <Download className="h-3.5 w-3.5 mr-1" />
      {label}
    </Button>
  );
}

export interface ResultsCardProps {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}

export function ResultsCard({ title, children, right }: ResultsCardProps) {
  return (
    <Card title={title} right={right}>
      {children}
    </Card>
  );
}
