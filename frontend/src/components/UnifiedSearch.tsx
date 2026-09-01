import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Download, Check, AlertCircle, ExternalLink, ChevronDown, Users, Calendar, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ScreeningItem } from '../lib/project';
import type { SearchResult, SearchResponse } from '../lib/api';
import {
  clinicaltrialsSearch,
  prosperoSearch,
  scopusSearch,
  wosSearch,
  googleScholarSearch,
  embaseSearch,
  cochraneSearch,
  openalexSearch,
  crossrefSearch,
} from '../lib/api';
import { DATABASES } from './DatabaseSelector';

interface UnifiedSearchProps {
  onImport: (items: ScreeningItem[]) => void;
  className?: string;
}

type SearchStatus = 'idle' | 'searching' | 'complete' | 'error';

interface SearchState {
  status: SearchStatus;
  response: SearchResponse | null;
  error: string | null;
}

const SEARCH_FUNCTIONS: Record<string, (query: string, apiKey?: string) => Promise<SearchResponse>> = {
  clinicaltrials: clinicaltrialsSearch,
  prospero: prosperoSearch,
  scopus: scopusSearch,
  wos: wosSearch,
  google_scholar: googleScholarSearch,
  embase: embaseSearch,
  cochrane: cochraneSearch,
  openalex: openalexSearch,
  crossref: crossrefSearch,
};

export default function UnifiedSearch({ onImport, className }: UnifiedSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedDb, setSelectedDb] = useState<string>('pubmed');
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
    response: null,
    error: null,
  });
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [showDbDropdown, setShowDbDropdown] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const currentDb = DATABASES.find((d) => d.id === selectedDb);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setSearchState({ status: 'searching', response: null, error: null });

    // Add to search history
    if (!searchHistory.includes(query)) {
      setSearchHistory((prev) => [query, ...prev].slice(0, 10));
    }

    try {
      const searchFn = SEARCH_FUNCTIONS[selectedDb];
      if (!searchFn) {
        throw new Error(`No search function for database: ${selectedDb}`);
      }
      const response = await searchFn(query);
      setSearchState({ status: 'complete', response, error: null });
    } catch (err) {
      setSearchState({
        status: 'error',
        response: null,
        error: err instanceof Error ? err.message : 'Search failed',
      });
    }
  }, [query, selectedDb, searchHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const convertToScreeningItem = (result: SearchResult): ScreeningItem => ({
    id: result.id,
    title: result.title,
    abstract: result.abstract,
    decision: 'unset',
    stage: 'title_abstract',
    doi: result.doi,
    pmid: result.pmid,
  });

  const handleImportSingle = (result: SearchResult) => {
    const item = convertToScreeningItem(result);
    onImport([item]);
    setImportedIds((prev) => new Set<string>([...prev, result.id]));
  };

  const handleImportAll = () => {
    if (!searchState.response) return;
    const items = searchState.response.results.map(convertToScreeningItem);
    onImport(items);
    const newIds = new Set<string>(searchState.response.results.map((r: SearchResult) => r.id));
    setImportedIds((prev) => new Set<string>([...prev, ...newIds]));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Database Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDbDropdown(!showDbDropdown)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            >
              <span className="text-lg">{currentDb?.logo}</span>
              <span>{currentDb?.name}</span>
              <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
            </button>

            <AnimatePresence>
              {showDbDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDbDropdown(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl"
                  >
                    {DATABASES.map((db) => (
                      <button
                        key={db.id}
                        onClick={() => {
                          setSelectedDb(db.id);
                          setShowDbDropdown(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                          selectedDb === db.id
                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                            : 'hover:bg-[var(--hover-surface)]'
                        )}
                      >
                        <span className="text-lg">{db.logo}</span>
                        <div className="flex-1">
                          <div className="text-[12.5px] font-medium">{db.name}</div>
                          <div className="text-[10.5px] text-[var(--color-text-muted)]">
                            {db.free ? 'Free' : 'API key required'}
                          </div>
                        </div>
                        {selectedDb === db.id && (
                          <Check className="h-4 w-4 text-[var(--color-accent)]" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Query Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${currentDb?.name || 'database'}...`}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] py-2 pl-10 pr-24 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--placeholder-fg)] focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || searchState.status === 'searching'}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
            >
              {searchState.status === 'searching' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-[10.5px] text-[var(--color-text-muted)]">Recent:</span>
            {searchHistory.slice(0, 5).map((term, i) => (
              <button
                key={i}
                onClick={() => setQuery(term)}
                className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {searchState.status === 'searching' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] py-16"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
            <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
              Searching {currentDb?.name}...
            </p>
          </motion.div>
        )}

        {searchState.status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/5 p-4"
          >
            <AlertCircle className="h-5 w-5 text-[var(--color-exclude)]" />
            <div>
              <p className="text-[12.5px] font-medium text-[var(--color-text)]">Search failed</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{searchState.error}</p>
            </div>
          </motion.div>
        )}

        {searchState.status === 'complete' && searchState.response && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                  Search Results
                </h3>
                <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-accent)]">
                  {searchState.response.totalResults.toLocaleString()} found
                </span>
              </div>
              <button
                onClick={handleImportAll}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--color-accent)]/90"
              >
                <Download className="h-3.5 w-3.5" />
                Import All ({searchState.response.results.length})
              </button>
            </div>

            {/* Results List */}
            <div className="space-y-2">
              {searchState.response.results.map((result: SearchResult, index: number) => {
                const isImported = importedIds.has(result.id);
                return (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Title */}
                        <h4 className="text-[13px] font-medium text-[var(--color-text)]">
                          {result.title}
                        </h4>

                        {/* Meta */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {result.authors}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {result.year}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {result.source}
                          </span>
                          {result.doi && (
                            <span className="font-mono text-[10px]">DOI: {result.doi}</span>
                          )}
                          {result.pmid && (
                            <span className="font-mono text-[10px]">PMID: {result.pmid}</span>
                          )}
                        </div>

                        {/* Abstract */}
                        <p className="mt-2 line-clamp-2 text-[11.5px] text-[var(--color-text-muted)]">
                          {result.abstract}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => handleImportSingle(result)}
                          disabled={isImported}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
                            isImported
                              ? 'bg-[var(--color-include)]/10 text-[var(--color-include)]'
                              : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                          )}
                        >
                          {isImported ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Imported
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Import
                            </>
                          )}
                        </button>
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {searchState.status === 'idle' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16"
          >
            <Search className="h-10 w-10 text-[var(--color-text-muted)]" />
            <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
              Enter a search query to find studies
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Results will be imported to your screening queue
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}