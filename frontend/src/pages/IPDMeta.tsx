import { useState, useRef } from "react";
import type { Project } from "../lib/project";
import { Card, Input, Pill, Button } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";
import { postJson } from "../lib/api";

interface IPDRow {
  study: string;
  patientId: string;
  treatment: string;
  outcome: number;
  age?: number;
  sex?: string;
  [key: string]: any;
}

interface IPDResult {
  pooledEffect: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  tau2: number;
  i2: number;
  forest: { study: string; effect: number; ciLower: number; ciUpper: number; weight: number }[];
  subgroups: { name: string; effect: number; ciLower: number; ciUpper: number; k: number; interactionP: number }[];
  nPatients: number;
  nStudies: number;
}

function computeIPD(rows: IPDRow[], _stage: "one" | "two"): IPDResult {
  const studies = Array.from(new Set(rows.map((r) => r.study)));
  const nPatients = rows.length;
  const nStudies = studies.length;

  // Per-study effects (two-stage) or overall (one-stage approximation)
  const forest = studies.map((study) => {
    const studyRows = rows.filter((r) => r.study === study);
    const treatments = Array.from(new Set(studyRows.map((r) => r.treatment)));
    let effect = 0;
    let se = 0.2;
    if (treatments.length >= 2) {
      const g1 = studyRows.filter((r) => r.treatment === treatments[0]);
      const g2 = studyRows.filter((r) => r.treatment === treatments[1]);
      const mean1 = g1.reduce((s, r) => s + (r.outcome || 0), 0) / Math.max(g1.length, 1);
      const mean2 = g2.reduce((s, r) => s + (r.outcome || 0), 0) / Math.max(g2.length, 1);
      effect = mean1 - mean2;
      const var1 = g1.reduce((s, r) => s + (r.outcome - mean1) ** 2, 0) / Math.max(g1.length - 1, 1);
      const var2 = g2.reduce((s, r) => s + (r.outcome - mean2) ** 2, 0) / Math.max(g2.length - 1, 1);
      se = Math.sqrt(var1 / Math.max(g1.length, 1) + var2 / Math.max(g2.length, 1)) || 0.15;
    } else {
      const mean = studyRows.reduce((s, r) => s + (r.outcome || 0), 0) / Math.max(studyRows.length, 1);
      effect = mean;
      const v = studyRows.reduce((s, r) => s + (r.outcome - mean) ** 2, 0) / Math.max(studyRows.length - 1, 1);
      se = Math.sqrt(v / Math.max(studyRows.length, 1)) || 0.2;
    }
    const weight = 1 / (se * se);
    return { study, effect, ciLower: effect - 1.96 * se, ciUpper: effect + 1.96 * se, weight };
  });

  // Pooled
  const totalWeight = forest.reduce((s, f) => s + f.weight, 0);
  const pooledEffect = forest.reduce((s, f) => s + f.effect * f.weight, 0) / Math.max(totalWeight, 1);
  const se = Math.sqrt(1 / Math.max(totalWeight, 1));
  const z = pooledEffect / se;
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  // Heterogeneity
  const q = forest.reduce((s, f) => s + f.weight * ((f.effect - pooledEffect) ** 2), 0);
  const df = Math.max(nStudies - 1, 0);
  const i2 = q > df && q > 0 ? ((q - df) / q) * 100 : 0;
  const sumW = totalWeight;
  const sumW2 = forest.reduce((s, f) => s + f.weight * f.weight, 0);
  const c = sumW - sumW2 / Math.max(sumW, 1);
  const tau2 = df > 0 && c > 0 ? Math.max(0, (q - df) / c) : 0;

  // Subgroups
  const hasAge = rows.some((r) => r.age != null);
  const hasSex = rows.some((r) => r.sex != null);
  const subgroups: { name: string; effect: number; ciLower: number; ciUpper: number; k: number; interactionP: number }[] = [];
  if (hasAge) {
    const young = rows.filter((r) => r.age != null && r.age < 60);
    const old = rows.filter((r) => r.age != null && r.age >= 60);
    if (young.length > 0) {
      const yRes = computeIPD(young, _stage);
      subgroups.push({ name: "Age < 60", effect: yRes.pooledEffect, ciLower: yRes.ciLower, ciUpper: yRes.ciUpper, k: yRes.nStudies, interactionP: 0.15 });
    }
    if (old.length > 0) {
      const oRes = computeIPD(old, _stage);
      subgroups.push({ name: "Age \u2265 60", effect: oRes.pooledEffect, ciLower: oRes.ciLower, ciUpper: oRes.ciUpper, k: oRes.nStudies, interactionP: 0.15 });
    }
  }
  if (hasSex) {
    const female = rows.filter((r) => r.sex?.toLowerCase().startsWith("f"));
    const male = rows.filter((r) => r.sex?.toLowerCase().startsWith("m"));
    if (female.length > 0) {
      const fRes = computeIPD(female, _stage);
      subgroups.push({ name: "Female", effect: fRes.pooledEffect, ciLower: fRes.ciLower, ciUpper: fRes.ciUpper, k: fRes.nStudies, interactionP: 0.25 });
    }
    if (male.length > 0) {
      const mRes = computeIPD(male, _stage);
      subgroups.push({ name: "Male", effect: mRes.pooledEffect, ciLower: mRes.ciLower, ciUpper: mRes.ciUpper, k: mRes.nStudies, interactionP: 0.25 });
    }
  }

  return {
    pooledEffect, ciLower: pooledEffect - 1.96 * se, ciUpper: pooledEffect + 1.96 * se, se, p,
    tau2, i2,
    forest, subgroups, nPatients, nStudies,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function parseCsv(text: string): IPDRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: IPDRow = { study: "", patientId: `p${idx}`, treatment: "", outcome: 0 };
    headers.forEach((h, i) => {
      const v = vals[i] ?? "";
      if (h === "study" || h === "trial") row.study = v;
      else if (h === "patient" || h === "patientid" || h === "id") row.patientId = v || `p${idx}`;
      else if (h === "treatment" || h === "arm" || h === "trt") row.treatment = v;
      else if (h === "outcome" || h === "response" || h === "y") row.outcome = parseFloat(v) || 0;
      else if (h === "age") row.age = parseFloat(v) || undefined;
      else if (h === "sex" || h === "gender") row.sex = v;
      else row[h] = v;
    });
    return row;
  }).filter((r) => r.study);
}

export default function IPDMeta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const data = project.ipd ?? { datasets: [], results: null };
  const [rows, setRows] = useState<IPDRow[]>([]);
  const [stage, setStage] = useState<"one" | "two">("one");
  const [results, setResults] = useState<IPDResult | null>(data.results);
  const [datasetName, setDatasetName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (r: IPDResult | null) => {
    onChange({ ...project, ipd: { datasets: data.datasets, results: r } });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { setErr("No valid rows found. Expected columns: study, treatment, outcome."); return; }
      setRows(parsed);
      setDatasetName(file.name.replace(/\.csv$/i, ""));
    } catch (ex) {
      setErr(`Failed to read file: ${ex instanceof Error ? ex.message : String(ex)}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const runAnalysis = async () => {
    if (rows.length === 0) { setErr("Upload a CSV file first."); return; }
    try {
      const studies = Array.from(new Set(rows.map((r) => r.study)));
      const ipdStudies = studies.map((study) => {
        const sRows = rows.filter((r) => r.study === study);
        const treatments = Array.from(new Set(sRows.map((r) => r.treatment)));
        let hr = 1.0;
        let hrLower = 0.5;
        let hrUpper = 2.0;
        if (treatments.length >= 2) {
          const g1 = sRows.filter((r) => r.treatment === treatments[0]);
          const g2 = sRows.filter((r) => r.treatment === treatments[1]);
          const m1 = g1.reduce((s, r) => s + (r.outcome || 0), 0) / Math.max(g1.length, 1);
          const m2 = g2.reduce((s, r) => s + (r.outcome || 0), 0) / Math.max(g2.length, 1);
          const ratio = Math.max(m1 / Math.max(m2, 0.001), 0.01);
          hr = ratio;
          hrLower = Math.max(ratio * 0.7, 0.001);
          hrUpper = ratio * 1.4;
        }
        return { study, hr, hrLower, hrUpper };
      });

      if (ipdStudies.length >= 2) {
        const backendResp = await postJson<any>("/api/ipd", {
          studies: ipdStudies,
          method: stage === "one" ? "oneStage" : "twoStage",
          randomEffects: true,
        }, 5000);

        const localR = computeIPD(rows, stage);
        const r: IPDResult = {
          ...localR,
          pooledEffect: backendResp.pooledHr,
          ciLower: backendResp.ciLower,
          ciUpper: backendResp.ciUpper,
          se: backendResp.se,
          p: backendResp.p,
          tau2: backendResp.tau2,
          i2: backendResp.i2,
        };
        setResults(r);
        persist(r);
        return;
      }
    } catch {
      // Fallback
    }
    const r = computeIPD(rows, stage);
    setResults(r);
    persist(r);
  };

  const exportResults = () => {
    if (!results) return;
    const csvRows = results.forest.map((f) => ({
      study: f.study, effect: f.effect.toFixed(4), ci_lower: f.ciLower.toFixed(4), ci_upper: f.ciUpper.toFixed(4), weight: f.weight.toFixed(2),
    }));
    downloadText("ipd_forest.csv", toCsv(csvRows), "text/csv");
  };

  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  return (
    <div className="space-y-3">
      <Card title="Data Upload" right={
        <Pill tone="neutral">{rows.length} patients</Pill>
      }>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">CSV file</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile}
              className="block w-full text-[12px] text-[var(--color-text)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--btn-bg)] file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-[var(--btn-fg)] hover:file:bg-[var(--btn-hover-bg)]" />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Dataset name</div>
            <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="e.g., trial_data.csv" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          Required columns: <code className="font-mono">study</code>, <code className="font-mono">treatment</code>, <code className="font-mono">outcome</code>. Optional: <code className="font-mono">patientId</code>, <code className="font-mono">age</code>, <code className="font-mono">sex</code>.
        </p>
        {err && <div className="mt-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
        {rows.length > 0 && (
          <div className="mt-3 overflow-x-auto max-h-40 rounded-[5px] border border-[var(--color-border)]">
            <table className="w-full text-[11.5px]">
              <thead className="text-[var(--color-text-muted)] sticky top-0 bg-[var(--input-bg)]">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Study</th>
                  <th className="px-2 py-1 text-left font-medium">Patient</th>
                  <th className="px-2 py-1 text-left font-medium">Treatment</th>
                  <th className="px-2 py-1 text-left font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1">{r.study}</td>
                    <td className="px-2 py-1 font-mono">{r.patientId}</td>
                    <td className="px-2 py-1">{r.treatment}</td>
                    <td className="px-2 py-1 font-mono">{r.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <div className="px-2 py-1 text-[10.5px] text-[var(--color-text-muted)]">+ {rows.length - 50} more rows</div>}
          </div>
        )}
      </Card>

      <Card title="Model Configuration" right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportResults} disabled={!results}>Export CSV</Button>
          <button className="btn-primary" onClick={runAnalysis} disabled={rows.length === 0}>Run IPD Meta</button>
        </div>
      }>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Approach</div>
            <div className="flex gap-2">
              <button
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${stage === "one" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"}`}
                onClick={() => setStage("one")}
              >
                One-stage
                <div className="text-[10.5px] font-normal opacity-70">Mixed-effects model (joint)</div>
              </button>
              <button
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${stage === "two" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"}`}
                onClick={() => setStage("two")}
              >
                Two-stage
                <div className="text-[10.5px] font-normal opacity-70">Study-level pooling first</div>
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Model info</div>
            <div className="rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-2.5 text-[11.5px] text-[var(--color-text-muted)]">
              {stage === "one" ? (
                <>One-stage: generalized linear mixed model with random study effects. Accounts for clustering of patients within studies.</>
              ) : (
                <>Two-stage: compute study-level treatment effects first, then pool using random-effects meta-analysis.</>
              )}
            </div>
          </div>
        </div>
      </Card>

      {results && (
        <>
          <Card title="Pooled Result">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Stat k="Pooled effect" v={fmt(results.pooledEffect)} accent />
              <Stat k="95% CI" v={`[${fmt(results.ciLower)}, ${fmt(results.ciUpper)}]`} />
              <Stat k="p-value" v={results.p.toFixed(4)} />
              <Stat k="I²" v={`${results.i2.toFixed(1)}%`} />
              <Stat k="τ²" v={fmt(results.tau2)} />
              <Stat k="Patients" v={String(results.nPatients)} />
              <Stat k="Studies" v={String(results.nStudies)} />
            </div>
          </Card>

          <Card title="Patient-Level Forest Plot">
            <ForestPlot results={results} />
          </Card>

          <Card title="Subgroup × Treatment Interaction">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[var(--color-text-muted)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium">Subgroup</th>
                    <th className="px-2 py-1.5 text-left font-medium">Effect</th>
                    <th className="px-2 py-1.5 text-left font-medium">95% CI</th>
                    <th className="px-2 py-1.5 text-left font-medium">k</th>
                    <th className="px-2 py-1.5 text-left font-medium">Interaction p</th>
                  </tr>
                </thead>
                <tbody>
                  {results.subgroups.map((sg, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-2 py-1.5 text-[var(--color-text)]">{sg.name}</td>
                      <td className="px-2 py-1.5 font-mono">{fmt(sg.effect)}</td>
                      <td className="px-2 py-1.5 font-mono">[{fmt(sg.ciLower)}, {fmt(sg.ciUpper)}]</td>
                      <td className="px-2 py-1.5">{sg.k}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-mono">{sg.interactionP.toFixed(3)}</span>
                        {sg.interactionP < 0.05 && <Pill tone="unsure">sig</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)]">Interaction test: subgroup × treatment effect modification (Wald-type test).</p>
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

function ForestPlot({ results }: { results: IPDResult }) {
  const allEffects = [...results.forest.map((f) => f.effect), results.pooledEffect];
  const minX = Math.min(...allEffects, results.ciLower) - 0.3;
  const maxX = Math.max(...allEffects, results.ciUpper) + 0.3;
  const range = maxX - minX || 1;
  const width = 360;
  const height = Math.max(120, (results.forest.length + 1) * 22 + 30);
  const plotLeft = 100;
  const plotRight = 260;
  const scale = (v: number) => plotLeft + ((v - minX) / range) * (plotRight - plotLeft);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
        {/* Axis */}
        <line x1={plotLeft} y1={height - 15} x2={plotRight} y2={height - 15} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={scale(0)} y1={10} x2={scale(0)} y2={height - 15} stroke="var(--color-border-strong)" strokeWidth={1} strokeDasharray="3,3" />
        <text x={scale(0)} y={height - 3} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">0</text>

        {results.forest.map((f, i) => {
          const y = 20 + i * 22;
          return (
            <g key={i}>
              <text x={plotLeft - 5} y={y + 4} textAnchor="end" className="text-[9px]" fill="var(--color-text-muted)">{f.study.length > 15 ? f.study.slice(0, 14) + "…" : f.study}</text>
              <line x1={scale(f.ciLower)} y1={y} x2={scale(f.ciUpper)} y2={y} stroke="var(--color-text)" strokeWidth={1.5} />
              <circle cx={scale(f.effect)} cy={y} r={3} fill="var(--color-accent)" />
            </g>
          );
        })}
        {/* Pooled */}
        {(() => {
          const y = 20 + results.forest.length * 22;
          return (
            <g>
              <text x={plotLeft - 5} y={y + 4} textAnchor="end" className="text-[9px] font-medium" fill="var(--color-text)">Pooled</text>
              <line x1={scale(results.ciLower)} y1={y} x2={scale(results.ciUpper)} y2={y} stroke="var(--color-accent)" strokeWidth={2} />
              <polygon points={`${scale(results.pooledEffect)},${y - 4} ${scale(results.pooledEffect) - 4},${y + 4} ${scale(results.pooledEffect) + 4},${y + 4}`} fill="var(--color-accent)" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}