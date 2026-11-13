import { useState } from 'react';
import { searchMesh } from '../../lib/api/literature';

export default function MeSHBrowser({ onSelect, apiKey }: {
  onSelect: (term: string, subheading?: string) => void;
  apiKey?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchMesh>>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function find() {
    setBusy(true);
    setMessage('');
    setResults([]);
    try {
      const records = await searchMesh(query.trim(), AbortSignal.timeout(55000), apiKey);
      setResults(records);
      if (!records.length) setMessage('No matching MeSH headings.');
    } catch {
      setMessage('MeSH lookup failed. Check the engine and network, then retry.');
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <div className="lit-row">
      <label>Heading or synonym<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button disabled={!query.trim() || busy} onClick={() => void find()}>{busy ? 'Searching…' : 'Find headings'}</button>
    </div>
    <p role="status">{message}</p>
    {results.map(record => <details key={record.ui}><summary>{record.heading}</summary>
      <p>{record.description}</p><p>{record.trees.join(' · ')}</p>
      <div className="lit-row">
        <button onClick={() => onSelect(record.heading)}>Add heading</button>
        {record.subheadings.length > 0 && <label>Add heading with subheading<select value="" onChange={event => onSelect(record.heading, event.target.value)}>
          <option value="" disabled>Choose subheading</option>
          {record.subheadings.map(subheading => <option key={subheading}>{subheading}</option>)}
        </select></label>}
        {/^[DC]\d+$/.test(record.ui) && <a href={`https://meshb.nlm.nih.gov/record/ui?ui=${record.ui}`} target="_blank" rel="noreferrer">NLM hierarchy</a>}
      </div>
    </details>)}
  </div>;
}
