import { useState } from 'react';
import { Card, Input, Button, Pill } from '../components/ui';
import { postJson } from '../lib/api';

interface PermResult {
  observedES: number;
  permP: number;
  nPerm: number;
  ciLower: number;
  ciUpper: number;
  permDist: { bin: number; count: number }[];
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

function runPermTest(effects: number[], ses: number[], nPerm: number): PermResult {
  const n = effects.length;
  const weights = effects.map((_, i) => 1 / (ses[i] * ses[i]));
  const sw = weights.reduce((a, b) => a + b, 0);
  const obsES = effects.reduce((s, e, i) => s + e * weights[i], 0) / sw;
  const obsSE = Math.sqrt(1 / sw);
  let exceed = 0;
  const dist: number[] = [];
  for (let p = 0; p < nPerm; p++) {
    let permES = 0;
    for (let i = 0; i < n; i++) {
      const sign = Math.random() < 0.5 ? -1 : 1;
      permES += sign * effects[i] * weights[i];
    }
    permES /= sw;
    dist.push(permES);
    if (Math.abs(permES) >= Math.abs(obsES)) exceed++;
  }
  const permP = Math.max(1 / nPerm, exceed / nPerm);
  dist.sort((a, b) => a - b);
  const lowerIdx = Math.floor(nPerm * 0.025);
  const upperIdx = Math.floor(nPerm * 0.975);
  const bins = 20;
  const minD = Math.min(...dist), maxD = Math.max(...dist);
  const bw = (maxD - minD) / bins || 1;
  const permDist = Array.from({ length: bins }, (_, i) => ({
    bin: minD + i * bw + bw / 2,
    count: dist.filter(d => d >= minD + i * bw && d < minD + (i + 1) * bw).length
  }));
  return { observedES: obsES, permP, nPerm, ciLower: dist[lowerIdx], ciUpper: dist[upperIdx], permDist };
}

export default function PermutationTest({ project }: { project: any }) {
  const [tab, setTab] = useState<'input' | 'results'>('input');
  const [nPerm, setNPerm] = useState('1000');
  const [effects, setEffects] = useState('-0.45 -0.51 -0.38 -0.62 -0.29');
  const [ses, setSes] = useState('0.18 0.15 0.22 0.19 0.25');
  const [result, setResult] = useState<PermResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    const eArr = effects.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const sArr = ses.trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (eArr.length < 3) { setErr('Need at least 3 effect sizes'); return; }
    try {
      const resp = await postJson<any>('/api/advanced/permutation', { effects: eArr, ses: sArr, nPerm: parseInt(nPerm) });
      setResult(runPermTest(eArr, sArr, parseInt(nPerm)));
      setTab('results');
    } catch {
      setResult(runPermTest(eArr, sArr, parseInt(nPerm)));
      setTab('results');
    }
  };

  const fmt = (v: number) => Number.isFinite(v) ? v.toFixed(4) : '—';

  return (
    <div className="space-y-4">
      <Card title="Permutation Test for Meta-Analysis">
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Non-parametric significance test via random permutation of study effect signs.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={`btn-ghost text-[11px] ${tab === 'input' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('input')}>Input</button>
          <button className={`btn-ghost text-[11px] ${tab === 'results' ? '!border-[var(--color-accent)]' : ''}`} onClick={() => setTab('results')}>Results</button>
        </div>
      </Card>

      {tab === 'input' && (
        <Card title="Study Data">
          <div className="space-y-3">
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
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">Permutations</div>
              <Input type="number" value={nPerm} onChange={e => setNPerm(e.target.value)} />
            </div>
          </div>
          {err && <div className="mt-2 rounded border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-3 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
          <button className="btn-primary mt-3" onClick={run}>Run Permutation Test</button>
        </Card>
      )}

      {tab === 'results' && result && (
        <>
          <Card title="Permutation Results">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Stat k="Observed ES" v={fmt(result.observedES)} accent />
              <Stat k="Permutation p" v={result.permP.toFixed(4)} />
              <Stat k="95% Perm CI" v={`[${fmt(result.ciLower)}, ${fmt(result.ciUpper)}]`} />
              <Stat k="Permutations" v={String(result.nPerm)} />
            </div>
          </Card>
          <Card title="Permutation Distribution">
            <PermHistogram dist={result.permDist} observed={result.observedES} />
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}

function PermHistogram({ dist, observed }: { dist: { bin: number; count: number }[]; observed: number }) {
  const w = 360, h = 180, m = 30;
  const maxC = Math.max(...dist.map(d => d.count));
  return (
    <div className="flex justify-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        {dist.map((d, i) => (
          <rect key={i} x={m + (i * (w - 2 * m)) / dist.length} y={h - m - (d.count / maxC) * (h - 2 * m)}
            width={(w - 2 * m) / dist.length - 1} height={(d.count / maxC) * (h - 2 * m)} fill="var(--color-accent)" fillOpacity={0.6} />
        ))}
        <line x1={m} y1={h - m} x2={w - m} y2={h - m} stroke="var(--color-border)" />
        <line x1={m} y1={m} x2={m} y2={h - m} stroke="var(--color-border)" />
      </svg>
    </div>
  );
}
