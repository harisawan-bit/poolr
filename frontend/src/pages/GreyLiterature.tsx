import { useState, useEffect } from 'react';
import { Card, Button, Input } from '../components/ui';
import { Search, Loader2, Clock, Trash2 } from 'lucide-react';

interface SearchHistoryItem {
  query: string;
  source: string;
  timestamp: string;
}

export default function GreyLiterature() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'google_scholar' | 'clinicaltrials' | 'proquest' | 'opengrey'>('google_scholar');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('poolr.greyHistory') || '[]');
    } catch {
      return [];
    }
  });

  const sources = [
    { id: 'google_scholar', name: 'Google Scholar', desc: 'Broad academic search' },
    { id: 'clinicaltrials', name: 'ClinicalTrials.gov', desc: 'Registered clinical trials' },
    { id: 'proquest', name: 'ProQuest', desc: 'Dissertations & theses' },
    { id: 'opengrey', name: 'OpenGrey', desc: 'Grey literature repository' },
  ];

  useEffect(() => {
    try {
      localStorage.setItem('poolr.greyHistory', JSON.stringify(searchHistory));
    } catch { /* ignore */ }
  }, [searchHistory]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // Save to search history
      const historyItem: SearchHistoryItem = {
        query,
        source,
        timestamp: new Date().toISOString(),
      };
      setSearchHistory(prev => [historyItem, ...prev.slice(0, 19)]);

      let newResults: any[] = [];
      
      if (source === 'google_scholar') {
        // Use Google Scholar search via engine
        try {
          const { googleScholarSearch } = await import('../lib/api');
          const response = await googleScholarSearch(query);
          newResults = response.results.map(r => ({
            title: r.title,
            authors: r.authors,
            year: r.year,
            source: r.source,
            abstract: r.abstract,
            url: r.url,
          }));
        } catch {
          // Fallback: show a message that Scholar requires engine
          newResults = [];
        }
      } else if (source === 'clinicaltrials') {
        try {
          const { clinicaltrialsSearch } = await import('../lib/api');
          const response = await clinicaltrialsSearch(query);
          newResults = response.results.map(r => ({
            title: r.title,
            authors: r.authors || 'ClinicalTrials.gov',
            year: r.year,
            source: 'ClinicalTrials.gov',
            abstract: r.abstract,
            url: r.url,
          }));
        } catch {
          newResults = [];
        }
      } else if (source === 'opengrey') {
        try {
          const { openalexSearch } = await import('../lib/api');
          const response = await openalexSearch(`grey literature ${query}`);
          newResults = response.results.map(r => ({
            title: r.title,
            authors: r.authors,
            year: r.year,
            source: 'OpenAlex (Grey)',
            abstract: r.abstract,
            url: r.url,
          }));
        } catch {
          newResults = [];
        }
      } else {
        // ProQuest - no free API available
        newResults = [];
      }
      
      setResults(newResults);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => setSearchHistory([]);

  const runHistorySearch = (item: SearchHistoryItem) => {
    setQuery(item.query);
    setSource(item.source as any);
  };

  return (
    <div className="space-y-3">
      <Card title="Grey Literature Search">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {sources.map(s => (
              <button
                key={s.id}
                className={`btn-ghost text-[11px] ${source === s.id ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
                onClick={() => setSource(s.id as any)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${sources.find(s => s.id === source)?.name}...`}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <Button variant="outline" onClick={search} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="rounded border border-[var(--color-border)] px-2 py-1.5">
                  <div className="text-[12px] font-medium">{r.title}</div>
                  <div className="text-[10.5px] text-[var(--color-text-muted)]">
                    {r.authors} · {r.year} · {r.source}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-[var(--color-text-muted)]">
            Grey literature helps reduce publication bias by including unpublished studies, dissertations, and trial registrations.
          </div>
        </div>
      </Card>

      {/* Search History */}
      {searchHistory.length > 0 && (
        <Card
          title="Search History"
          right={
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          }
        >
          <div className="space-y-1">
            {searchHistory.map((item, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-2 rounded border border-[var(--color-border)] px-2 py-1.5 text-left hover:bg-[var(--hover-surface)]"
                onClick={() => runHistorySearch(item)}
              >
                <Clock className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
                <span className="flex-1 truncate text-[12px]">{item.query}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{item.source}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
