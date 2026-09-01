import { useState } from 'react';
import { Card, Input, Button } from '../components/ui';
import { Search } from 'lucide-react';

const DATABASES = [
  { id: 'pubmed', name: 'PubMed', key: false },
  { id: 'clinicaltrials', name: 'ClinicalTrials.gov', key: false },
  { id: 'prospero', name: 'PROSPERO', key: false },
  { id: 'scopus', name: 'Scopus', key: true },
  { id: 'wos', name: 'Web of Science', key: true },
  { id: 'embase', name: 'Embase', key: true },
  { id: 'cochrane', name: 'Cochrane', key: false },
  { id: 'openalex', name: 'OpenAlex', key: false },
  { id: 'crossref', name: 'Crossref', key: false },
  { id: 'google_scholar', name: 'Google Scholar', key: false },
];

export default function APISearch({ onImport }: { onImport: (items: any[]) => void }) {
  const [query, setQuery] = useState('');
  const [db, setDb] = useState('pubmed');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    // Mock results - in production would call engine
    setResults([
      { title: `${query} — A systematic review`, authors: 'Smith J, Doe A', year: 2024, source: db, abstract: 'Background: This study examines...' },
      { title: `The effect of ${query} on patient outcomes`, authors: 'Johnson B, Williams C', year: 2023, source: db, abstract: 'Objective: To investigate...' },
      { title: `${query} in clinical practice`, authors: 'Brown D, Davis E', year: 2024, source: db, abstract: 'Methods: A comprehensive...' },
    ]);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <Card title="External Database Search">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {DATABASES.map(d => (
              <button
                key={d.id}
                className={`btn-ghost text-[11px] ${db === d.id ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
                onClick={() => setDb(d.id)}
              >
                {d.name}
                {d.key && <span className="ml-1 text-[var(--color-unsure)]">🔑</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${DATABASES.find(d => d.id === db)?.name}...`}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <Button variant="default" onClick={search} disabled={loading}>
              <Search className="h-3.5 w-3.5" />
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]">{results.length} results</span>
                <Button variant="outline" size="sm" onClick={() => onImport(results)}>
                  Import All
                </Button>
              </div>
              {results.map((r, i) => (
                <div key={i} className="rounded border border-[var(--color-border)] p-2">
                  <div className="text-[12px] font-medium">{r.title}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">
                    {r.authors} · {r.year} · {r.source}
                  </div>
                  <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)] line-clamp-2">{r.abstract}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
