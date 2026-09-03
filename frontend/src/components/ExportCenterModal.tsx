import { useState } from "react";
import type { Project } from "../lib/project";
import { Button, EmptyState } from "./ui";
import { exportReplicationCode, exportCitations } from "../lib/api";
import { downloadText } from "../lib/project";
import {
  X,
  FileDown,
  FileCode,
  FileText,
  BookOpen,
  Download,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project;
}

type ExportType = "docx" | "latex" | "html" | "r" | "stata" | "python" | "bibtex" | "ris";

export default function ExportCenterModal({ open, onClose, project }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<ExportType>("docx");
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  if (!open) return null;

  const resp = project.meta?.results;
  const studies = project.extraction?.studies ?? [];

  const loadPreview = async (format: ExportType) => {
    setSelectedFormat(format);
    setPreviewContent(null);
    if (format === "docx") return; // binary format

    setExporting(true);
    try {
      if (format === "bibtex" || format === "ris") {
        const text = await exportCitations(studies, format);
        setPreviewContent(text);
      } else {
        const payload = {
          measure: project.meta?.settings?.measure || "OR",
          model: project.meta?.settings?.model || "random",
          method: project.meta?.settings?.method || "DL",
          studies: (resp?.studies || []).map((s) => ({
            study: s.study,
            effect: s.effect,
            ci_lower: s.ci_lower,
            ci_upper: s.ci_upper,
            weight: s.weight,
            se: (s as any).se || Math.abs(s.ci_upper - s.ci_lower) / 3.92,
          })),
          pooled: resp?.pooled,
          heterogeneity: resp?.heterogeneity,
          pico: project.pico,
          protocol: project.protocol,
        };
        const text = await exportReplicationCode(format, payload);
        setPreviewContent(text);
      }
    } catch (e) {
      console.error(e);
      setPreviewContent("Failed to generate export. Please ensure engine is running.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async () => {
    if (selectedFormat === "docx") {
      // Trigger DOCX download from API
      try {
        const res = await fetch("http://127.0.0.1:5180/api/report/docx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(project),
        });
        if (!res.ok) throw new Error("DOCX export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const docTitle = (project.metadata?.title || "systematic_review").toLowerCase().replace(/\s+/g, "_");
        a.download = `${docTitle}_manuscript.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        alert("DOCX export failed: " + e.message);
      }
      return;
    }

    if (!previewContent) return;
    const ext =
      selectedFormat === "latex"
        ? "tex"
        : selectedFormat === "html"
        ? "html"
        : selectedFormat === "r"
        ? "R"
        : selectedFormat === "stata"
        ? "do"
        : selectedFormat === "python"
        ? "py"
        : selectedFormat === "bibtex"
        ? "bib"
        : "ris";

    const mime =
      selectedFormat === "html"
        ? "text/html"
        : selectedFormat === "latex"
        ? "application/x-tex"
        : "text/plain";

    const fileTitle = (project.metadata?.title || "systematic_review").toLowerCase().replace(/\s+/g, "_");
    downloadText(`${fileTitle}.${ext}`, previewContent, mime);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="flex h-[90vh] max-h-[820px] w-full max-w-4xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileDown className="h-5 w-5 text-[var(--color-accent)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">Universal Export & Publishing Center</h2>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">
                Export complete manuscripts, replication packages, statistical scripts, and bibliographies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Format Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "docx"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("docx")}
          >
            <FileText className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">Word DOCX</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Full PRISMA Manuscript</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "latex"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("latex")}
          >
            <FileCode className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">LaTeX (.tex)</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Journal Article Template</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "html"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("html")}
          >
            <BookOpen className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">Interactive HTML</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Standalone Report</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "r"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("r")}
          >
            <FileCode className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">R metafor</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">100% Replication Script</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "stata"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("stata")}
          >
            <FileCode className="h-5 w-5 text-sky-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">Stata do-file</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">meta set & forest</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "python"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("python")}
          >
            <FileCode className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">Python Script</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">pandas & statsmodels</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "bibtex"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("bibtex")}
          >
            <BookOpen className="h-5 w-5 text-purple-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">BibTeX (.bib)</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Included Citations</div>
            </div>
          </button>

          <button
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              selectedFormat === "ris"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                : "border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            onClick={() => loadPreview("ris")}
          >
            <BookOpen className="h-5 w-5 text-rose-500 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold">RIS (.ris)</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">EndNote / Zotero</div>
            </div>
          </button>
        </div>

        {/* Action / Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          {selectedFormat === "docx" ? (
            <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <FileText className="mx-auto h-12 w-12 text-blue-500" />
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-semibold text-[var(--color-text)]">Microsoft Word PRISMA 2020 Manuscript</h3>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  Generates an academic-grade .docx document containing Title page, Abstract, Introduction, Methods, Results, Summary of Findings table, and references.
                </p>
              </div>
              <Button variant="default" size="lg" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download DOCX Manuscript
              </Button>
            </div>
          ) : exporting ? (
            <div className="flex h-64 items-center justify-center text-[12px] text-[var(--color-text-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--color-accent)]" />
              Generating {selectedFormat.toUpperCase()} package…
            </div>
          ) : previewContent ? (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {selectedFormat.toUpperCase()} Content Preview
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(previewContent);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy to Clipboard"}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download File
                  </Button>
                </div>
              </div>
              <pre className="flex-1 max-h-[420px] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-4 font-mono text-[11px] leading-relaxed text-[var(--color-text)]">
                {previewContent}
              </pre>
            </div>
          ) : (
            <EmptyState>
              Select an export format above to generate and preview the replication code or manuscript.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
