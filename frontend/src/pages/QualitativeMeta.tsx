import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Input, Pill } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";
import { postJson } from "../lib/api";

interface Code {
  id: string;
  name: string;
  description: string;
  study?: string;
  frequency?: number;
}

interface Theme {
  id: string;
  name: string;
  codes: string[];
}

interface QualitativeResult {
  codeFrequencies: { code: string; count: number; studies: number; prevalence: number }[];
  totalCodes: number;
  uniqueCodes: number;
}

export default function QualitativeMeta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const data = (project as any).qualitative ?? { codes: [], themes: [], narrative: "", results: null };
  const [codes, setCodes] = useState<Code[]>(data.codes || []);
  const [themes, setThemes] = useState<Theme[]>(data.themes || []);
  const [narrative, setNarrative] = useState(data.narrative || "");
  const [results, setResults] = useState<QualitativeResult | null>(data.results || null);
  const [newCode, setNewCode] = useState({ name: "", description: "", study: "" });
  const [newTheme, setNewTheme] = useState({ name: "" });
  const [busy, setBusy] = useState(false);

  const persist = (c: Code[], t: Theme[], n: string, r: QualitativeResult | null) => {
    onChange({
      ...project,
      qualitative: { codes: c, themes: t, narrative: n, results: r },
    } as any);
  };

  const addCode = () => {
    if (!newCode.name.trim()) return;
    const item: Code = {
      id: `c${Date.now()}`,
      name: newCode.name.trim(),
      description: newCode.description.trim(),
      study: newCode.study.trim() || "General",
      frequency: 1,
    };
    const next = [...codes, item];
    setCodes(next);
    setNewCode({ name: "", description: "", study: "" });
    persist(next, themes, narrative, results);
  };

  const removeCode = (id: string) => {
    const next = codes.filter((c) => c.id !== id);
    const nextThemes = themes.map((t) => ({ ...t, codes: t.codes.filter((cid) => cid !== id) }));
    setCodes(next);
    setThemes(nextThemes);
    persist(next, nextThemes, narrative, results);
  };

  const addTheme = () => {
    if (!newTheme.name.trim()) return;
    const item: Theme = { id: `t${Date.now()}`, name: newTheme.name.trim(), codes: [] };
    const next = [...themes, item];
    setThemes(next);
    setNewTheme({ name: "" });
    persist(codes, next, narrative, results);
  };

  const removeTheme = (id: string) => {
    const next = themes.filter((t) => t.id !== id);
    setThemes(next);
    persist(codes, next, narrative, results);
  };

  const toggleCodeInTheme = (themeId: string, codeId: string) => {
    const next = themes.map((t) => {
      if (t.id !== themeId) return t;
      const has = t.codes.includes(codeId);
      return { ...t, codes: has ? t.codes.filter((c) => c !== codeId) : [...t.codes, codeId] };
    });
    setThemes(next);
    persist(codes, next, narrative, results);
  };

  const handleNarrativeChange = (text: string) => {
    setNarrative(text);
    persist(codes, themes, text, results);
  };

  const runSynthesis = async () => {
    if (codes.length === 0) return;
    setBusy(true);
    try {
      const codeEntries = codes.map((c) => ({
        study: c.study || "Study",
        code: c.name,
        frequency: c.frequency || 1,
      }));
      const res = await postJson<QualitativeResult>("/api/advanced/qualitative", codeEntries, 5000);
      setResults(res);
      persist(codes, themes, narrative, res);
    } catch {
      // Local fallback
      const totalCodes = codes.length;
      const freqMap: Record<string, { count: number; studies: Set<string> }> = {};
      codes.forEach((c) => {
        const key = c.name.toLowerCase().trim();
        if (!freqMap[key]) freqMap[key] = { count: 0, studies: new Set() };
        freqMap[key].count += c.frequency || 1;
        freqMap[key].studies.add(c.study || "Study");
      });
      const uniqueCodes = Object.keys(freqMap).length;
      const totalDistinctStudies = Math.max(new Set(codes.map((c) => c.study || "Study")).size, 1);
      const codeFrequencies = Object.entries(freqMap)
        .map(([code, d]) => ({
          code,
          count: d.count,
          studies: d.studies.size,
          prevalence: d.studies.size / totalDistinctStudies,
        }))
        .sort((a, b) => b.count - a.count);

      const r: QualitativeResult = { totalCodes, uniqueCodes, codeFrequencies };
      setResults(r);
      persist(codes, themes, narrative, r);
    } finally {
      setBusy(false);
    }
  };

  const exportCodebook = () => {
    const rows = codes.map((c) => ({
      code: c.name,
      description: c.description,
      study: c.study || "",
      themes: themes.filter((t) => t.codes.includes(c.id)).map((t) => t.name).join("; "),
    }));
    downloadText("qualitative_codebook.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-3">
      <Card
        title="Qualitative Synthesis & Thematic Analysis"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{codes.length} codes</Pill>
            <Pill tone="neutral">{themes.length} themes</Pill>
            <button className="btn-primary min-w-[120px]" onClick={runSynthesis} disabled={busy || codes.length === 0}>
              {busy ? "Synthesizing…" : "Synthesize"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Code Book */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Code Book</span>
              {codes.length > 0 && (
                <button className="btn-ghost text-[11px]" onClick={exportCodebook}>
                  Export CSV
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input placeholder="Code name (e.g. Barriers to care)" value={newCode.name} onChange={(e) => setNewCode({ ...newCode, name: e.target.value })} />
              <Input placeholder="Description" value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} />
              <Input placeholder="Study citation" value={newCode.study} onChange={(e) => setNewCode({ ...newCode, study: e.target.value })} />
              <button className="btn-secondary" onClick={addCode}>+ Add Code</button>
            </div>
            {codes.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {codes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded border border-[var(--color-border)] px-2.5 py-1.5 bg-[var(--color-surface)]">
                    <div>
                      <span className="text-[12px] font-medium text-[var(--color-text)]">{c.name}</span>
                      {c.description && <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">— {c.description}</span>}
                      {c.study && <span className="ml-2 text-[10px] font-mono text-[var(--color-text-muted)]">({c.study})</span>}
                    </div>
                    <button className="btn-ghost text-[10px] text-[var(--color-exclude)]" onClick={() => removeCode(c.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Themes */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Themes & Code Tagging</div>
            <div className="flex gap-2">
              <Input placeholder="New theme name (e.g. Socioeconomic factors)" value={newTheme.name} onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })} />
              <button className="btn-secondary" onClick={addTheme}>+ Add Theme</button>
            </div>
            {themes.length > 0 && (
              <div className="mt-2 space-y-2">
                {themes.map((t) => (
                  <div key={t.id} className="rounded border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[var(--color-text)]">{t.name}</span>
                      <button className="btn-ghost text-[10px] text-[var(--color-exclude)]" onClick={() => removeTheme(t.id)}>
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {codes.map((c) => {
                        const active = t.codes.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            className={`rounded-full px-2 py-0.5 text-[11px] border transition-colors ${
                              active
                                ? "bg-[var(--color-accent)] text-white border-transparent"
                                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)]"
                            }`}
                            onClick={() => toggleCodeInTheme(t.id, c.id)}
                          >
                            {active ? "✓ " : "+ "} {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Narrative */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Narrative Synthesis</div>
            <textarea
              className="w-full rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none"
              rows={5}
              value={narrative}
              onChange={(e) => handleNarrativeChange(e.target.value)}
              placeholder="Write or paste your CERQual-informed narrative synthesis and conclusions..."
            />
          </div>
        </div>
      </Card>

      {results && (
        <Card title="Synthesis & Code Prevalence Frequency">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">{results.totalCodes}</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">Total Code Instances</div>
            </div>
            <div className="card p-2.5">
              <div className="text-[20px] font-semibold font-mono text-[var(--color-text)]">{results.uniqueCodes}</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">Unique Codes</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-[var(--color-border)]">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Frequency</th>
                  <th className="px-3 py-2 font-medium">Studies</th>
                  <th className="px-3 py-2 font-medium">Prevalence</th>
                </tr>
              </thead>
              <tbody>
                {results.codeFrequencies.map((f) => (
                  <tr key={f.code} className="border-b border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{f.code}</td>
                    <td className="px-3 py-2 font-mono">{f.count}</td>
                    <td className="px-3 py-2 font-mono">{f.studies}</td>
                    <td className="px-3 py-2 font-mono">{(f.prevalence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
