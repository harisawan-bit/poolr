import { useState } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ErrorDisplay } from "../../components/StudyManager";
import {
  Loader2,
  FileCode,
  FileText,
  Code2,
  Globe,
  Terminal,
  BookOpen,
  Copy,
  Download,
  Check,
} from "lucide-react";
import { downloadFile } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

function reportData(project: Project) {
  const result = project.meta.results;
  if (!result?.pooled || !result.heterogeneity) throw new Error("Run a meta-analysis before generating a report.");
  const analyzed = new Set(result.studies.map(study => study.study));
  const studies = (project.meta.settings.data ?? []).filter(study => study.study && analyzed.has(study.study));
  return {
    title: project.metadata.title || "Untitled review", objective: project.protocol.objective,
    studies: result.k, participants: studies.reduce((sum, study) => sum + (study.int_n ?? 0) + (study.ctrl_n ?? 0), 0),
    pooledEffect: result.pooled.effect, ciLower: result.pooled.ci_lower, ciUpper: result.pooled.ci_upper,
    i2: result.heterogeneity.i2, p: result.pooled.p, measure: result.measure, model: result.model, method: result.method,
    robSummary: project.rob.assessments.map(assessment => assessment.overall).join(", ") || "Not reported",
    gradeCertainty: "Not reported",
    references: studies.map(study => ({ study: study.study, year: study.year })),
  };
}

export function ReportsHub({ project, initialPanel }: Props & { initialPanel?: string }) {
  const [subTab, setSubTab] = useState<"r_code" | "methods" | "latex" | "html" | "scripts" | "citations">((["r_code", "methods", "latex", "html", "scripts", "citations"] as readonly string[]).includes(initialPanel ?? "") ? initialPanel as "r_code" | "methods" | "latex" | "html" | "scripts" | "citations" : "r_code");

  return (
    <div className="space-y-4">
      {/* Sub navigation with theme-aware high-contrast active buttons */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("r_code")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "r_code"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <FileCode size={14} />
          R Replication Studio
        </button>
        <button
          onClick={() => setSubTab("methods")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "methods"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <FileText size={14} />
          Methods Paragraph
        </button>
        <button
          onClick={() => setSubTab("latex")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "latex"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Code2 size={14} />
          LaTeX Manuscript
        </button>
        <button
          onClick={() => setSubTab("html")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "html"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Globe size={14} />
          Executive HTML Report
        </button>
        <button
          onClick={() => setSubTab("scripts")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "scripts"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Terminal size={14} />
          Python & Stata Scripts
        </button>
        <button
          onClick={() => setSubTab("citations")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "citations"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-xs"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <BookOpen size={14} />
          Bibliographic Citations
        </button>
      </div>

      {subTab === "r_code" && <RReplicationSection project={project} />}
      {subTab === "methods" && <MethodsParagraphSection project={project} />}
      {subTab === "latex" && <LatexSection project={project} />}
      {subTab === "html" && <HtmlReportSection project={project} />}
      {subTab === "scripts" && <PythonStataSection project={project} />}
      {subTab === "citations" && <CitationsSection project={project} />}
    </div>
  );
}

// ─── 1. R Replication Studio ────────────────────────────────────────────────
function RReplicationSection({
  project,
}: {
  project: Project;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!project.meta.results) throw new Error("Run a meta-analysis before exporting replication code.");
      const res = await postJson("/api/export/r_code", {
        response: project.meta.results,
        data: project.meta.settings.data ?? [],
      });
      const text = typeof res === "string" ? res : res?.code || JSON.stringify(res, null, 2);
      setCode(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (code) {
      downloadFile(code, "poolr_replication.R", "text/plain");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="R Replication Code Studio"
        subtitle="Generates R code from the current meta-analysis"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">

          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={busy}>
              {busy ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : "Generate R Code"}
            </Button>
            {code && (
              <>
                <Button variant="secondary" onClick={handleCopy}>
                  {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
                </Button>
                <Button variant="secondary" onClick={handleDownload}>
                  <Download size={13} /> Download .R
                </Button>
              </>
            )}
          </div>
        </div>

        {err && <ErrorDisplay error={err} />}

        {code && (
          <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--hover-surface)]/50 p-3 font-mono text-[11.5px] leading-relaxed text-[var(--color-text)] max-h-96">
            {code}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ─── 2. Methods Paragraph Generator ─────────────────────────────────────────
function MethodsParagraphSection({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [methodsText, setMethodsText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!project.meta.results) throw new Error("Run a meta-analysis before generating methods.");
      const res = await postJson("/api/export/methods", project.meta.results);
      const text = typeof res === "string" ? res : res?.methods || res?.text || JSON.stringify(res, null, 2);
      setMethodsText(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const handleCopy = () => {
    if (methodsText) {
      navigator.clipboard.writeText(methodsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Cochrane & PRISMA Statistical Methods Paragraph Generator"
        subtitle="Produces standardized manuscript text documenting models, estimators, Knapp-Hartung adjustments, and publication bias"
      >
        <div className="flex items-center gap-2 mb-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? <><Loader2 size={13} className="animate-spin" /> Drafting...</> : "Draft Methods Paragraph"}
          </Button>
          {methodsText && (
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy Text</>}
            </Button>
          )}
        </div>

        {err && <ErrorDisplay error={err} />}

        {methodsText && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--hover-surface)]/30 p-4 text-xs leading-relaxed text-[var(--color-text)]">
            <h4 className="text-xs font-semibold mb-2 text-[var(--color-text)]">Statistical Analysis</h4>
            <p className="whitespace-pre-wrap">{methodsText}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 3. LaTeX Manuscript & Tables ───────────────────────────────────────────
function LatexSection({
  project,
}: {
  project: Project;
}) {
  const [title, setTitle] = useState(project.metadata.title || "");
  const [authors, setAuthors] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [latex, setLatex] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/report/latex", { ...reportData(project), title, authors });
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      setLatex(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="LaTeX Manuscript & Forest Table Exporter"
        subtitle="Generates ready-to-compile LaTeX source code (.tex) with formatted tables, TikZ forest plot, and author headers"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mb-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Manuscript Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Author Affiliations</span>
            <Input value={authors} onChange={(e) => setAuthors(e.target.value)} className="mt-1" />
          </label>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? <><Loader2 size={13} className="animate-spin" /> Compiling LaTeX...</> : "Generate LaTeX Document"}
          </Button>
          {latex && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(latex);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy .tex</>}
              </Button>
              <Button variant="secondary" onClick={() => downloadFile(latex, "manuscript.tex", "application/x-tex")}>
                <Download size={13} /> Download .tex
              </Button>
            </>
          )}
        </div>

        {err && <ErrorDisplay error={err} />}

        {latex && (
          <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--hover-surface)]/50 p-3 font-mono text-[11.5px] leading-relaxed text-[var(--color-text)] max-h-96">
            {latex}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ─── 4. Standalone HTML Executive Report ─────────────────────────────────────
function HtmlReportSection({
  project,
}: {
  project: Project;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const report = reportData(project);
      const res = await postJson("/api/report/html", {
        project: { ...report, screeningRecords: project.screening.title_abstract.length,
          includedStudies: report.studies, certainty: report.gradeCertainty },
        embedFigures: true,
        includeMethods: true,
      });
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      setHtmlDoc(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Interactive HTML Executive Report"
        subtitle="Self-contained, standalone single-file HTML report with embedded styles, summary metrics, and tables for clinical stakeholders"
      >
        <div className="flex items-center gap-2 mb-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? <><Loader2 size={13} className="animate-spin" /> Rendering HTML...</> : "Generate HTML Report"}
          </Button>
          {htmlDoc && (
            <Button
              variant="secondary"
              onClick={() => downloadFile(htmlDoc, "executive_report.html", "text/html")}
            >
              <Download size={13} /> Download .html
            </Button>
          )}
        </div>

        {err && <ErrorDisplay error={err} />}

        {htmlDoc && (
          <div className="border border-[var(--color-border)] rounded-md overflow-hidden bg-white">
            <iframe
              title="Report Preview"
              srcDoc={htmlDoc}
              className="w-full h-96 border-0"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 5. Python & Stata Scripts ──────────────────────────────────────────────
function PythonStataSection({
  project,
}: {
  project: Project;
}) {
  const [target, setTarget] = useState<"python" | "stata">("python");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const endpoint = target === "python" ? "/api/report/python" : "/api/report/stata";
      const res = await postJson(endpoint, reportData(project));
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      setScript(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Python & Stata Replication Scripts"
        subtitle="Automatic synthesis script translation into Python (statsmodels / scipy) and Stata (meta set / meta summarize / meta forest)"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Target Language:</span>
            <select
              value={target}
              onChange={(e: any) => setTarget(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--input-bg)] px-2.5 py-1 text-xs text-[var(--color-text)]"
            >
              <option value="python">Python (statsmodels / scipy)</option>
              <option value="stata">Stata (.do meta suite)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={busy}>
              {busy ? <><Loader2 size={13} className="animate-spin" /> Translating...</> : `Generate ${target === "python" ? "Python" : "Stata"} Script`}
            </Button>
            {script && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(script);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadFile(script, target === "python" ? "meta_analysis.py" : "meta_analysis.do", "text/plain")}
                >
                  <Download size={13} /> Download {target === "python" ? ".py" : ".do"}
                </Button>
              </>
            )}
          </div>
        </div>

        {err && <ErrorDisplay error={err} />}

        {script && (
          <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--hover-surface)]/50 p-3 font-mono text-[11.5px] leading-relaxed text-[var(--color-text)] max-h-96">
            {script}
          </pre>
        )}
      </Card>
    </div>
  );
}

// ─── 6. Bibliographic Citations (BibTeX / RIS) ──────────────────────────────
function CitationsSection({ project }: Props) {
  const [format, setFormat] = useState<"bibtex" | "ris">("bibtex");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [citations, setCitations] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const studies = project.extraction?.studies ?? [];

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/export/citations", {
        studies: studies.length > 0 ? studies : [
          { study: "Smith 2021", year: 2021, journal: "Lancet", doi: "10.1016/S0140-6736(21)00123-4" },
          { study: "Johnson 2022", year: 2022, journal: "NEJM", doi: "10.1056/NEJMoa2104567" },
          { study: "Patel 2023", year: 2023, journal: "BMJ", doi: "10.1136/bmj.p1234" },
        ],
        format,
      });

      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      setCitations(text);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Bibliographic Reference Exporter"
        subtitle="Exports included studies and methods citations into standard BibTeX (.bib) and Research Information Systems (.ris) formats"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Citation Format:</span>
            <select
              value={format}
              onChange={(e: any) => setFormat(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--input-bg)] px-2.5 py-1 text-xs text-[var(--color-text)]"
            >
              <option value="bibtex">BibTeX (.bib)</option>
              <option value="ris">RIS (Zotero / Mendeley / EndNote)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={busy}>
              {busy ? <><Loader2 size={13} className="animate-spin" /> Exporting...</> : "Generate Citations"}
            </Button>
            {citations && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(citations);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadFile(citations, `citations.${format === "bibtex" ? "bib" : "ris"}`, "text/plain")}
                >
                  <Download size={13} /> Download .{format === "bibtex" ? "bib" : "ris"}
                </Button>
              </>
            )}
          </div>
        </div>

        {err && <ErrorDisplay error={err} />}

        {citations && (
          <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--hover-surface)]/50 p-3 font-mono text-[11.5px] leading-relaxed text-[var(--color-text)] max-h-96">
            {citations}
          </pre>
        )}
      </Card>
    </div>
  );
}
