import { openExternalUrl } from "../lib/api";
import ScholarSearch from "../components/search/ScholarSearch";
import ReviewRegistry from "../components/search/ReviewRegistry";
import { useEffect, useState } from 'react';
import { Search as SearchIcon, Database, FileText, Download, ChevronRight, Info, BookOpen } from 'lucide-react';
import type { Project, ScreeningItem } from '../lib/project';
import { dedupeRecords, mergeScreeningItems, downloadText } from '../lib/project';
import { Card, Pill, EmptyState } from '../components/ui';
import LiteratureSearch from '../components/search/LiteratureSearch';
import UnifiedSearch from '../components/UnifiedSearch';
import DatabaseSelector, { DATABASES } from '../components/DatabaseSelector';

import CitationManager from '../components/CitationManager';

type Tab = 'literature' | 'library' | 'prospero' | 'scholar' | 'unified' | 'strategy' | 'databases';

export default function Search({ project, onChange, initialTab = "literature" }: { project: Project; onChange: (p: Project) => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [draft, setDraft] = useState<{ query: string; source: 'pubmed' | 'clinicaltrials' }>({ query: '', source: 'pubmed' });
  const [registryDraft, setRegistryDraft] = useState<string>();
  const [scholarDraft, setScholarDraft] = useState<string>();
  const [literatureKey, setLiteratureKey] = useState(0);
  const [otherSource, setOtherSource] = useState<'openalex' | 'crossref'>('openalex');
  const selectedDatabases = project.metadata.config?.databases ?? project.metadata.searchDatabases ?? ['pubmed', 'clinicaltrials'];

  const handleImport = (items: ScreeningItem[]) => {
    const existing = [...project.screening.title_abstract, ...project.screening.full_text];
    const kept = dedupeRecords(items, existing).kept;
    const updated = mergeScreeningItems(project, 'title_abstract', kept);
    onChange(updated);
  };

  const selectDatabases = (databases: string[]) => onChange({
    ...project,
    metadata: {
      ...project.metadata,
      searchDatabases: databases,
      ...(project.metadata.config ? { config: { ...project.metadata.config, databases } } : {}),
    },
  });
  const toggleDatabase = (id: string) => selectDatabases(selectedDatabases.includes(id)
    ? selectedDatabases.filter(database => database !== id) : [...selectedDatabases, id]);
  const handleSelectAll = () => selectDatabases(DATABASES.map(database => database.id));
  const handleClearAll = () => selectDatabases([]);

  const [strategies, setStrategies] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { ...project.metadata.config?.searchStrategy, ...project.metadata.savedSearchStrategies };
    const { population, intervention, comparator, outcomes } = project.pico || {};
    const parts = [population, intervention, comparator].filter(Boolean).map(s => `("${s?.trim()}")`);
    const base = parts.join(' AND ');
    const query = [base, outcomes?.trim() && `(${outcomes.trim()})`].filter(Boolean).join(' AND ');
    DATABASES.forEach(db => {
      initial[db.id] ??= query;
    });
    return initial;
  });

  const saveStrategy = (id: string, query: string) => {
    const updated = { ...strategies, [id]: query };
    setStrategies(updated);
    onChange({ ...project, metadata: { ...project.metadata, savedSearchStrategies: updated } });
  };

  const exportStrategy = () => {
    const lines = DATABASES
      .filter(db => selectedDatabases.includes(db.id))
      .map(db => `=== ${db.name} ===\n${strategies[db.id] || "No query defined"}\n`);
    downloadText("poolr_search_strategy.txt", `Poolr Systematic Review Search Strategies\nGenerated: ${new Date().toISOString()}\n\n${lines.join('\n')}`);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="workspace-segments glass" role="group" aria-label="Search tools">
        {[
          { id: 'literature', label: 'Literature search', icon: SearchIcon },
          { id: 'unified', label: 'OpenAlex & Crossref', icon: Database },
          { id: 'library', label: 'Citation Library', icon: BookOpen },
          { id: 'prospero', label: 'PROSPERO', icon: FileText },
          { id: 'scholar', label: 'Google Scholar', icon: SearchIcon },
          { id: 'databases', label: 'Database Selector', icon: Database },
          { id: 'strategy', label: 'Search Strategy', icon: FileText },
        ].map(t => (
          <button
            key={t.id}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id as Tab)}

          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <button type="button" className="btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "search-dedup" }))}>Open deduplication tools</button>
      {/* Tab Content */}
      <div hidden={tab !== "literature"}><LiteratureSearch key={literatureKey} project={project} onChange={onChange} initialQuery={draft.query} initialSource={draft.source} /></div>
      {tab === 'library' && <CitationManager project={project} onChange={onChange} />}
      {tab === 'prospero' && <ReviewRegistry initialQuery={registryDraft ?? project.metadata.savedSearchStrategies?.prospero ?? ''} onSaveStrategy={query => saveStrategy('prospero', query)} />}
      {tab === 'scholar' && <ScholarSearch initialQuery={scholarDraft ?? ''} rawInitially={scholarDraft !== undefined} />}
      {tab === 'unified' && (
        <UnifiedSearch onImport={handleImport} initialQuery={draft.query} initialDatabase={otherSource} />
      )}

      {tab === 'databases' && (
        <Card title="Select Databases" right={
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{selectedDatabases.length} selected</Pill>
            <button onClick={exportStrategy} className="btn-ghost flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        }>
          <DatabaseSelector
            selected={selectedDatabases}
            onToggle={toggleDatabase}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
        </Card>
      )}

      {tab === 'strategy' && (
        <Card title="Search Strategy Builder" right={
          <div className="flex items-center gap-2">
            <button onClick={exportStrategy} className="btn-primary flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export .txt
            </button>
          </div>
        }>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <Info className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Edit and save a strategy for each database. Check its syntax before running it.
              </p>
            </div>

            {selectedDatabases.length === 0 ? (
              <EmptyState>
                Select databases from the Database Selector tab to build your search strategy.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {DATABASES.filter(db => selectedDatabases.includes(db.id)).map(db => (
                  <div
                    key={db.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{db.logo}</span>
                      <span className="text-[12.5px] font-semibold text-[var(--color-text)]">
                        {db.name}
                      </span>
                      {db.free ? (
                        <span className="rounded-full bg-[var(--color-include)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-include)]">
                          FREE
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--color-unsure)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-unsure)]">
                          KEY REQUIRED
                        </span>
                      )}
                      <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-text-muted)]" />
                    </div>
                    <textarea
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 font-mono text-[11.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-border-strong)] focus-visible:outline-none"
                      rows={3}
                      aria-label={`${db.name} strategy`}
                      placeholder={`Enter ${db.name} search query...`}
                      value={strategies[db.id] ?? ""}
                      onChange={event => saveStrategy(db.id, event.target.value)}
                    />
                    {(db.id === 'pubmed' || db.id === 'clinicaltrials' || db.id === 'prospero') && (
                      <button className="btn-primary mt-2" onClick={() => {
                        const query = strategies[db.id] ?? '';
                        if (db.id === 'prospero') {
                          setRegistryDraft(query);
                          setTab('prospero');
                        } else {
                          setDraft({ source: db.id === 'clinicaltrials' ? 'clinicaltrials' : 'pubmed', query });
                          setLiteratureKey(value => value + 1);
                          setTab('literature');
                        }
                      }}>{db.id === "prospero" ? "Open registry lookup" : "Open in literature search"}</button>
                    )}
                    {(db.id === 'openalex' || db.id === 'crossref') &&
                      <button className="btn-primary mt-2" onClick={() => {
                        setOtherSource(db.id === 'crossref' ? 'crossref' : 'openalex');
                        setDraft({ source: 'pubmed', query: strategies[db.id] ?? '' });
                        setTab('unified');
                      }}>Open in database search</button>}
                    {db.id === 'google_scholar' &&
                      <button className="btn-primary mt-2" onClick={() => { setScholarDraft(strategies.google_scholar ?? ''); setTab('scholar'); }}>Open Scholar search</button>}
                    {!['google_scholar', 'pubmed', 'clinicaltrials', 'prospero', 'openalex', 'crossref'].includes(db.id) &&
                      <button className="btn-ghost mt-2" onClick={() => void openExternalUrl(db.url)}>Open {db.name} website</button>}

                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}