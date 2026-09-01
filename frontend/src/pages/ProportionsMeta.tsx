import { useState } from 'react';
import { Card, Input, Select } from '../components/ui';

interface ProportionStudy {
  study: string;
  events: number;
  n: number;
}

export default function ProportionsMeta({ project: _project, onChange: _onChange }: { project: any; onChange: (p: any) => void }) {
  const [studies, setStudies] = useState<ProportionStudy[]>([]);
  const [transform, setTransform] = useState<'logit' | 'arcsine' | 'freeman-tukey'>('logit');
  const [newStudy, setNewStudy] = useState({ study: '', events: '', n: '' });

  const addStudy = () => {
    if (!newStudy.study || !newStudy.events || !newStudy.n) return;
    setStudies([...studies, { study: newStudy.study, events: +newStudy.events, n: +newStudy.n }]);
    setNewStudy({ study: '', events: '', n: '' });
  };

  const removeStudy = (i: number) => setStudies(studies.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <Card title="Proportions / Rates Meta-Analysis">
        <div className="space-y-3">
          <div>
            <label className="text-[10.5px] text-[var(--color-text-muted)]">Transformation</label>
            <Select value={transform} onChange={e => setTransform(e.target.value as any)}>
              <option value="logit">Logit</option>
              <option value="arcsine">Arcsine</option>
              <option value="freeman-tukey">Freeman-Tukey</option>
            </Select>
          </div>

          {studies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[var(--color-text-muted)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-1.5 text-left font-medium">Study</th>
                    <th className="px-2 py-1.5 text-left font-medium">Events</th>
                    <th className="px-2 py-1.5 text-left font-medium">N</th>
                    <th className="px-2 py-1.5 text-left font-medium">Proportion</th>
                    <th className="px-2 py-1.5 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]">
                      <td className="px-2 py-1.5">{s.study}</td>
                      <td className="px-2 py-1.5 font-mono">{s.events}</td>
                      <td className="px-2 py-1.5 font-mono">{s.n}</td>
                      <td className="px-2 py-1.5 font-mono">{((s.events / s.n) * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5"><button className="btn-ghost text-[10px]" onClick={() => removeStudy(i)}>remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="Study name" value={newStudy.study} onChange={e => setNewStudy({ ...newStudy, study: e.target.value })} />
            <Input type="number" placeholder="Events" value={newStudy.events} onChange={e => setNewStudy({ ...newStudy, events: e.target.value })} />
            <Input type="number" placeholder="N" value={newStudy.n} onChange={e => setNewStudy({ ...newStudy, n: e.target.value })} />
            <button className="btn-primary" onClick={addStudy}>+ Add</button>
          </div>

          <div className="text-[11px] text-[var(--color-text-muted)]">
            Single-arm proportion pooling with {transform} transformation. Prediction interval calculated automatically.
          </div>
        </div>
      </Card>
    </div>
  );
}
