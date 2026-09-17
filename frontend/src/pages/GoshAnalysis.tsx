import { useState } from 'react';
import { Card, Input, Button, Pill } from '../components/ui';
import { postJson } from '../lib/api';

interface GoshResult {
  subsets: { effect: number; size: number }[];
  bimodal: boolean;
  peak1: number;
  peak2: number;
}

function computeGosh(effects: number[], ses: number[], k: number): GoshResult {
  const n = effects.length;
  if (n < 4) return { subsets: [], bimodal: false, peak1: 0, peak2: 0 };
  const subK = Math.max(2, Math.floor(n / 2));
  const subsets: { effect: number; size: number }[] = [];
  for (let s = 0; s < k; s++) {
    const idxs: number[] = [];
    for (let i = 0; i < subK; i++) idxs.push((s + i * Math.floor(n / subK)) % n);
    const w = idxs.map(i => 1 / (ses[i] * ses[i]));
    const sw = w.reduce((a, b) => a + b, 0);
    const eff = idxs.reduce((sum, i, j) => sum + effects[i] * w[j], 0) / sw;
    subsets.push({ effect: eff, size: subK });
  }
  const sorted = [...subsets].sort((a, b) => a.effect - b.effect);
  const mid = Math.floor(sorted.length / 2);
  const peak1 = sorted.slice(0, mid).reduce((s, x) => s + x.effect, 0) / Math.max(mid, 1);
  const peak2 = sorted.slice(mid).reduce((s, x) => s + x.effect, 0) / Math.max(sorted.length - mid, 1);
  const bimodal = Math.abs(peak1 - peak2) > 0.3;
  return { subsets, bimodal, peak1, peak2 };
}

export default function GoshAnalysis({ project }: { project: any }) {
  const [tab, setTab] = useState<'input' | 'results'>('input');
  const [k, setK] = useState('100');
  const [effects, setEffects] = useState('-0.45 -0.51 -0.38 -0.62 -0.29 -0.55');
  const [ses, setSes] = useState('0.18 0.15 0.22 0.19 0.25 0.16');
  const [result, setResult] = useState<GoshResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    const eArr = effects.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const sArr = ses.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (eArr.length < 4) { setErr('Need at least 4 effect sizes'); return; }
    if (sArr.length < eArr.length) { setErr('Standard errors must match effect sizes'); return; }
    try {
      const resp = await postJson<any>('/api/advanced/gosh', { effects: eArr, ses: sArr, k: parseInt(k) });
      const local = computeGosh(eArr, sArr, parseInt(k));
      setResult(local);
      setTab('results');
    } catch {
      setResult(computeGosh(eArr, sArr, parseInt(k)));
      setTab('results');
    }
  };

  const fmt = (v: number) => Number.isFinite(v) ? v.toFixed(3) : '—';

  return (
    <div className="space-y-4">
      <Card title="GOSH Analysis (Graphic Overview of Study Heterogeneity)">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Analyzes effect-size distributions across study subsets to detect latent heterogeneity or bimodal patterns.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={`btn-ghost text-[11px] ${tab === 'input' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('input')}>Input</button>
          <button className={`btn-ghost text-[11px] ${tab === 'results' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('results')}>Results</button>
        </div>
      </Card>

      {tab === 'input' && (
        <Card title="Study Data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Effect sizes (space-separated)</div>
              <Input value={effects} onChange={e => setEffects(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Standard errors (space-separated)</div>
              <Input value={ses} onChange={e => setSes(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Number of subsets (k)</div>
            <Input type="number" value={k} onChange={e => setK(e.target.value)} />
          </div>
          {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-3 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
          <button className="btn-primary mt-3" onClick={run}>Run GOSH Analysis</button>
        </Card>
      )}

      {tab === 'results' && result && (
        <>
          <Card title="Subset Distribution">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
              <Stat k="Subsets" v={String(result.subsets.length)} />
              <Stat k="Bimodal?" v={result.bimodal ? 'Yes' : 'No'} accent={result.bimodal} />
              <Stat k="Peak 1" v={fmt(result.peak1)} />
              <Stat k="Peak 2" v={fmt(result.peak2)} />
            </div>
            <GoshHistogram subsets={result.subsets} />
          </Card>
          <Card title="Subset Effects">
            <table className="w-full text-[12px]">
              <thead className="text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-2 py-1.5 text-left">Subset</th>
                  <th className="px-2 py-1.5 text-left">Effect</th>
                  <th className="px-2 py-1.5 text-left">Size</th>
                </tr>
              </thead>
              <tbody>
                {result.subsets.map((s, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]">
                    <td className="px-2 py-1.5">{i + 1}</td>
                    <td className="px-2 py-1.5 font-mono">{fmt(s.effect)}</td>
                    <td className="px-2 py-1.5">{s.size}</td>
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

function GoshHistogram({ subsets }: { subsets: { effect: number; size: number }[] }) {
  if (!subsets.length) return null;
  const w = 360, h = 180, m = 30;
  const effects = subsets.map(s => s.effect);
  const minE = Math.min(...effects), maxE = Math.max(...effects);
  const bins = 10, bw = (maxE - minE) / bins || 1;
  const counts = Array(bins).fill(0);
  effects.forEach(e => counts[Math.min(bins - 1, Math.floor((e - minE) / bw))]++);
  const maxC = Math.max(...counts);
  return (
    <div className="flex justify-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        {counts.map((c, i) => (
          <rect key={i} x={m + (i * (w - 2 * m)) / bins} y={h - m - (c / maxC) * (h - 2 * m)}
            width={(w - 2 * m) / bins - 2} height={(c / maxC) * (h - 2 * m)} fill="var(--color-accent)" fillOpacity={0.7} />
        ))}
        <line x1={m} y1={h - m} x2={w - m} y2={h - m} stroke="var(--color-border)" />
        <line x1={m} y1={m} x2={m} y2={h - m} stroke="var(--color-border)" />
        <text x={w / 2} y={h - 5} textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">Effect Size</text>
      </svg>
    </div>
  );
}
