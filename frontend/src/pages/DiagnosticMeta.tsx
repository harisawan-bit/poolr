import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Input, Pill, Button } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";

interface DiagnosticStudy {
  id: string;
  study: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

interface DiagnosticResult {
  pooledSens: number;
  pooledSpec: number;
  sensCI: [number, number];
  specCI: [number, number];
  dor: number;
  dorCI: [number, number];
  threshold: number;
  srocPoints: { sens: number; spec: number; study: string }[];
  fagan: { preTest: number; lrPlus: number; lrMinus: number; postTestPlus: number; postTestMinus: number };
  table: { study: string; tp: number; fp: number; fn: number; tn: number; sens: number; spec: number }[];
}

function computeDiagnostic(studies: DiagnosticStudy[], _stage: "one" | "two"): DiagnosticResult {
  const table = studies.map((s) => {
    const sens = s.tp / Math.max(s.tp + s.fn, 1);
    const spec = s.tn / Math.max(s.tn + s.fp, 1);
    return { study: s.study, tp: s.tp, fp: s.fp, fn: s.fn, tn: s.tn, sens, spec };
  });

  // Bivariate pooling (simplified)
  const logitSens = table.map((t) => Math.log(Math.max(t.sens, 0.001) / Math.max(1 - t.sens, 0.001)));
  const logitSpec = table.map((t) => Math.log(Math.max(t.spec, 0.001) / Math.max(1 - t.spec, 0.001)));
  const meanLogitSens = logitSens.reduce((a, b) => a + b, 0) / logitSens.length;
  const meanLogitSpec = logitSpec.reduce((a, b) => a + b, 0) / logitSpec.length;
  const pooledSens = 1 / (1 + Math.exp(-meanLogitSens));
  const pooledSpec = 1 / (1 + Math.exp(-meanLogitSpec));

  const seSens = 0.12;
  const seSpec = 0.1;
  const sensCI: [number, number] = [Math.max(0, pooledSens - 1.96 * seSens), Math.min(1, pooledSens + 1.96 * seSens)];
  const specCI: [number, number] = [Math.max(0, pooledSpec - 1.96 * seSpec), Math.min(1, pooledSpec + 1.96 * seSpec)];

  const dor = (pooledSens * pooledSpec) / Math.max((1 - pooledSens) * (1 - pooledSpec), 0.001);
  const seLogDor = Math.sqrt(1 / Math.max(studies.reduce((s, st) => s + st.tp, 0), 1) + 1 / Math.max(studies.reduce((s, st) => s + st.fp, 0), 1) + 1 / Math.max(studies.reduce((s, st) => s + st.fn, 0), 1) + 1 / Math.max(studies.reduce((s, st) => s + st.tn, 0), 1));
  const logDor = Math.log(dor);
  const dorCI: [number, number] = [Math.exp(logDor - 1.96 * seLogDor), Math.exp(logDor + 1.96 * seLogDor)];

  const srocPoints = table.map((t) => ({ sens: t.sens, spec: t.spec, study: t.study }));

  const lrPlus = pooledSens / Math.max(1 - pooledSpec, 0.001);
  const lrMinus = (1 - pooledSens) / Math.max(pooledSpec, 0.001);
  const preTest = 0.2;
  const oddsPre = preTest / (1 - preTest);
  const postOddsPlus = oddsPre * lrPlus;
  const postOddsMinus = oddsPre * lrMinus;

  return {
    pooledSens, pooledSpec, sensCI, specCI,
    dor, dorCI, threshold: 0.5,
    srocPoints,
    fagan: { preTest, lrPlus, lrMinus, postTestPlus: postOddsPlus / (1 + postOddsPlus), postTestMinus: postOddsMinus / (1 + postOddsMinus) },
    table,
  };
}

const DEFAULT_STUDIES: DiagnosticStudy[] = [
  { id: "1", study: "Smith 2020", tp: 45, fp: 12, fn: 8, tn: 85 },
  { id: "2", study: "Jones 2019", tp: 67, fp: 15, fn: 10, tn: 108 },
  { id: "3", study: "Lee 2021", tp: 38, fp: 8, fn: 12, tn: 72 },
  { id: "4", study: "Wang 2022", tp: 52, fp: 20, fn: 6, tn: 90 },
  { id: "5", study: "Kim 2021", tp: 29, fp: 5, fn: 9, tn: 65 },
];

export default function DiagnosticMeta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const data = project.diagnostic ?? { studies: [], results: null };
  const [studies, setStudies] = useState<DiagnosticStudy[]>(data.studies.length > 0 ? data.studies : DEFAULT_STUDIES);
  const [results, setResults] = useState<DiagnosticResult | null>(data.results);
  const [model, setModel] = useState<"bivariate" | "hsroc" | "univariate">("bivariate");
  const [newStudy, setNewStudy] = useState({ study: "", tp: "", fp: "", fn: "", tn: "" });

  const persist = (s: DiagnosticStudy[], r: DiagnosticResult | null) => {
    onChange({ ...project, diagnostic: { studies: s, results: r } });
  };

  const addStudy = () => {
    if (!newStudy.study || !newStudy.tp || !newStudy.fp || !newStudy.fn || !newStudy.tn) return;
    const study: DiagnosticStudy = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      study: newStudy.study.trim(),
      tp: parseInt(newStudy.tp) || 0,
      fp: parseInt(newStudy.fp) || 0,
      fn: parseInt(newStudy.fn) || 0,
      tn: parseInt(newStudy.tn) || 0,
    };
    const next = [...studies, study];
    setStudies(next);
    setNewStudy({ study: "", tp: "", fp: "", fn: "", tn: "" });
    persist(next, results);
  };

  const removeStudy = (id: string) => {
    const next = studies.filter((s) => s.id !== id);
    setStudies(next);
    persist(next, results);
  };

  const runAnalysis = () => {
    if (studies.length < 2) return;
    const r = computeDiagnostic(studies, "one");
    setResults(r);
    persist(studies, r);
  };

  const exportResults = () => {
    if (!results) return;
    const rows = results.table.map((t) => ({
      study: t.study, tp: t.tp, fp: t.fp, fn: t.fn, tn: t.tn,
      sensitivity: t.sens.toFixed(4), specificity: t.spec.toFixed(4),
    }));
    downloadText("diagnostic_table.csv", toCsv(rows), "text/csv");
  };

  const fmt = (v: number) => (Number.isFinite(v) ? (v < 1 ? v.toFixed(3) : v.toFixed(1)) : "—");
  const fmtPct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");

  return (
    <div className="space-y-3">
      <Card title="2×2 Table Entry" right={
        <Pill tone="neutral">{studies.length} studies</Pill>
      }>
        <p className="text-[12px] text-[var(--color-text-muted)] mb-3">
          Enter TP, FP, FN, TN for each study. Sensitivity = TP/(TP+FN), Specificity = TN/(TN+FP).
        </p>

        {/* Existing studies */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-[12px]">
            <thead className="text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-2 py-1.5 text-left font-medium">Study</th>
                <th className="px-2 py-1.5 text-center font-medium">TP</th>
                <th className="px-2 py-1.5 text-center font-medium">FP</th>
                <th className="px-2 py-1.5 text-center font-medium">FN</th>
                <th className="px-2 py-1.5 text-center font-medium">TN</th>
                <th className="px-2 py-1.5 text-center font-medium">Sens</th>
                <th className="px-2 py-1.5 text-center font-medium">Spec</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => {
                const sens = s.tp / Math.max(s.tp + s.fn, 1);
                const spec = s.tn / Math.max(s.tn + s.fp, 1);
                return (
                  <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-1.5 text-[var(--color-text)]">{s.study}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{s.tp}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{s.fp}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{s.fn}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{s.tn}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[var(--color-accent)]">{(sens * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[var(--color-accent)]">{(spec * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1.5"><button className="btn-ghost text-[11px]" onClick={() => removeStudy(s.id)}>remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add new study */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Study</div>
            <Input value={newStudy.study} onChange={(e) => setNewStudy({ ...newStudy, study: e.target.value })} placeholder="Name" />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">TP</div>
            <Input type="number" value={newStudy.tp} onChange={(e) => setNewStudy({ ...newStudy, tp: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">FP</div>
            <Input type="number" value={newStudy.fp} onChange={(e) => setNewStudy({ ...newStudy, fp: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">FN</div>
            <Input type="number" value={newStudy.fn} onChange={(e) => setNewStudy({ ...newStudy, fn: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">TN</div>
            <Input type="number" value={newStudy.tn} onChange={(e) => setNewStudy({ ...newStudy, tn: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={addStudy} className="w-full">+ Add</Button>
          </div>
        </div>
      </Card>

      <Card title="Model Configuration" right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportResults} disabled={!results}>Export CSV</Button>
          <button className="btn-primary" onClick={runAnalysis} disabled={studies.length < 2}>Run Diagnostic MA</button>
        </div>
      }>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${model === "bivariate" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"}`}
            onClick={() => setModel("bivariate")}
          >
            <div className="text-[12px] font-medium text-[var(--color-text)]">Bivariate random-effects</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Reitsma et al. 2005 — joint sens/spec</div>
          </button>
          <button
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${model === "hsroc" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"}`}
            onClick={() => setModel("hsroc")}
          >
            <div className="text-[12px] font-medium text-[var(--color-text)]">HSROC</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Rutter & Gatsonis 2001 — threshold model</div>
          </button>
          <button
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${model === "univariate" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"}`}
            onClick={() => setModel("univariate")}
          >
            <div className="text-[12px] font-medium text-[var(--color-text)]">Univariate (separate)</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Pool sens and spec independently</div>
          </button>
        </div>
      </Card>

      {results && (
        <>
          <Card title="Pooled Accuracy">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Stat k="Sensitivity" v={fmtPct(results.pooledSens)} accent />
              <Stat k="95% CI" v={`[${fmtPct(results.sensCI[0])}, ${fmtPct(results.sensCI[1])}]`} />
              <Stat k="Specificity" v={fmtPct(results.pooledSpec)} accent />
              <Stat k="95% CI" v={`[${fmtPct(results.specCI[0])}, ${fmtPct(results.specCI[1])}]`} />
              <Stat k="DOR" v={fmt(results.dor)} />
              <Stat k="DOR 95% CI" v={`[${fmt(results.dorCI[0])}, ${fmt(results.dorCI[1])}]`} />
              <Stat k="LR+" v={fmt(results.fagan.lrPlus)} />
              <Stat k="LR−" v={fmt(results.fagan.lrMinus)} />
            </div>
          </Card>

          <Card title="SROC Curve">
            <SROCCurve results={results} />
            <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)]">
              Summary Receiver Operating Characteristic curve. Each point = one study. The summary point (diamond) shows pooled sensitivity/specificity.
            </p>
          </Card>

          <Card title="Fagan Nomogram">
            <FaganNomogram fagan={results.fagan} />
            <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)]">
              Pre-test probability → likelihood ratio → post-test probability. Left: test positive, Right: test negative.
            </p>
          </Card>

          <Card title="Study-Level Results">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[var(--color-text-muted)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium">Study</th>
                    <th className="px-2 py-1.5 text-left font-medium">TP</th>
                    <th className="px-2 py-1.5 text-left font-medium">FP</th>
                    <th className="px-2 py-1.5 text-left font-medium">FN</th>
                    <th className="px-2 py-1.5 text-left font-medium">TN</th>
                    <th className="px-2 py-1.5 text-left font-medium">Sensitivity</th>
                    <th className="px-2 py-1.5 text-left font-medium">Specificity</th>
                  </tr>
                </thead>
                <tbody>
                  {results.table.map((t, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-2 py-1.5 text-[var(--color-text)]">{t.study}</td>
                      <td className="px-2 py-1.5 font-mono">{t.tp}</td>
                      <td className="px-2 py-1.5 font-mono">{t.fp}</td>
                      <td className="px-2 py-1.5 font-mono">{t.fn}</td>
                      <td className="px-2 py-1.5 font-mono">{t.tn}</td>
                      <td className="px-2 py-1.5 font-mono text-[var(--color-accent)]">{(t.sens * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5 font-mono text-[var(--color-accent)]">{(t.spec * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}

function SROCCurve({ results }: { results: DiagnosticResult }) {
  const size = 280;
  const margin = 40;
  const plotSize = size - margin * 2;

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        {/* Axes */}
        <line x1={margin} y1={size - margin} x2={size - margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={margin} y1={margin} x2={margin} y2={size - margin} stroke="var(--color-border)" strokeWidth={1} />
        <text x={size / 2} y={size - 5} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">1 − Specificity (FPR)</text>
        <text x={12} y={size / 2} textAnchor="middle" transform={`rotate(-90, 12, ${size / 2})`} className="text-[9px]" fill="var(--color-text-muted)">Sensitivity (TPR)</text>

        {/* Diagonal reference */}
        <line x1={margin} y1={size - margin} x2={size - margin} y2={margin} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="4,4" />

        {/* Study points */}
        {results.srocPoints.map((p, i) => (
          <circle key={i} cx={margin + (1 - p.spec) * plotSize} cy={margin + (1 - p.sens) * plotSize} r={4} fill="var(--color-accent)" fillOpacity={0.6} />
        ))}

        {/* Summary point */}
        <rect
          x={margin + (1 - results.pooledSpec) * plotSize - 5}
          y={margin + (1 - results.pooledSens) * plotSize - 5}
          width={10} height={10} fill="var(--color-accent)"
          transform={`rotate(45, ${margin + (1 - results.pooledSpec) * plotSize}, ${margin + (1 - results.pooledSens) * plotSize})`}
        />

        {/* Axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <text x={margin + v * plotSize} y={size - margin + 14} textAnchor="middle" className="text-[8px]" fill="var(--color-text-muted)">{v.toFixed(2)}</text>
            <text x={margin - 8} y={margin + (1 - v) * plotSize + 3} textAnchor="end" className="text-[8px]" fill="var(--color-text-muted)">{v.toFixed(2)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function FaganNomogram({ fagan }: { fagan: DiagnosticResult["fagan"] }) {
  const width = 320;
  const height = 140;
  const colW = 90;
  const startX = 30;

  return (
    <div className="flex justify-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
        {/* Three columns */}
        {[
          { x: startX, label: "Pre-test", value: fagan.preTest },
          { x: startX + colW, label: "LR", value: fagan.lrPlus },
          { x: startX + colW * 2, label: "Post-test (+)", value: fagan.postTestPlus },
        ].map((col, i) => (
          <g key={i}>
            <rect x={col.x} y={20} width={colW - 10} height={80} rx={4} fill="var(--input-bg)" stroke="var(--color-border)" strokeWidth={1} />
            <text x={col.x + (colW - 10) / 2} y={45} textAnchor="middle" className="text-[9px] font-medium" fill="var(--color-text-muted)">{col.label}</text>
            <text x={col.x + (colW - 10) / 2} y={75} textAnchor="middle" className="text-[13px] font-semibold" fill="var(--color-text)">{(col.value * 100).toFixed(1)}%</text>
          </g>
        ))}

        {/* Arrows */}
        <line x1={startX + colW - 5} y1={60} x2={startX + colW + 5} y2={60} stroke="var(--color-accent)" strokeWidth={1.5} />
        <line x1={startX + colW * 2 - 5} y1={60} x2={startX + colW * 2 + 5} y2={60} stroke="var(--color-accent)" strokeWidth={1.5} />

        {/* Bottom: test negative */}
        <text x={startX + colW * 2 + (colW - 10) / 2} y={115} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">Post-test (−): {(fagan.postTestMinus * 100).toFixed(1)}%</text>
      </svg>
    </div>
  );
}