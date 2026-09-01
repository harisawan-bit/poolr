import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Select, Pill } from "../components/ui";
import { postJson } from "../lib/api";

interface DtaStudyInput {
  study: string;
  tp: number | null;
  fp: number | null;
  fn: number | null;
  tn: number | null;
}

interface DtaResult {
  model: string;
  sensitivity: number;
  specificity: number;
  sensCiLower: number;
  sensCiUpper: number;
  specCiLower: number;
  specCiUpper: number;
  dor: number;
  dorCiLower: number;
  dorCiUpper: number;
  auc: number;
  tau2Sens: number | null;
  tau2Spec: number | null;
  rho: number | null;
  studyResults: Array<{
    study: string;
    sensitivity: number;
    specificity: number;
  }>;
  warnings: string[];
}

const MODELS = [
  { value: "bivariate", label: "Bivariate Reitsma" },
  { value: "hsroc", label: "HSROC" },
];

export default function Dta({ project: _project, onChange: _onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [studies, setStudies] = useState<DtaStudyInput[]>([]);
  const [model, setModel] = useState("bivariate");
  const [result, setResult] = useState<DtaResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addStudy = () => {
    setStudies([...studies, { study: `S${studies.length + 1}`, tp: null, fp: null, fn: null, tn: null }]);
  };

  const updateStudy = (i: number, patch: Partial<DtaStudyInput>) => {
    setStudies(studies.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeStudy = (i: number) => {
    setStudies(studies.filter((_, idx) => idx !== i));
  };

  const run = async () => {
    if (studies.length < 2) { setErr("At least 2 studies required"); return; }
    if (studies.some(s => s.tp === null || s.fp === null || s.fn === null || s.tn === null)) {
      setErr("All studies need TP, FP, FN, TN"); return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson<DtaResult>("/api/dta", {
        studies: studies.map(s => ({ study: s.study, tp: s.tp, fp: s.fp, fn: s.fn, tn: s.tn })),
        model
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number, d = 3) => v.toFixed(d);
  const pct = (v: number) => (v * 100).toFixed(1);

  return (
    <div className="space-y-3">
      <Card title="Diagnostic Test Accuracy Meta-Analysis" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} studies</Pill>
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? "Running…" : "Run DTA"}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Model</div>
            <Select value={model} onChange={e => setModel(e.target.value)}>
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-semibold">Studies</div>
            <button className="btn-ghost" onClick={addStudy}>+ Add study</button>
          </div>
          <div className="space-y-1.5">
            {studies.map((s, i) => (
              <div key={i} className="grid grid-cols-6 gap-1.5 rounded border border-[var(--color-border)] p-1.5">
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="Study" value={s.study}
                  onChange={e => updateStudy(i, { study: e.target.value })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="TP" type="number"
                  value={s.tp ?? ""} onChange={e => updateStudy(i, { tp: e.target.value ? Number(e.target.value) : null })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="FP" type="number"
                  value={s.fp ?? ""} onChange={e => updateStudy(i, { fp: e.target.value ? Number(e.target.value) : null })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="FN" type="number"
                  value={s.fn ?? ""} onChange={e => updateStudy(i, { fn: e.target.value ? Number(e.target.value) : null })} />
                <input className="col-span-1 bg-transparent text-[11px] outline-none" placeholder="TN" type="number"
                  value={s.tn ?? ""} onChange={e => updateStudy(i, { tn: e.target.value ? Number(e.target.value) : null })} />
                <button className="col-span-1 text-[10px] text-[var(--color-exclude)]" onClick={() => removeStudy(i)}>remove</button>
              </div>
            ))}
          </div>
        </div>

        {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
      </Card>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card title="Warnings">
              {result.warnings.map((w, i) => (
                <div key={i} className="text-[12px] text-amber-500">{w}</div>
              ))}
            </Card>
          )}

          <Card title="Pooled Estimates">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{pct(result.sensitivity)}%</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Sensitivity [{pct(result.sensCiLower)}-{pct(result.sensCiUpper)}]</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{pct(result.specificity)}%</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Specificity [{pct(result.specCiLower)}-{pct(result.specCiUpper)}]</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(result.dor, 2)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">DOR [{fmt(result.dorCiLower, 2)}-{fmt(result.dorCiUpper, 2)}]</div>
              </div>
              <div className="card p-2.5">
                <div className="text-[18px] font-semibold">{fmt(result.auc, 3)}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">AUC</div>
              </div>
            </div>
          </Card>

          {result.rho !== null && (
            <Card title="Heterogeneity">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.tau2Sens ?? 0)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">τ² sensitivity</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.tau2Spec ?? 0)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">τ² specificity</div>
                </div>
                <div className="card p-2.5">
                  <div className="text-[18px] font-semibold">{fmt(result.rho ?? 0)}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">ρ (between-study corr)</div>
                </div>
              </div>
            </Card>
          )}

          <Card title="Study Details">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-2 py-1">Study</th>
                    <th className="px-2 py-1">Sensitivity</th>
                    <th className="px-2 py-1">Specificity</th>
                  </tr>
                </thead>
                <tbody>
                  {result.studyResults.map((s, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-1">{s.study}</td>
                      <td className="px-2 py-1 font-mono">{pct(s.sensitivity)}%</td>
                      <td className="px-2 py-1 font-mono">{pct(s.specificity)}%</td>
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
