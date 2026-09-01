import { useState } from 'react';
import { Card, Input } from '../components/ui';

interface Code {
  id: string;
  name: string;
  description: string;
}

interface Theme {
  id: string;
  name: string;
  codes: string[];
}

export default function QualitativeMeta({ project, onChange }: { project: any; onChange: (p: any) => void }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [newCode, setNewCode] = useState({ name: '', description: '' });
  const [newTheme, setNewTheme] = useState({ name: '', codes: [] as string[] });
  const [narrative, setNarrative] = useState('');

  const addCode = () => {
    if (!newCode.name) return;
    setCodes([...codes, { id: `c${Date.now()}`, ...newCode }]);
    setNewCode({ name: '', description: '' });
  };

  const addTheme = () => {
    if (!newTheme.name) return;
    setThemes([...themes, { id: `t${Date.now()}`, ...newTheme }]);
    setNewTheme({ name: '', codes: [] });
  };

  return (
    <div className="space-y-3">
      <Card title="Qualitative Synthesis">
        <div className="space-y-3">
          {/* Code Book */}
          <div>
            <div className="mb-2 text-[12px] font-medium">Code Book</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Code name" value={newCode.name} onChange={e => setNewCode({ ...newCode, name: e.target.value })} />
              <Input placeholder="Description" value={newCode.description} onChange={e => setNewCode({ ...newCode, description: e.target.value })} />
            </div>
            <button className="btn-primary mt-2" onClick={addCode}>+ Add Code</button>
            {codes.length > 0 && (
              <div className="mt-2 space-y-1">
                {codes.map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1">
                    <span className="text-[12px] font-medium">{c.name}</span>
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">{c.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Themes */}
          <div>
            <div className="mb-2 text-[12px] font-medium">Themes</div>
            <div className="flex gap-2">
              <Input placeholder="Theme name" value={newTheme.name} onChange={e => setNewTheme({ ...newTheme, name: e.target.value })} />
              <button className="btn-primary" onClick={addTheme}>+ Add Theme</button>
            </div>
            {themes.length > 0 && (
              <div className="mt-2 space-y-1">
                {themes.map(t => (
                  <div key={t.id} className="rounded border border-[var(--color-border)] p-2">
                    <div className="text-[12px] font-medium">{t.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.codes.map(cid => {
                        const code = codes.find(c => c.id === cid);
                        return code ? <span key={cid} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px]">{code.name}</span> : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Narrative */}
          <div>
            <div className="mb-2 text-[12px] font-medium">Narrative Synthesis</div>
            <textarea
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none"
              rows={6}
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="Write your narrative synthesis here..."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
