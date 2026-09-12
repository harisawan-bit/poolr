import { useState, useMemo } from 'react';
import { Card, Input, Select, EmptyState } from '../components/ui';
import { Download, Copy, Check, Plus, X } from 'lucide-react';
import type { Project, Pico } from '../lib/project';

interface SearchTerm {
  id: string;
  term: string;
  field: 'title_abstract' | 'mesh' | 'all';
  subTerms: string[];
  operator: 'OR' | 'AND';
}

interface SearchStrategy {
  id: string;
  name: string;
  database: string;
  query: string;
  terms: SearchTerm[];
}

const DATABASES = [
  { id: 'pubmed', name: 'PubMed', syntax: 'pubmed', hasMesh: true },
  { id: 'embase', name: 'Embase', syntax: 'embase', hasMesh: true },
  { id: 'cochrane', name: 'Cochrane CENTRAL', syntax: 'cochranecentral', hasMesh: false },
  { id: 'scopus', name: 'Scopus', syntax: 'scopus', hasMesh: false },
  { id: 'webofscience', name: 'Web of Science', syntax: 'wos', hasMesh: false },
  { id: 'psycinfo', name: 'PsycINFO', syntax: 'psycinfo', hasMesh: true },
  { id: 'cinahl', name: 'CINAHL', syntax: 'cinahl', hasMesh: true },
];

const MESH_EXAMPLES: Record<string, string[]> = {
  population: ['Adults', 'Aged', 'Child', 'Adolescent', 'Infant', 'Middle Aged', 'Pregnancy'],
  intervention: ['Therapeutics', 'Drug Therapy', 'Surgical Procedures', 'Psychotherapy', 'Exercise'],
  outcome: ['Treatment Outcome', 'Survival', 'Quality of Life', 'Morbidity', 'Recurrence'],
  studyDesign: ['Randomized Controlled Trial', 'Cohort Studies', 'Case-Control Studies', 'Systematic Review'],
};

function buildBooleanQuery(terms: SearchTerm[], database: string, pico: Pico): string {
  const isScopus = database === 'scopus';
  const isWos = database === 'webofscience';
  const isCinahl = database === 'cinahl';
  const isEmbase = database === 'embase';
  const isPubmed = database === 'pubmed';
  const isPsyc = database === 'psycinfo';

  let step = 1;

  const picoTerms: { label: string; terms: string[] }[] = [];

  if (pico.population) {
    const popTerms = [`"${pico.population}"[Title/Abstract]`, `"${pico.population}"[MeSH Terms]`];
    if (isScopus) popTerms[1] = `INDEXTERM("${pico.population}")`;
    if (isWos) popTerms[1] = `TI="${pico.population}" OR AB="${pico.population}"`;
    if (isCinahl) popTerms[1] = `MH "${pico.population}"`;
    picoTerms.push({ label: 'Population', terms: popTerms });
  }
  if (pico.intervention) {
    const intTerms = [`"${pico.intervention}"[Title/Abstract]`, `"${pico.intervention}"[MeSH Terms]`];
    if (isScopus) intTerms[1] = `INDEXTERM("${pico.intervention}")`;
    if (isWos) intTerms[1] = `TI="${pico.intervention}" OR AB="${pico.intervention}"`;
    if (isCinahl) intTerms[1] = `MH "${pico.intervention}"`;
    picoTerms.push({ label: 'Intervention', terms: intTerms });
  }
  if (pico.comparator) {
    const compTerms = [`"${pico.comparator}"[Title/Abstract]`, `"${pico.comparator}"[MeSH Terms]`];
    if (isScopus) compTerms[1] = `INDEXTERM("${pico.comparator}")`;
    if (isWos) compTerms[1] = `TI="${pico.comparator}" OR AB="${pico.comparator}"`;
    if (isCinahl) compTerms[1] = `MH "${pico.comparator}"`;
    picoTerms.push({ label: 'Comparator', terms: compTerms });
  }
  if (pico.outcomes) {
    const outcomeTerms = pico.outcomes.split(/[,;]/).map(o => `"${o.trim()}"[Title/Abstract]`);
    const meshTerms = pico.outcomes.split(/[,;]/).map(o => `"${o.trim()}"[MeSH Terms]`);
    picoTerms.push({ label: 'Outcomes', terms: [...outcomeTerms, ...meshTerms] });
  }

  let filterTerms: string[] = [];
  if (terms.some(t => t.id === 'filter_design')) {
    if (isPubmed) filterTerms.push('"Randomized Controlled Trial"[Publication Type]', '"Controlled Clinical Trial"[Publication Type]');
    if (isEmbase) filterTerms.push("'randomized controlled trial'/exp", "'controlled clinical trial'/exp");
    if (isScopus) filterTerms.push('INDEXTERM("Randomized Controlled Trials")');
    if (isWos) filterTerms.push('TI="randomized controlled trial" OR AB="randomized controlled trial"');
    if (isCinahl) filterTerms.push('MH "Randomized Controlled Trials"');
    if (isPsyc) filterTerms.push('INDEXTERM("Randomized Controlled Trials")');
  }

  if (terms.some(t => t.id === 'filter_date')) {
    if (isPubmed) filterTerms.push('("2015/01/01"[Date - Publication] : "2024/12/31"[Date - Publication])');
    if (isEmbase) filterTerms.push('[2015-2024]/py');
    if (isScopus) filterTerms.push('PUBYEAR > 2015');
    if (isWos) filterTerms.push('PY=2015-2024');
    if (isCinahl) filterTerms.push('PY 2015-2024');
  }

  if (terms.some(t => t.id === 'filter_lang')) {
    if (isPubmed) filterTerms.push('"English"[Language]');
    if (isEmbase) filterTerms.push('[english]/lim');
    if (isScopus) filterTerms.push('LANGUAGE("English")');
    if (isWos) filterTerms.push('LA="English"');
    if (isCinahl) filterTerms.push('LA English');
  }

  const queryParts: string[] = [];

  picoTerms.forEach((pt, idx) => {
    if (pt.terms.length === 0) return;
    const orTerms = pt.terms.join(' OR ');
    queryParts.push(`(#${step} ${orTerms})`);
    if (idx > 0) queryParts.push('AND');
    step++;
  });

  if (filterTerms.length > 0) {
    queryParts.push('AND');
    filterTerms.forEach(ft => {
      if (!ft) return;
      queryParts.push(`#${step} ${ft}`);
      step++;
    });
  }

  return queryParts.join(' ').replace(/AND AND/g, 'AND');
}

export default function SearchStrategy({ project }: { project: Project; onChange: (p: Project) => void }) {
  const pico = project.pico;
  const [selectedDb, setSelectedDb] = useState<string>('pubmed');
  const [strategies, setStrategies] = useState<SearchStrategy[]>([
    { id: '1', name: 'PubMed Strategy', database: 'pubmed', query: '', terms: [] }
  ]);
  const [copied, setCopied] = useState(false);
  const [customTerm, setCustomTerm] = useState('');
  const [customField, setCustomField] = useState<'title_abstract' | 'mesh' | 'all'>('title_abstract');

  const addStrategy = () => {
    const newStrat: SearchStrategy = {
      id: String(Date.now()),
      name: `${DATABASES.find(d => d.id === selectedDb)?.name || 'Database'} Strategy`,
      database: selectedDb,
      query: '',
      terms: [],
    };
    setStrategies([...strategies, newStrat]);
  };

  const updateStrategy = (id: string, patch: Partial<SearchStrategy>) => {
    setStrategies(strategies.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const currentStrategy = strategies.find(s => s.database === selectedDb) || strategies[0];

  const picoHasContent = pico.population || pico.intervention || pico.comparator || pico.outcomes;

  const addCustomTerm = (termText?: string) => {
    const text = termText || customTerm.trim();
    if (!text) return;
    const newTerm: SearchTerm = {
      id: String(Date.now()),
      term: text,
      field: customField,
      subTerms: [],
      operator: 'OR',
    };
    if (currentStrategy) {
      updateStrategy(currentStrategy.id, { terms: [...currentStrategy.terms, newTerm] });
    }
    setCustomTerm('');
  };

  const removeTerm = (strategyId: string, termId: string) => {
    const strat = strategies.find(s => s.id === strategyId);
    if (!strat) return;
    updateStrategy(strategyId, { terms: strat.terms.filter(t => t.id !== termId) });
  };

  const generatedQuery = useMemo(() => {
    if (!currentStrategy || !picoHasContent) return '';
    return buildBooleanQuery(currentStrategy.terms, currentStrategy.database, pico);
  }, [currentStrategy?.database, currentStrategy?.terms, pico]);

  const copyQuery = () => {
    navigator.clipboard.writeText(generatedQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportStrategy = () => {
    const dbName = DATABASES.find(d => d.id === selectedDb)?.name || selectedDb;
    const text = `# Search Strategy: ${dbName}\n# Generated: ${new Date().toISOString()}\n# Review: ${project.metadata.title || 'Untitled'}\n# PICO: ${pico.population} / ${pico.intervention} / ${pico.comparator} / ${pico.outcomes}\n\n${generatedQuery}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_strategy_${selectedDb}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  const exportAllStrategies = () => {
    const text = strategies.map(s => {
      const dbName = DATABASES.find(d => d.id === s.database)?.name || s.database;
      return `=== ${dbName} ===\n${buildBooleanQuery(s.terms, s.database, pico)}\n`;
    }).join('\n');
    const blob = new Blob([`# Search Strategies Export\n# Generated: ${new Date().toISOString()}\n\n${text}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all_search_strategies.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  return (
    <div className="space-y-4">
      {!picoHasContent ? (
        <EmptyState title="Complete PICO first">
          Define your Population, Intervention, Comparator, and Outcomes in the Protocol page to generate search strategies.
        </EmptyState>
      ) : (
        <>
          <Card title="PICO Summary">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2">
                <div className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Population</div>
                <div className="text-[12px] text-[var(--color-text)]">{pico.population || '—'}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2">
                <div className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Intervention</div>
                <div className="text-[12px] text-[var(--color-text)]">{pico.intervention || '—'}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2">
                <div className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Comparator</div>
                <div className="text-[12px] text-[var(--color-text)]">{pico.comparator || '—'}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-2">
                <div className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Outcomes</div>
                <div className="text-[12px] text-[var(--color-text)]">{pico.outcomes || '—'}</div>
              </div>
            </div>
          </Card>

          <Card title="Database & Filters" right={
            <button className="btn-ghost" onClick={addStrategy}>
              <Plus className="h-3.5 w-3.5" /> Add Strategy
            </button>
          }>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Database</div>
                <Select value={selectedDb} onChange={e => setSelectedDb(e.target.value)}>
                  {DATABASES.map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Filters</div>
                <div className="flex flex-wrap gap-1">
                  <button className="btn-ghost text-[11px]" onClick={() => {
                    if (currentStrategy && !currentStrategy.terms.find(t => t.id === 'filter_design')) {
                      updateStrategy(currentStrategy.id, { terms: [...currentStrategy.terms, { id: 'filter_design', term: 'RCT Design', field: 'all', subTerms: [], operator: 'AND' }] });
                    }
                  }}>RCT Filter</button>
                  <button className="btn-ghost text-[11px]" onClick={() => {
                    if (currentStrategy && !currentStrategy.terms.find(t => t.id === 'filter_date')) {
                      updateStrategy(currentStrategy.id, { terms: [...currentStrategy.terms, { id: 'filter_date', term: 'Date 2015-2024', field: 'all', subTerms: [], operator: 'AND' }] });
                    }
                  }}>Date Filter</button>
                  <button className="btn-ghost text-[11px]" onClick={() => {
                    if (currentStrategy && !currentStrategy.terms.find(t => t.id === 'filter_lang')) {
                      updateStrategy(currentStrategy.id, { terms: [...currentStrategy.terms, { id: 'filter_lang', term: 'English only', field: 'all', subTerms: [], operator: 'AND' }] });
                    }
                  }}>Language Filter</button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Custom Terms">
            <div className="mb-3 flex items-center gap-2">
              <Input
                value={customTerm}
                onChange={e => setCustomTerm(e.target.value)}
                placeholder="Enter term (e.g., 'meta-analysis', 'double-blind')"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && addCustomTerm()}
              />
              <Select value={customField} onChange={e => setCustomField(e.target.value as any)} className="w-32">
                <option value="title_abstract">Title/Abstract</option>
                <option value="mesh">MeSH Terms</option>
                <option value="all">All Fields</option>
              </Select>
              <button className="btn-primary" onClick={() => addCustomTerm()}>Add</button>
            </div>
            {currentStrategy && currentStrategy.terms.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentStrategy.terms.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px]">
                    {t.term}
                    <button onClick={() => removeTerm(currentStrategy.id, t.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-exclude)]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Generated Query: ${DATABASES.find(d => d.id === selectedDb)?.name || ''}`} right={
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={copyQuery}>
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </button>
              <button className="btn-ghost" onClick={exportStrategy}>
                <Download className="h-3.5 w-3.5" /> Export
              </button>
              {strategies.length > 1 && (
                <button className="btn-primary" onClick={exportAllStrategies}>
                  Export All
                </button>
              )}
            </div>
          }>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 font-mono text-[11px] text-[var(--color-text)] whitespace-pre-wrap min-h-[80px]">
              {generatedQuery || 'Add PICO elements or custom terms to generate a search query.'}
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Query uses database-specific syntax ({DATABASES.find(d => d.id === selectedDb)?.syntax || 'generic'}).
              Adapt field tags for your specific database version.
            </div>
          </Card>

          <Card title="MeSH Term Suggestions">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(MESH_EXAMPLES).map(([category, examples]) => (
                <div key={category}>
                  <div className="mb-1 text-[10.5px] font-semibold uppercase text-[var(--color-text-muted)]">{category}</div>
                  <div className="flex flex-wrap gap-1">
                    {examples.map(ex => (
                      <button
                        key={ex}
                        className="btn-ghost text-[10px]"
                        onClick={() => addCustomTerm(ex)}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
