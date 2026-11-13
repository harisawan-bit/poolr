import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileUp, Highlighter, SplitSquareHorizontal, X } from "lucide-react";
import { openExternalUrl } from "../lib/api";
import { parseMetricSelection, safeDocumentUrl, type ScreeningItem } from "../lib/project";
import { Button, Pill, Textarea } from "./ui";

export interface ProvenanceTarget {
  key: string;
  label: string;
  onAssign: (quote: string) => void;
}

export function StudySourceViewer({
  citation,
  text,
  onTextChange,
  provenance,
  onClearProvenance,
  targets,
  placeholder,
}: {
  citation?: ScreeningItem;
  text: string;
  onTextChange: (next: string) => void;
  provenance?: Record<string, string>;
  onClearProvenance?: (key: string) => void;
  targets: ProvenanceTarget[];
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPdf, setLocalPdf] = useState<{ name: string; url: string } | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState("");

  useEffect(() => {
    return () => {
      if (localPdf?.url) URL.revokeObjectURL(localPdf.url);
    };
  }, [localPdf]);

  const remotePdf = safeDocumentUrl(citation?.pdfUrl);
  const activePdfUrl = localPdf?.url ?? remotePdf ?? null;
  const externalDocUrl =
    safeDocumentUrl(citation?.pdfUrl) ||
    safeDocumentUrl(citation?.url) ||
    (citation?.doi ? `https://doi.org/${citation.doi.replace(/^https?:\/\/doi\.org\//i, "")}` : null);

  const parsedHint = useMemo(() => {
    const m = selectedQuote ? parseMetricSelection(selectedQuote) : null;
    if (!m) return null;
    if (m.kind === "binary") return `${m.events}/${m.n}`;
    if (m.kind === "continuous") return `${m.mean} (SD ${m.sd})`;
    if (m.kind === "ratio") return `${m.effect} [${m.ci_lower}, ${m.ci_upper}]`;
    return m.value !== undefined ? String(m.value) : null;
  }, [selectedQuote]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (localPdf?.url) URL.revokeObjectURL(localPdf.url);
      setLocalPdf({ name: file.name, url: URL.createObjectURL(file) });
      setShowSplit(true);
      return;
    }
    const content = await file.text();
    onTextChange(content);
  };

  const captureSelection = (el: HTMLTextAreaElement) => {
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const picked = e > s ? el.value.slice(s, e).trim() : "";
    setSelectedQuote(picked);
  };

  const provEntries = Object.entries(provenance ?? {}).filter(([, v]) => Boolean(v));

  return (
    <div className="space-y-2 rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <Highlighter className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
          <span>Source Document &amp; Highlight-to-Field Provenance</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input ref={fileRef} type="file" accept=".pdf,application/pdf,.txt,text/plain" className="hidden" onChange={handleFile} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> {localPdf ? `PDF: ${localPdf.name.slice(0, 18)}` : "Attach PDF / Txt"}
          </Button>
          {activePdfUrl && (
            <Button type="button" variant="secondary" size="sm" aria-pressed={showSplit} onClick={() => setShowSplit((v) => !v)}>
              <SplitSquareHorizontal className="h-3.5 w-3.5" /> {showSplit ? "Hide Split PDF" : "Open Split PDF"}
            </Button>
          )}
          {citation?.abstract && !text.trim() && (
            <Button type="button" variant="outline" size="sm" onClick={() => onTextChange(citation.abstract)}>
              Load Abstract
            </Button>
          )}
          {externalDocUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void openExternalUrl(externalDocUrl)}>
              <ExternalLink className="h-3.5 w-3.5" /> Open Source
            </Button>
          )}
        </div>
      </div>

      <div className={showSplit && activePdfUrl ? "grid grid-cols-1 gap-3 lg:grid-cols-2" : "space-y-2"}>
        {showSplit && activePdfUrl && (
          <div className="overflow-hidden rounded-[4px] border border-[var(--color-border-strong)] bg-[var(--color-surface)]">
            <object data={activePdfUrl} type="application/pdf" className="h-[320px] w-full" aria-label="Attached study PDF">
              <div className="p-4 text-[12px] text-[var(--color-text-muted)]">
                Inline PDF preview is unavailable in this frame. Open in external browser or copy text into the excerpt box beside this pane.
              </div>
            </object>
          </div>
        )}
        <div>
          <Textarea
            rows={showSplit && activePdfUrl ? 14 : 4}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onSelect={(e) => captureSelection(e.currentTarget)}
            onMouseUp={(e) => captureSelection(e.currentTarget)}
            onKeyUp={(e) => captureSelection(e.currentTarget)}
            placeholder={placeholder ?? "Paste results paragraph, abstract, or attach PDF, then highlight any phrase/number below to populate fields…"}
          />
          <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
            Tip: Highlight any number, rate, mean±SD, CI, or RoB rationale in the excerpt box to assign it in one click.
          </div>
        </div>
      </div>

      {selectedQuote && targets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-[4px] border border-[var(--workspace-accent)]/40 bg-[var(--workspace-selection)]/60 p-2 text-[11.5px]">
          <span className="max-w-[260px] truncate font-medium text-[var(--color-text)]" title={selectedQuote}>
            “{selectedQuote}”
          </span>
          {parsedHint && <Pill tone="accent">Detected: {parsedHint}</Pill>}
          <span className="text-[11px] text-[var(--color-text-muted)]">→ Assign to:</span>
          {targets.map((t) => (
            <button
              key={t.key}
              type="button"
              className="btn-primary !px-2 !py-0.5 !text-[11px]"
              onClick={() => {
                t.onAssign(selectedQuote);
                setSelectedQuote("");
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {provEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {provEntries.map(([k, q]) => (
            <span
              key={k}
              className="inline-flex max-w-full items-center gap-1.5 rounded border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-0.5 text-[10.5px] text-[var(--color-text)]"
              title={q}
            >
              <strong className="uppercase text-[var(--workspace-accent)]">{k}:</strong>
              <span className="max-w-[220px] truncate text-[var(--color-text-muted)]">“{q}”</span>
              {onClearProvenance && (
                <button
                  type="button"
                  aria-label={`Remove provenance for ${k}`}
                  className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-exclude)]"
                  onClick={() => onClearProvenance(k)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudySourceViewer;
