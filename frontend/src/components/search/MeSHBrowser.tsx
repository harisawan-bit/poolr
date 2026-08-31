import { useState } from 'react';
import { Card, Input, Button } from '../components/ui';
import { Search } from 'lucide-react';

interface MeSHResult {
  term: string;
  tree: string;
  description: string;
}

export default function MeSHBrowser({ onSelect }: { onSelect: (term: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MeSHResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // In production, this would call the engine's MeSH endpoint
      // For now, show mock results
      setResults([
        { term: query, tree: 'C23.888.852', description: `Diseases related to ${query}` },
        { term: `${query} therapy`, tree: 'E02.319', description: `Therapeutic approaches for ${query}` },
        { term: `${query} diagnosis`, tree: 'E01.371', description: `Diagnostic methods for ${query}` },
        { term: `${query} epidemiology`, tree: 'N06.850', description: `Epidemiological data on ${query}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="MeSH Term Browser">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search MeSH terms..."
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <Button variant="outline" onClick={search} disabled={loading}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-1">
            {results.map(r => (
              <div
                key={r.term}
                className="flex items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1.5 hover:bg-[var(--hover-surface)] cursor-pointer"
                onClick={() => onSelect(r.term)}
              >
                <div className="flex-1">
                  <div className="text-[12px] font-medium">{r.term}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">{r.description}</div>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">{r.tree}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-[var(--color-text-muted)]">
          MeSH (Medical Subject Headings) is the NLM controlled vocabulary thesaurus used for indexing PubMed articles.
        </div>
      </div>
    </Card>
  );
}
