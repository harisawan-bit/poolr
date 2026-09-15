import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Button } from "../components/ui";
import { postJson } from "../lib/api";
import { ResultCard, ErrorDisplay } from "../components/StudyManager";
import { Loader2 } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

interface Props {
  project: Project;
}

export function RoB2Page({ project: _project }: Props) {
  const [studies, setStudies] = useState<any[]>([
    { study: "Study 1", d1_sequenceGeneration: 0, d2_blindingParticipants: 0, d3_missingData: 0, d4_outcomeMeasurement: 0, d5_selectionResult: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addStudy = () => setStudies([...studies, { study: `Study ${studies.length + 1}`, d1_sequenceGeneration: 0, d2_blindingParticipants: 0, d3_missingData: 0, d4_outcomeMeasurement: 0, d5_selectionResult: 0 }]);
  const updateStudy = (idx: number, field: string, value: any) => { const n = [...studies]; n[idx] = { ...n[idx], [field]: value }; setStudies(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/rob2", { studies })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Cochrane Risk of Bias 2 (RoB 2)" subtitle="5 domains: Randomization, Deviations, Missing data, Measurement, Selection">
        <div className="space-y-3">
          {studies.map((s, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 p-3 border border-[var(--color-border)] rounded">
              <input value={s.study} onChange={e => updateStudy(i, "study", e.target.value)} className="col-span-1 rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Study name" />
              {[["D1", "d1_sequenceGeneration"], ["D2", "d2_blindingParticipants"], ["D3", "d3_missingData"], ["D4", "d4_outcomeMeasurement"], ["D5", "d5_selectionResult"]].map(([, field]) => (
                <select key={field} value={(s as any)[field]} onChange={e => updateStudy(i, field, +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs">
                  <option value={0}>Low</option><option value={1}>Some</option><option value={2}>High</option>
                </select>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addStudy} variant="secondary" size="sm">+ Add Study</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Evaluate RoB 2"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-3 gap-3">
          <ResultCard title="Low risk" value={result.summary?.["Low risk"] || "0/0"} />
          <ResultCard title="Some concerns" value={result.summary?.["Some concerns"] || "0/0"} />
          <ResultCard title="High risk" value={result.summary?.["High risk"] || "0/0"} />
        </div>
        {result.svgTrafficLight && <div className="mt-3" dangerouslySetInnerHTML={{ __html: result.svgTrafficLight }} />}
      </Card>}
    </div>
  );
}

export function RobinsIPage({ project: _project }: Props) {
  const [studies, setStudies] = useState<any[]>([
    { study: "Study 1", confounding: 0, selection: 0, classification: 0, deviations: 0, missingData: 0, measurement: 0, reportedResult: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addStudy = () => setStudies([...studies, { study: `Study ${studies.length + 1}`, confounding: 0, selection: 0, classification: 0, deviations: 0, missingData: 0, measurement: 0, reportedResult: 0 }]);
  const updateStudy = (idx: number, field: string, value: any) => { const n = [...studies]; n[idx] = { ...n[idx], [field]: value }; setStudies(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/robins-i", { studies })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="ROBINS-I" subtitle="Risk Of Bias In Non-randomised Studies (7 domains)">
        <div className="space-y-3">
          {studies.map((s, i) => (
            <div key={i} className="p-3 border border-[var(--color-border)] rounded space-y-2">
              <input value={s.study} onChange={e => updateStudy(i, "study", e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Study name" />
              <div className="grid grid-cols-4 gap-2">
                {["confounding", "selection", "classification", "deviations", "missingData", "measurement", "reportedResult"].map(field => (
                  <select key={field} value={s[field]} onChange={e => updateStudy(i, field, +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs">
                    <option value={0}>Low</option><option value={1}>Moderate</option><option value={2}>Serious</option><option value={3}>Critical</option>
                  </select>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addStudy} variant="secondary" size="sm">+ Add Study</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Evaluate"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-4 gap-3">
          <ResultCard title="Low" value={result.summary?.["Low"] || "0/0"} />
          <ResultCard title="Moderate" value={result.summary?.["Moderate"] || "0/0"} />
          <ResultCard title="Serious" value={result.summary?.["Serious"] || "0/0"} />
          <ResultCard title="Critical" value={result.summary?.["Critical"] || "0/0"} />
        </div>
      </Card>}
    </div>
  );
}

export function Quadas2Page({ project: _project }: Props) {
  const [studies, setStudies] = useState<any[]>([
    { study: "Study 1", patientSelection_risk: 0, indexTest_risk: 0, referenceStandard_risk: 0, flowTiming_risk: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addStudy = () => setStudies([...studies, { study: `Study ${studies.length + 1}`, patientSelection_risk: 0, indexTest_risk: 0, referenceStandard_risk: 0, flowTiming_risk: 0 }]);
  const updateStudy = (idx: number, field: string, value: any) => { const n = [...studies]; n[idx] = { ...n[idx], [field]: value }; setStudies(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/quadas-2", { studies })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="QUADAS-2" subtitle="Quality Assessment of Diagnostic Accuracy Studies (4 domains)">
        <div className="space-y-3">
          {studies.map((s, i) => (
            <div key={i} className="p-3 border border-[var(--color-border)] rounded space-y-2">
              <input value={s.study} onChange={e => updateStudy(i, "study", e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Study name" />
              <div className="grid grid-cols-4 gap-2">
                {["patientSelection_risk", "indexTest_risk", "referenceStandard_risk", "flowTiming_risk"].map(field => (
                  <select key={field} value={s[field]} onChange={e => updateStudy(i, field, +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs">
                    <option value={0}>Low</option><option value={1}>Unclear</option><option value={2}>High</option>
                  </select>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addStudy} variant="secondary" size="sm">+ Add Study</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Evaluate"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-2 gap-3">
          <ResultCard title="Low risk" value={result.summary?.["Low risk"] || "0/0"} />
          <ResultCard title="High/Unclear" value={result.summary?.["High/Unclear risk"] || "0/0"} />
        </div>
      </Card>}
    </div>
  );
}

export function Amstar2Page({ project: _project }: Props) {
  const [assessments, setAssessments] = useState<any[]>([
    { reviewTitle: "Review 1", items: new Array(16).fill(2) },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addAssessment = () => setAssessments([...assessments, { reviewTitle: `Review ${assessments.length + 1}`, items: new Array(16).fill(0) }]);
  const updateItem = (aIdx: number, iIdx: number, value: number) => { const n = [...assessments]; n[aIdx].items[iIdx] = value; setAssessments(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/amstar-2", { assessments })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="AMSTAR-2" subtitle="Assessment of Systematic Reviews (16 items)">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {assessments.map((a, aIdx) => (
            <div key={aIdx} className="p-3 border border-[var(--color-border)] rounded space-y-2">
              <input value={a.reviewTitle} onChange={e => { const n = [...assessments]; n[aIdx].reviewTitle = e.target.value; setAssessments(n); }} className="w-full rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Review title" />
              <div className="grid grid-cols-4 gap-2">
                {a.items.map((item: number, iIdx: number) => (
                  <select key={iIdx} value={item} onChange={e => updateItem(aIdx, iIdx, +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs">
                    <option value={0}>No</option><option value={1}>Partial</option><option value={2}>Yes</option>
                  </select>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addAssessment} variant="secondary" size="sm">+ Add Review</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Evaluate"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        {result.results?.map((r: any, i: number) => (
          <div key={i} className="flex justify-between p-2 border border-[var(--color-border)] rounded text-xs mb-1">
            <span>{r.reviewTitle}</span>
            <span className="font-semibold">{r.overallConfidence} ({r.criticalFailures} critical)</span>
          </div>
        ))}
      </Card>}
    </div>
  );
}

export function NosPage({ project: _project }: Props) {
  const [studies, setStudies] = useState<any[]>([
    { study: "Study 1", representativeness: 1, selectionNonExposed: 1, ascertainmentExposure: 1, outcomeNotPresent: 1, comparability: 2, outcomeAssessment: 1, followUp: 1, adequacyFollowUp: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addStudy = () => setStudies([...studies, { study: `Study ${studies.length + 1}`, representativeness: 0, selectionNonExposed: 0, ascertainmentExposure: 0, outcomeNotPresent: 0, comparability: 0, outcomeAssessment: 0, followUp: 0, adequacyFollowUp: 0 }]);
  const updateStudy = (idx: number, field: string, value: any) => { const n = [...studies]; n[idx] = { ...n[idx], [field]: value }; setStudies(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/nos", { studies })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Newcastle-Ottawa Scale (NOS)" subtitle="Quality assessment for cohort/case-control studies">
        <div className="space-y-3">
          {studies.map((s, i) => (
            <div key={i} className="p-3 border border-[var(--color-border)] rounded space-y-2">
              <input value={s.study} onChange={e => updateStudy(i, "study", e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Study name" />
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(s).filter(k => k !== "study").map(field => (
                  <label key={field} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={s[field] > 0} onChange={e => updateStudy(i, field, e.target.checked ? 1 : 0)} className="rounded border-[var(--color-border)]" />
                    {field.slice(0, 8)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addStudy} variant="secondary" size="sm">+ Add Study</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Evaluate"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-3 gap-3">
          <ResultCard title="Good (7-9)" value={result.summary?.["Good (7-9 stars)"] || "0/0"} />
          <ResultCard title="Fair (4-6)" value={result.summary?.["Fair (4-6 stars)"] || "0/0"} />
          <ResultCard title="Poor (0-3)" value={result.summary?.["Poor (0-3 stars)"] || "0/0"} />
        </div>
      </Card>}
    </div>
  );
}

export function GradeEvidenceProfilePage({ project: _project }: Props) {
  const [studies, setStudies] = useState<any[]>([
    { study: "1", design: "RCT", robScore: 0, indirectness: 0, effectEstimate: 0.75, ciLower: 0.6, ciUpper: 0.9, totalN: 500 },
  ]);
  const [outcome, setOutcome] = useState("Mortality");
  const [intervention, setIntervention] = useState("Drug X");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const addStudy = () => setStudies([...studies, { study: `${studies.length + 1}`, design: "RCT", robScore: 0, indirectness: 0, effectEstimate: null, ciLower: null, ciUpper: null, totalN: 0 }]);
  const updateStudy = (idx: number, field: string, value: any) => { const n = [...studies]; n[idx] = { ...n[idx], [field]: value }; setStudies(n); };
  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/grade/evidence-profile", { studies, outcome, intervention, comparator: "Placebo", measure: "RR" })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="GRADE Evidence Profile" subtitle="Complete GRADE profiles with all 5 downgrade factors">
        <div className="grid grid-cols-2 gap-3">
          <input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="Outcome" className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" />
          <input value={intervention} onChange={e => setIntervention(e.target.value)} placeholder="Intervention" className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" />
        </div>
        <div className="space-y-3 mt-3 max-h-64 overflow-y-auto">
          {studies.map((s, i) => (
            <div key={i} className="p-3 border border-[var(--color-border)] rounded grid grid-cols-4 gap-2">
              <input value={s.study} onChange={e => updateStudy(i, "study", e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Study ID" />
              <select value={s.design} onChange={e => updateStudy(i, "design", e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs">
                <option value="RCT">RCT</option><option value="observational">Observational</option>
              </select>
              <input type="number" value={s.robScore ?? 0} onChange={e => updateStudy(i, "robScore", +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="RoB" />
              <input type="number" value={s.indirectness ?? 0} onChange={e => updateStudy(i, "indirectness", +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Indirect" />
              <input type="number" value={s.effectEstimate ?? ""} onChange={e => updateStudy(i, "effectEstimate", e.target.value ? +e.target.value : null)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="Effect" />
              <input type="number" value={s.ciLower ?? ""} onChange={e => updateStudy(i, "ciLower", e.target.value ? +e.target.value : null)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="CI lo" />
              <input type="number" value={s.ciUpper ?? ""} onChange={e => updateStudy(i, "ciUpper", e.target.value ? +e.target.value : null)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="CI hi" />
              <input type="number" value={s.totalN} onChange={e => updateStudy(i, "totalN", +e.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-xs" placeholder="N" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={addStudy} variant="secondary" size="sm">+ Add Study</Button>
          <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : "Generate Profile"}</Button>
        </div>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="GRADE Evidence Profile">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ResultCard title="Pooled Effect" value={result.pooledEffect ? F(result.pooledEffect) : "—"} ci={result.ciLower ? [result.ciLower, result.ciUpper] : undefined} />
            <ResultCard title="Certainty" value={`${result.initialCertainty} → ${result.finalCertainty}`} subtitle={`${result.totalDowngrades} downgrades`} />
          </div>
          {result.factors?.map((f: any, i: number) => (
            <div key={i} className="flex justify-between text-xs p-2 border border-[var(--color-border)] rounded">
              <span>{f.factor}</span>
              <span>{f.assessment} ({f.downgrade > 0 ? `-${f.downgrade}` : "no change"})</span>
            </div>
          ))}
        </div>
      </Card>}
    </div>
  );
}

export function TesPage({ project }: Props) {
  const [alpha, setAlpha] = useState(0.05);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  for (const s of studies) { if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) { effects.push(s.effect_size); variances.push(s.effect_se * s.effect_se); } }

  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/tes", { effects, variances, alpha, nSimulations: 5000, seed: 42 })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Test of Excess Significance (TES)" subtitle="Detects selective reporting">
        <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">Alpha</span>
          <input type="number" value={alpha} onChange={e => setAlpha(+e.target.value)} step={0.01} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" />
        </label>
        <Button onClick={run} disabled={busy || effects.length < 3} className="mt-3">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Running...</> : "Run TES"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-4 gap-3">
          <ResultCard title="Observed sig." value={result.observedSignificant} />
          <ResultCard title="Expected sig." value={F(result.expectedSignificant, 1)} />
          <ResultCard title="Ratio" value={F(result.ratio, 2)} />
          <ResultCard title="p-value" value={F(result.pValue, 4)} />
        </div>
        <div className={`text-xs rounded p-2 mt-3 ${result.excessSignificance ? "text-yellow-400 bg-yellow-900/20" : "text-green-400 bg-green-900/20"}`}>{result.interpretation}</div>
      </Card>}
    </div>
  );
}
