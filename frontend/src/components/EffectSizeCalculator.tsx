import { useState } from 'react';
import { Card, Input, Button, Select } from './ui';
import { Calculator } from 'lucide-react';

interface Props {
  onCalculate: (result: { effect: number; ci_lower: number; ci_upper: number; measure: string }) => void;
}

export default function EffectSizeCalculator({ onCalculate }: Props) {
  const [mode, setMode] = useState<'binary' | 'continuous' | 'convert'>('binary');
  const [binary, setBinary] = useState({ a: '', b: '', c: '', d: '' });
  const [continuous, setContinuous] = useState({ m1: '', sd1: '', n1: '', m2: '', sd2: '', n2: '' });
  const [conversion, setConversion] = useState({ from: 'OR', to: 'RR', value: '' });

  const calcBinary = () => {
    const a = parseFloat(binary.a) + 0.5;
    const b = parseFloat(binary.b) + 0.5;
    const c = parseFloat(binary.c) + 0.5;
    const d = parseFloat(binary.d) + 0.5;
    const or = (a * d) / (b * c);
    const lnOR = Math.log(or);
    const se = Math.sqrt(1/a + 1/b + 1/c + 1/d);
    onCalculate({ effect: lnOR, ci_lower: lnOR - 1.96 * se, ci_upper: lnOR + 1.96 * se, measure: 'OR' });
  };

  const calcContinuous = () => {
    const m1 = parseFloat(continuous.m1);
    const sd1 = parseFloat(continuous.sd1);
    const n1 = parseFloat(continuous.n1);
    const m2 = parseFloat(continuous.m2);
    const sd2 = parseFloat(continuous.sd2);
    const n2 = parseFloat(continuous.n2);
    const pooledSD = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
    const smd = (m1 - m2) / pooledSD;
    const se = Math.sqrt((n1 + n2) / (n1 * n2) + smd ** 2 / (2 * (n1 + n2)));
    onCalculate({ effect: smd, ci_lower: smd - 1.96 * se, ci_upper: smd + 1.96 * se, measure: 'SMD' });
  };

  const convert = () => {
    const v = parseFloat(conversion.value);
    if (isNaN(v)) return;
    const p0 = 0.1; // baseline risk assumption
    let result = v;

    if (conversion.from === 'OR' && conversion.to === 'RR') {
      result = v / ((1 - p0) + (p0 * v));
    } else if (conversion.from === 'RR' && conversion.to === 'OR') {
      const denom = 1 - p0 * v;
      result = denom !== 0 ? (v * (1 - p0)) / denom : v;
    } else if (conversion.from === 'SMD' && conversion.to === 'OR') {
      result = Math.exp((v * Math.PI) / Math.sqrt(3));
    } else if (conversion.from === 'OR' && conversion.to === 'SMD') {
      result = (Math.log(Math.max(v, 1e-6)) * Math.sqrt(3)) / Math.PI;
    } else if (conversion.from === 'SMD' && conversion.to === 'RR') {
      const orVal = Math.exp((v * Math.PI) / Math.sqrt(3));
      result = orVal / ((1 - p0) + (p0 * orVal));
    } else if (conversion.from === 'RR' && conversion.to === 'SMD') {
      const denom = 1 - p0 * v;
      const orVal = denom !== 0 ? (v * (1 - p0)) / denom : v;
      result = (Math.log(Math.max(orVal, 1e-6)) * Math.sqrt(3)) / Math.PI;
    }
    onCalculate({ effect: result, ci_lower: result * 0.8, ci_upper: result * 1.25, measure: conversion.to });
  };

  return (
    <Card title="Effect Size Calculator" right={<Calculator className="h-4 w-4 text-[var(--color-accent)]" />}>
      <div className="space-y-3">
        <div className="flex gap-1">
          {(['binary', 'continuous', 'convert'] as const).map(m => (
            <button key={m} className={`btn-ghost text-[11px] ${mode === m ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`} onClick={() => setMode(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {mode === 'binary' && (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">Enter 2×2 table values (add 0.5 to each cell for continuity correction)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Int. events (a)" value={binary.a} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBinary({ ...binary, a: e.target.value })} />
              <Input type="number" placeholder="Int. no event (b)" value={binary.b} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBinary({ ...binary, b: e.target.value })} />
              <Input type="number" placeholder="Ctrl events (c)" value={binary.c} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBinary({ ...binary, c: e.target.value })} />
              <Input type="number" placeholder="Ctrl no event (d)" value={binary.d} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBinary({ ...binary, d: e.target.value })} />
            </div>
            <Button variant="default" size="sm" onClick={calcBinary}>Calculate OR</Button>
          </div>
        )}

        {mode === 'continuous' && (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">Enter means, SDs, and sample sizes for each group</p>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Mean 1" value={continuous.m1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, m1: e.target.value })} />
              <Input type="number" placeholder="SD 1" value={continuous.sd1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, sd1: e.target.value })} />
              <Input type="number" placeholder="N 1" value={continuous.n1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, n1: e.target.value })} />
              <Input type="number" placeholder="Mean 2" value={continuous.m2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, m2: e.target.value })} />
              <Input type="number" placeholder="SD 2" value={continuous.sd2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, sd2: e.target.value })} />
              <Input type="number" placeholder="N 2" value={continuous.n2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContinuous({ ...continuous, n2: e.target.value })} />
            </div>
            <Button variant="default" size="sm" onClick={calcContinuous}>Calculate SMD</Button>
          </div>
        )}

        {mode === 'convert' && (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">Convert between effect size metrics</p>
            <div className="flex gap-2">
              <Select value={conversion.from} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversion({ ...conversion, from: e.target.value })}>
                <option value="OR">OR (log)</option>
                <option value="RR">RR (log)</option>
                <option value="SMD">SMD (Hedges g)</option>
              </Select>
              <span className="text-[var(--color-text-muted)]">→</span>
              <Select value={conversion.to} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversion({ ...conversion, to: e.target.value })}>
                <option value="OR">OR</option>
                <option value="RR">RR</option>
                <option value="SMD">SMD</option>
              </Select>
            </div>
            <Input type="number" placeholder="Value" value={conversion.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConversion({ ...conversion, value: e.target.value })} />
            <Button variant="default" size="sm" onClick={convert}>Convert</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
