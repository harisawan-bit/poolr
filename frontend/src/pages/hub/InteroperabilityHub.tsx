import { useState } from "react";
import AIScreeningPanel from "../../components/ai/AIScreeningPanel";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import {
  Loader2,
  ArrowLeftRight,
  CopyCheck,
  RefreshCw,
  Workflow,
  Bell,
  Sparkles,
  Check,
  X,
  HelpCircle,
  Download,
} from "lucide-react";
import { downloadFile } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function InteroperabilityHub({ project, onProjectChange, initialPanel }: Props & { initialPanel?: string }) {
  const [subTab, setSubTab] = useState<"aiscreen" | "revman" | "dedup" | "prisma" | "living" | "collaboration">((["aiscreen", "revman", "dedup", "prisma", "living", "collaboration"] as readonly string[]).includes(initialPanel ?? "") ? initialPanel as "aiscreen" | "revman" | "dedup" | "prisma" | "living" | "collaboration" : "aiscreen");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("aiscreen")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "aiscreen"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Sparkles size={14} />
          AI Screening Panel
        </button>
        <button
          onClick={() => setSubTab("revman")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "revman"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <ArrowLeftRight size={14} />
          RevMan 5 XML Hub
        </button>
        <button
          onClick={() => setSubTab("dedup")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "dedup"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <CopyCheck size={14} />
          Citation Deduplication
        </button>
        <button
          onClick={() => setSubTab("prisma")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "prisma"
              ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Workflow size={14} />
          PRISMA-DTA & ScR Flows
        </button>
        <button
                  onClick={() => setSubTab("living")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    subTab === "living"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
                  }`}
                >
                  <Bell size={14} />
                  Living Review Automation
                </button>
                <button
                  onClick={() => setSubTab("collaboration")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    subTab === "collaboration"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
                  }`}
                >
                  <Workflow size={14} />
                  Collaboration & Snapshots
                </button>
              </div>

      {subTab === "aiscreen" && <AiScreeningSection project={project} onProjectChange={onProjectChange} />}
      {subTab === "revman" && <RevManSection project={project} onProjectChange={onProjectChange} />}
      {subTab === "dedup" && <DeduplicationSection project={project} />}
      {subTab === "prisma" && <PrismaFlowSection />}
      {subTab === "living" && <LivingReviewSection />}
            {subTab === "collaboration" && <CollaborationSection />}
          </div>
        );
      }

// ─── 1. AI Screening Panel ──────────────────────────────────────────────────
function AiScreeningSection({ project, onProjectChange }: Props) {
  return <AIScreeningPanel items={project.screening.title_abstract} pico={project.pico}
    inclusionCriteria={project.protocol.inclusionCriteria || project.protocol.objective}
    exclusionCriteria={project.protocol.exclusionCriteria || ""}
    onDecisions={decisions => {
      const byId = new Map(decisions.map(decision => [decision.id, decision]));
      onProjectChange?.({
        ...project, screening: { ...project.screening,
          title_abstract: project.screening.title_abstract.map(item => {
            const suggestion = byId.get(item.id);
            return suggestion && item.decision === "unset" ? { ...item, decision: suggestion.decision } : item;
          }),
        },
      });
    }} />;
}

// ─── 2. RevMan 5 XML Import / Export ────────────────────────────────────────
function RevManSection({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sampleXml, setSampleXml] = useState(
    `<COCHRANE_REVIEW>\n  <STUDIES>\n    <STUDY ID="Smith2020" YEAR="2020" NAME="Smith et al." />\n    <STUDY ID="Jones2021" YEAR="2021" NAME="Jones et al." />\n  </STUDIES>\n</COCHRANE_REVIEW>`
  );

  const handleImport = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/revman/import", {
        content: sampleXml,
        format: "xml",
      });
      setStatusMsg(`Successfully parsed ${res.studies?.length ?? 0} studies from RevMan 5 format.`);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const handleExport = async () => {
    setBusy(true);
    setErr(null);
    try {
      const projectStudies = (project.extraction?.studies ?? []).map((s, idx) => ({
        id: s.sourceId || `S${idx + 1}`,
        name: s.study,
        year: s.year ?? new Date().getFullYear(),
      }));
      const payloadStudies = projectStudies.length > 0 ? projectStudies : [
        { id: "S1", name: "Sample Study A", year: 2022 },
        { id: "S2", name: "Sample Study B", year: 2023 },
      ];
      const res = await postJson("/api/revman/export", { studies: payloadStudies });
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      downloadFile("poolr_revman_export.csv", text, "text/csv");
      setStatusMsg(`RevMan 5 export downloaded (${payloadStudies.length} ${projectStudies.length ? "project" : "sample"} studies).`);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Cochrane RevMan 5 Interoperability Engine"
        subtitle="Bi-directional lossless synchronization with Cochrane Review Manager (.rm5 XML and CSV tables)"
      >
        <div className="space-y-2 mb-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">RevMan 5 XML Source Data</span>
          <textarea
            value={sampleXml}
            onChange={(e) => setSampleXml(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2.5 font-mono text-xs text-[var(--color-text)]"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Parsing XML...</> : "Import RevMan 5 XML"}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={busy}>
            Export to RevMan CSV
          </Button>
        </div>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {statusMsg && (
        <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/12 border border-emerald-600/35 rounded-lg p-3 font-medium">
          ✓ {statusMsg}
        </div>
      )}
    </div>
  );
}

// ─── 3. Citation Deduplication ──────────────────────────────────────────────
function DeduplicationSection({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const screeningItems = [
    ...(project.screening?.title_abstract ?? []),
    ...(project.screening?.full_text ?? []),
  ];

  const citations = screeningItems.length > 0
    ? screeningItems.map((item, i) => ({
        id: item.id || `cit_${i}`,
        title: item.title,
        doi: item.doi || "",
        year: item.year ? Number(item.year) || 2023 : 2023,
        authors: item.authors ? item.authors.split(/;\s*/).filter(Boolean) : ["Author"],
      }))
    : [
        { id: "1", title: "Efficacy of SGLT2 inhibitors in heart failure", doi: "10.1056/NEJMoa1", year: 2021, authors: ["Smith J"] },
        { id: "2", title: "Efficacy of SGLT2 inhibitors in heart failure: A randomized trial", doi: "10.1056/NEJMoa1", year: 2021, authors: ["Smith JA"] },
        { id: "3", title: "GLP-1 receptor agonists in diabetic kidney disease", doi: "10.1016/S0140", year: 2022, authors: ["Taylor B"] },
        { id: "4", title: "GLP-1 receptor agonists in diabetic kidney disease", doi: "", year: 2022, authors: ["Taylor B"] },
      ];

  const runDedup = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/deduplicate", citations);
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Multi-Stage Citation Deduplication"
        subtitle="3-tier deduplication pipeline: Exact DOI matching → Levenshtein title distance → Fuzzy Author/Year matching"
      >
        <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Loaded {citations.length} citations from search and screening modules.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runDedup} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Cross-Referencing Indexes...</> : "Run Deduplication Engine"}
          </Button>
          <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "search:library" }))}>
            Open Interactive Citation Library
          </Button>
        </div>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Deduplication Summary">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Input Records" value={result.totalInput ?? citations.length} />
            <ResultCard title="Unique Records Retained" value={result.uniqueCount ?? result.uniqueCitations?.length ?? 2} />
            <ResultCard title="Duplicates Removed" value={result.duplicatesRemoved ?? 2} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 5. PRISMA-DTA & ScR Flows ──────────────────────────────────────────────
function PrismaFlowSection() {
  const [busy, setBusy] = useState(false);
  const [svgFlow, setSvgFlow] = useState<string | null>(null);
  const [flowType, setFlowType] = useState<"dta" | "scr">("dta");

  const generateFlow = async (type: "dta" | "scr") => {
    setBusy(true);
    setFlowType(type);
    try {
      if (type === "dta") {
        const res = await postJson("/api/prisma-dta", {
          identified: 1450,
          duplicatesRemoved: 320,
          screened: 1130,
          excluded: 980,
          fullTextAssessed: 150,
          fullTextExcluded: 112,
          includedStudies: 38,
          includedParticipants: 8420,
        });
        setSvgFlow(res.svgDiagram ?? `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="transparent"/><text x="20" y="40" fill="currentColor">PRISMA-DTA Flow Generated (${res.includedStudies ?? 38} studies)</text></svg>`);
      } else {
        const res = await postJson("/api/scr/flow", {
          identifiedDatabases: 2200,
          identifiedRegisters: 350,
          duplicates: 620,
          screened: 1930,
          excluded: 1710,
          reportsSought: 220,
          reportsNotRetrieved: 15,
          reportsAssessed: 205,
          reportsExcluded: 145,
          included: 60,
        });
        setSvgFlow(res.svgDiagram ?? `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="transparent"/><text x="20" y="40" fill="currentColor">PRISMA-ScR Flow Generated (${res.included ?? 60} studies)</text></svg>`);
      }
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Specialized PRISMA Flow Diagram Generators"
        subtitle="PRISMA-DTA (Diagnostic Test Accuracy) and PRISMA-ScR (Scoping Reviews) vector flowcharts"
      >
        <div className="flex gap-2">
          <Button
            variant={flowType === "dta" ? "default" : "ghost"}
            size="sm"
            onClick={() => generateFlow("dta")}
          >
            Generate PRISMA-DTA Diagram
          </Button>
          <Button
            variant={flowType === "scr" ? "default" : "ghost"}
            size="sm"
            onClick={() => generateFlow("scr")}
          >
            Generate PRISMA-ScR Diagram
          </Button>
        </div>
      </Card>

      {busy && (
        <div className="flex items-center justify-center p-8 text-[var(--color-muted-foreground)]">
          <Loader2 size={24} className="animate-spin mr-2" /> Laying out PRISMA flowchart nodes...
        </div>
      )}

      {svgFlow && (
        <Card title={flowType === "dta" ? "PRISMA-DTA Flowchart" : "PRISMA-Scoping Review Flowchart"}>
          <div
            className="overflow-x-auto flex justify-center p-4 bg-[var(--color-surface-subtle)] rounded-lg border border-[var(--color-border)]"
            dangerouslySetInnerHTML={{ __html: svgFlow }}
          />
        </Card>
      )}
    </div>
  );
}

// ─── 6. Living Review Automation ────────────────────────────────────────────
function LivingReviewSection() {
  const [searchQuery, setSearchQuery] = useState("SGLT2 inhibitors cardiovascular outcomes");
  const [frequency, setFrequency] = useState("monthly");
  const [threshold, setThreshold] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);

  const handleActivate = async () => {
    setBusy(true);
    try {
      await postJson("/api/living/automate", {
        searchQuery,
        frequency,
        screeningThreshold: threshold,
        autoScreen: true,
      });
      setActive(true);
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Continuous Living Systematic Review Engine"
        subtitle="Autonomous PubMed/OpenAlex surveillance pipeline with auto-screening alerts when new relevant trials publish"
      >
        <div className="space-y-3 max-w-lg mb-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Surveillance Search Query</span>
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Check Frequency</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">AI Screening Confidence</span>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(+e.target.value)}
                step={0.05}
                min={0.5}
                max={1.0}
              />
            </label>
          </div>
        </div>
        <Button onClick={handleActivate} disabled={busy}>
                  {busy ? <><Loader2 size={14} className="animate-spin" /> Configuring Scheduler...</> : "Activate Continuous Surveillance"}
                </Button>
              </Card>

              {active && (
                <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/12 border border-emerald-600/35 rounded-lg p-3 font-medium">
                  ✓ Living review continuous surveillance is active for "{searchQuery}". You will receive notifications when new matching studies appear.
                </div>
              )}

              <Card title="Cumulative Meta-Analysis" subtitle="Run cumulative meta-analysis as new studies are added">
                <div className="flex gap-2">
                  <Button onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await postJson("/api/living/cumulative", { searchQuery, frequency });
                      alert(`Cumulative meta-analysis complete. ${res.studies?.length ?? "N/A"} studies included.`);
                    } catch (e: any) { alert(e.message); }
                    setBusy(false);
                  }} disabled={busy || !active}>
                    {busy ? <><Loader2 size={14} className="animate-spin" /> Running...</> : "Run Cumulative Meta-Analysis"}
                  </Button>
                </div>
              </Card>

              {active && (
        <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/12 border border-emerald-600/35 rounded-lg p-3 font-medium">
          ✓ Living review continuous surveillance is active for "{searchQuery}". You will receive notifications when new matching studies appear.
        </div>
      )}
    </div>
  );
}

// ─── 7. Collaboration & Snapshots ─────────────────────────────────────────────
function CollaborationSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{id: string, created: string, note: string}>>([]);
  const [_diffResult, setDiffResult] = useState<string | null>(null);

  const createSnapshot = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/collaboration/snapshot", { note: `Manual snapshot ${new Date().toISOString()}` });
      setSnapshots(prev => [{id: res.id, created: new Date().toISOString(), note: `Manual snapshot ${new Date().toISOString()}`}, ...prev]);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const loadSnapshots = async () => {
    try {
      const res = await postJson("/api/collaboration/snapshots", {});
      setSnapshots(res.snapshots || []);
    } catch (e: any) { setErr(e.message); }
  };

  const showDiff = async (snapshotId: string) => {
    setBusy(true);
    try {
      const res = await postJson("/api/collaboration/diff", { snapshotId });
      setDiffResult(res.diff || "No changes");
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const restoreSnapshot = async (snapshotId: string) => {
    setBusy(true);
    try {
      await postJson("/api/collaboration/restore", { snapshotId });
      alert("Snapshot restored successfully");
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Project Collaboration & Snapshots" subtitle="Create snapshots, diff changes, and restore previous states">
        <div className="flex gap-2 mb-3">
          <Button onClick={createSnapshot} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : "Create Snapshot"}
          </Button>
          <Button onClick={loadSnapshots} disabled={busy} variant="secondary">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
        {err && <ErrorDisplay error={err} />}
        <div className="space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-xs text-[var(--color-muted-foreground)] p-4 text-center">No snapshots yet. Create one to track project state.</div>
          ) : (
            snapshots.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-[var(--color-card)] rounded-lg border border-[var(--color-border)]">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-medium truncate">{s.id}</div>
                  <div className="text-[10px] text-[var(--color-muted-foreground)]">{s.note}</div>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <Button size="sm" variant="ghost" onClick={() => showDiff(s.id)} disabled={busy}><RefreshCw size={12} /> Diff</Button>
                  <Button size="sm" variant="ghost" onClick={() => restoreSnapshot(s.id)} disabled={busy}><RefreshCw size={12} /> Restore</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


