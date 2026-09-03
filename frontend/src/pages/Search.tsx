import { useState } from 'react';
import { Search as SearchIcon, Database, FileText, Download, ChevronRight, Info } from 'lucide-react';
import type { Project, ScreeningItem } from '../lib/project';
import { mergeScreeningItems, downloadText } from '../lib/project';
import { Card, Pill, EmptyState } from '../components/ui';
import UnifiedSearch from '../components/UnifiedSearch';
import DatabaseSelector, { DATABASES } from '../components/DatabaseSelector';

type Tab = 'unified' | 'strategy' | 'databases';

export default function Search({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const [tab, setTab] = useState<Tab>('unified');
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>(
    project.metadata.config?.databases ?? ['pubmed', 'cochrane']
  );

  const handleImport = (items: ScreeningItem[]) => {
    const updated = mergeScreeningItems(project, 'title_abstract', items);
    onChange(updated);
  };

  const toggleDatabase = (id: string) => {
    const updated = selectedDatabases.includes(id)
      ? selectedDatabases.filter(d => d !== id)
      : [...selectedDatabases, id];
    setSelectedDatabases(updated);
    if (project.metadata.config) {
      onChange({
        ...project,
        metadata: {
          ...project.metadata,
          config: { ...project.metadata.config, databases: updated }
        }
      });
    }
  };

  const handleSelectAll = () => {
    setSelectedDatabases(DATABASES.map(d => d.id));
  };

  const handleClearAll = () => {
    setSelectedDatabases([]);
  };

  const [strategies, setStrategies] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const { population, intervention, comparator, outcomes } = project.pico || {};
    const parts = [population, intervention, comparator].filter(Boolean).map(s => `("${s?.trim()}")`);
    const base = parts.join(' AND ');
    const query = outcomes ? `${base} AND (${outcomes.trim()})` : base;
    DATABASES.forEach(db => {
      initial[db.id] = query;
    });
    return initial;
  });

  const exportStrategy = () => {
    const lines = DATABASES
      .filter(db => selectedDatabases.includes(db.id))
      .map(db => `=== ${db.name} ===\n${strategies[db.id] || "No query defined"}\n`);
    downloadText("poolr_search_strategy.txt", `Poolr Systematic Review Search Strategies\nGenerated: ${new Date().toISOString()}\n\n${lines.join('\n')}`);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        {[
          { id: 'unified', label: 'Unified Search', icon: SearchIcon },
          { id: 'databases', label: 'Database Selector', icon: Database },
          { id: 'strategy', label: 'Search Strategy', icon: FileText },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'unified' && (
        <UnifiedSearch onImport={handleImport} />
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
                The search strategy builder generates database-specific queries from your PICO definition.
                Use the Unified Search tab to search databases directly and import results to your screening queue.
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
                      placeholder={`Enter ${db.name} search query...`}
                      value={strategies[db.id] ?? ""}
                      onChange={(e) => setStrategies({ ...strategies, [db.id]: e.target.value })}
                    />
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