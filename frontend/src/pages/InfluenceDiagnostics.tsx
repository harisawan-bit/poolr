import { useState } from 'react';
import { Card, Input, Button, Pill } from '../components/ui';
import { postJson } from '../lib/api';

interface InfluenceRow {
  study: string;
  effect: number;
  se: number;
  cookD: number;
  dffits: number;
  covratio: number;
  dfbetas: number;
  influential: boolean;
}

interface InfluenceResult {
  rows: InfluenceRow[];
  threshold: number;
  nInfluential: number;
  pooledWith: number;
  pooledWithout: number;
}

function computeInfluence(effects: number[], ses: number[], studies: string[]): InfluenceResult {
  const n = effects.length;
  const weights = effects.map((_, i) => 1 / (ses[i] * ses[i]));
  const sw = weights.reduce((a, b) => a + b, 0);
  const pooled = effects.reduce((s, e, i) => s + e * weights[i], 0) / sw;
  const rows: InfluenceRow[] = effects.map((e, i) => {
    const wOth = sw - weights[i];
    const pOth = wOth > 0 ? (pooled * sw - e * weights[i]) / wOth : pooled;
    const cookD = weights[i] * (e - pOth) ** 2 / (2 * sw);
    const dffits = (e - pOth) / (ses[i] * Math.sqrt(Math.max(weights[i], 0.001)));
    const covratio = Math.abs(1 / (1 - weights[i] / sw));
    const dfbetas = (pooled - pOth) / ses[i];
    return { study: studies[i], effect: e, se: ses[i], cookD, dffits, covratio, dfbetas, influential: false };
  });
  const threshold = 4 / n;
  let nInfl = 0;
  rows.forEach(r => { r.influential = r.cookD > threshold || Math.abs(r.dffits) > 2 * Math.sqrt(2 / n); if (r.influential) nInfl++; });
  const kept = rows.filter(r => !r.influential);
  const sw2 = kept.reduce((s, r) => s + 1 / (r.se * r.se), 0);
  const pooledWithout = kept.reduce((s, r) => s + r.effect / (r.se * r.se), 0) / sw2;
  return { rows, threshold, nInfluential: nInfl, pooledWith: pooled, pooledWithout };
}

export default function InfluenceDiagnostics({ project }: { project: any }) {
  const [tab, setTab] = useState<'input' | 'results'>('input');
  const [studies, setStudies] = useState('Smith 2020, Jones 2019, Lee 2021, Garcia 2018, Chen 2022');
  const [effects, setEffects] = useState('-0.45 -0.51 -0.38 -0.62 -0.29');
  const [ses, setSes] = useState('0.18 0.15 0.22 0.19 0.25');
  const [result, setResult] = useState<InfluenceResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    const sArr = studies.split(',').map(s => s.trim());
    const eArr = effects.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const seArr = ses.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (sArr.length !== eArr.length) { setErr('Study count must match effect sizes'); return; }
    try {
      const resp = await postJson<any>('/api/competitive/influence', { studies: sArr, effects: eArr, ses: seArr });
      setResult(computeInfluence(eArr, seArr, sArr));
      setTab('results');
    } catch {
      setResult(computeInfluence(eArr, seArr, sArr));
      setTab('results');
    }
  };

  const fmt = (v: number) => Number.isFinite(v) ? v.toFixed(3) : '—';

  return (
    <div className="space-y-4">
      <Card title="Influence Diagnostics">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Cook's distance, DFFITS, COVRATIO, and DFBETAS for identifying influential studies.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={`btn-ghost text-[11px] ${tab === 'input' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('input')}>Input</button>
          <button className={`btn-ghost text-[11px] ${tab === 'results' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('results')}>Results</button>
        </div>
      </Card>

      {tab === 'input' && (
        <Card title="Study Data">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Study names (comma-separated)</div>
              <Input value={studies} onChange={e => setStudies(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Effect sizes</div>
                <Input value={effects} onChange={e => setEffects(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Standard errors</div>
                <Input value={ses} onChange={e => setSes(e.target.value)} />
              </div>
            </div>
          </div>
          {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-3 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
          <button className="btn-primary mt-3" onClick={run}>Run Diagnostics</button>
        </Card>
      )}

      {tab === 'results' && result && (
        <>
          <Card title="Influence Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Stat k="Studies" v={String(result.rows.length)} />
              <Stat k="Influential" v={String(result.nInfluential)} accent />
              <Stat k="Pooled (all)" v={fmt(result.pooledWith)} />
              <Stat k="Pooled (removed)" v={fmt(result.pooledWithout)} />
            </div>
          </Card>
          <Card title="Influence Table">
            <table className="w-full text-[11.5px]">
              <thead className="text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-2 py-1.5 text-left">Study</th>
                  <th className="px-2 py-1.5 text-left">Effect</th>
                  <th className="px-2 py-1.5 text-left">Cook's D</th>
                  <th className="px-2 py-1.5 text-left">DFFITS</th>
                  <th className="px-2 py-1.5 text-left">COVRATIO</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className={`border-b border-[var(--color-border)] ${r.influential ? 'bg-[var(--color-exclude)]/5' : ''}`}>
                    <td className="px-2 py-1.5">{r.study}</td>
                    <td className="px-2 py-1.5 font-mono">{fmt(r.effect)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmt(r.cookD)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmt(r.dffits)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmt(r.covratio)}</td>
                    <td className="px-2 py-1.5">{r.influential ? <Pill tone="exclude">Influential</Pill> : <Pill tone="include">OK</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? 'text-[var(--color-exclude)]' : 'text-[var(--color-text)]'}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}
