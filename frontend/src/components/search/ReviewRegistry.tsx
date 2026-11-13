import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openExternalUrl } from '../../lib/api';
import BooleanQueryBuilder from './BooleanQueryBuilder';

const registry = 'https://www.crd.york.ac.uk/PROSPERO/';
const pageSize = 20;
const registryFields = {
  TI: 'Title', CS: 'Condition studied', IV: 'Intervention', CM: 'Comparator', PA: 'Population',
  OP: 'Main outcomes', OS: 'Additional outcomes', RQ: 'Review question', KW: 'Keywords',
  CO: 'Country', FU: 'Funding sources', NC: 'Named contact', OA: 'Organisational affiliation', AN: 'Registration number',
};
const sortOptions = { 'TI:ASC': 'Title A–Z', 'TI:DESC': 'Title Z–A', 'YR:DESC': 'Newest first', 'YR:ASC': 'Oldest first', 'AN:ASC': 'Registration number' };
type Registration = { id: string; title: string; description: string };
type Results = { query: string; page: number; order: string; total: number; lowerBound: boolean; records: Registration[] };

function plainText(value: unknown) {
  if (typeof value !== 'string') return '';
  const encoded = value.replace(/<[^>]*>/g, '');
  return new DOMParser().parseFromString(encoded, 'text/html').body.textContent?.trim() ?? '';
}

export default function ReviewRegistry({ initialQuery, onSaveStrategy }: { initialQuery: string; onSaveStrategy: (query: string) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState('TI:ASC');
  const [living, setLiving] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const effectiveQuery = [query.trim(), living ? 'living:il' : '', withdrawn ? 'withdrawn:es' : ''].filter(Boolean);
  const strategy = effectiveQuery.length > 1 && query.trim()
    ? [`(${query.trim()})`, ...effectiveQuery.slice(1)].join(' AND ') : effectiveQuery.join(' AND ');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const id = query.trim().match(/^CRD\d+$/i)?.[0].toUpperCase()
    ?? query.trim().match(/^https:\/\/www\.crd\.york\.ac\.uk\/prospero\/view\/(CRD\d+)\/?(?:\?[^#]*)?$/i)?.[1].toUpperCase();

  async function search(term: string, page = 1, requestOrder = order) {
    if (!term || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const [sort, sortorder] = requestOrder.split(':');
      // shortcut: uses York's public website contract, replace with the documented API when York provides one.
      const response = await fetch(registry + 'api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // York's anonymous search requests include a timestamp; no account token is sent.
          'prospero-auth-token': btoa(String(Date.now())),
        },
        credentials: 'omit',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        body: JSON.stringify({ term, actual: term, page, nperpage: pageSize, sort, sortorder, filters: [], download: false }),
      });
      if (!response.ok) throw new Error(`PROSPERO returned HTTP ${response.status}.`);
      const data = await response.json();
      const line = Array.isArray(data) ? data.at(-1) : undefined;
      const hits = line?.retvals?.hits;
      if (line?.hits === 0) {
        setResults({ query: term, page, order: requestOrder, total: 0, lowerBound: false, records: [] });
        return;
      }
      if (!Number.isSafeInteger(line?.hits) || line.hits < 0 || !Array.isArray(hits?.hits)) {
        throw new Error('PROSPERO could not interpret the query or returned an unexpected response.');
      }
      const records = hits.hits.flatMap((hit: { _source?: Record<string, unknown> } | null) => {
        const record = hit?._source;
        if (typeof record?.accessionnumber !== 'string' || !/^CRD\d+$/.test(record.accessionnumber)) return [];
        return [{ id: record.accessionnumber, title: plainText(record.title) || record.accessionnumber,
          description: [record.reviewstatus, record.recordtype, record.yearfirstpublished].map(plainText).filter(Boolean).join(' · ') }];
      });
      if (!records.length && hits.hits.length) throw new Error('PROSPERO returned registrations without valid public IDs.');
      setResults({ query: term, page, order: requestOrder, total: line.hits, lowerBound: hits.total?.relation === 'gte', records });
    } catch (err) {
      if (!controller.signal.aborted) setError(`${err instanceof Error ? err.message : 'PROSPERO search failed.'} You can copy your query and retry on the registry website.`);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="literature" aria-label="PROSPERO">
    <form className="lit-toolbar" onSubmit={event => {
      event.preventDefault();
      if (id) void openExternalUrl(registry + 'view/' + id);
      else { if (!request.current) { setResults(null); void search(strategy); } }
    }}>
      <h2 className="text-lg font-semibold">PROSPERO</h2>
      <p>Find registered systematic reviews. Registration records stay separate from screening.</p>
      <label>Keywords, search query, CRD ID, or record link
        <textarea rows={2} value={query} onChange={event => { setQuery(event.target.value); setNotice(''); }} />
      </label>
      <div className="lit-row">
        <label>Sort registrations<select value={order} onChange={event => setOrder(event.target.value)}>
          {Object.entries(sortOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="lit-choice"><input type="checkbox" checked={living} onChange={event => setLiving(event.target.checked)} />Living reviews only</label>
        <label className="lit-choice"><input type="checkbox" checked={withdrawn} onChange={event => setWithdrawn(event.target.checked)} />Withdrawn registrations only</label>
      </div>
      <div className="lit-row">
        <button className="lit-primary" disabled={busy || !strategy}>{busy ? 'Searching…' : id ? `Open ${id}` : 'Search PROSPERO'}</button>
        <button type="button" onClick={() => void openExternalUrl(registry + 'search')}>Open registry website <ExternalLink size={15} aria-hidden /></button>
        <button disabled={!strategy} type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(strategy); setNotice('Query copied.'); }
          catch { setNotice('Select and copy the query from the search field.'); }
        }}>Copy query</button>
        <button disabled={!strategy || !!id} type="button" onClick={() => { onSaveStrategy(strategy); setNotice('Saved in Search Strategy.'); }}>Save strategy</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
    <BooleanQueryBuilder source="prospero" fields={Object.keys(registryFields)} fieldLabels={registryFields} onApply={setQuery} />
    {results && <section aria-label="Registration results">
      <div className="lit-results-header" role="status">
        <h3>{results.lowerBound && 'At least '}{results.total.toLocaleString()} registrations</h3>
        {results.records.length > 0 && <p>Page {results.page}</p>}
      </div>
      <code>{results.query}</code>
      <div className="lit-records">
        {results.records.map(record => <article className="lit-record" key={record.id}>
          <h4><a href={registry + 'view/' + record.id} onClick={event => { event.preventDefault(); void openExternalUrl(event.currentTarget.href); }}>{record.title}</a></h4>
          <p>{[record.id, record.description].filter(Boolean).join(' · ')}</p>
        </article>)}
      </div>
      {results.total > 0 && <div className="lit-row lit-pagination">
        <button type="button" disabled={busy || results.page <= 1} onClick={() => void search(results.query, results.page - 1, results.order)}>Previous page</button>
        <button type="button" disabled={busy || results.page * pageSize >= results.total || !results.records.length}
          onClick={() => void search(results.query, results.page + 1, results.order)}>Next page</button>
      </div>}
    </section>}
  </section>;
}
