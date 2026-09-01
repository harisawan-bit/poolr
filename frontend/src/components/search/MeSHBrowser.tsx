import { useState, useEffect } from 'react';
import { Card, Button, Input } from '../ui';
import { Search, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface MeSHResult {
  term: string;
  tree: string;
  description: string;
}

export default function MeSHBrowser({ onSelect }: { onSelect: (term: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MeSHResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  // Test NCBI connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const res = await fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?retmode.json', {
        signal: AbortSignal.timeout(5000),
      });
      setConnectionStatus(res.ok ? 'connected' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const searchRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=mesh&term=${encodeURIComponent(query)}&retmode=json&retmax=10`
      );
      const searchData = await searchRes.json();
      const ids = searchData.esearchresult?.idlist || [];

      if (ids.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const detailsRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=mesh&id=${ids.join(',')}&retmode=json`
      );
      const detailsData = await detailsRes.json();

      const meshResults: MeSHResult[] = ids.map((id: string) => {
        const summary = detailsData.result?.[id];
        return {
          term: summary?.name || summary?.term || query,
          tree: summary?.treeNumber?.[0] || summary?.tree?.[0] || 'N/A',
          description: summary?.summary || summary?.ds_meshterms?.[0] || '',
        };
      });

      setResults(meshResults);
      setConnectionStatus('connected');
    } catch (err) {
      setError('Failed to search MeSH. Check your internet connection.');
      setConnectionStatus('error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="MeSH Term Browser"
      right={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="h-3 w-3 text-[var(--color-include)]" />
            ) : connectionStatus === 'error' ? (
              <XCircle className="h-3 w-3 text-[var(--color-exclude)]" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Offline' : 'Checking...'}
          </span>
          <Button variant="ghost" size="sm" onClick={testConnection}>
            <Loader2 className="h-3 w-3" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search MeSH terms..."
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <Button variant="outline" onClick={search} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {error && (
          <div className="rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
            {error}
          </div>
        )}

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
