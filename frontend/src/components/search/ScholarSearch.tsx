import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openExternalUrl } from '../../lib/api';

const fields = {
  as_q: 'All of these words',
  as_epq: 'Exact phrase',
  as_oq: 'At least one of these words',
  as_eq: 'Exclude these words',
  as_sauthors: 'Author',
  as_publication: 'Publication',
  as_ylo: 'From year',
  as_yhi: 'Through year',
};

export default function ScholarSearch({ initialQuery, rawInitially }: { initialQuery: string; rawInitially: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState(rawInitially);
  const [query, setQuery] = useState(initialQuery);
  const [titleOnly, setTitleOnly] = useState(false);
  const [error, setError] = useState('');

  return <section className="literature" aria-label="Google Scholar">
    <form className="lit-toolbar" onSubmit={event => {
      event.preventDefault();
      const params = new URLSearchParams();
      if (raw && query.trim()) params.set('q', query.trim());
      if (!raw) {
        if (values.as_ylo && values.as_yhi && Number(values.as_ylo) > Number(values.as_yhi)) {
          setError('The start year must come before the end year.');
          return;
        }
        for (const field of Object.keys(fields)) {
          const value = values[field]?.trim();
          if (value) params.set(field, value);
        }
        if (titleOnly) params.set('as_occt', 'title');
      }
      if (params.size) void openExternalUrl('https://scholar.google.com/scholar?' + params.toString());
    }}>
      <h2 className="text-lg font-semibold">Google Scholar</h2>
      <p>Set your search terms here. Results open on Google Scholar.</p>
      <label className="lit-choice"><input type="checkbox" checked={raw} onChange={event => { setRaw(event.target.checked); setError(''); }} />Use a pasted Scholar query</label>
      {raw ? <label>Scholar query<textarea rows={2} value={query} onChange={event => setQuery(event.target.value)} /></label> : <>
        <div className="lit-filter-grid">{Object.entries(fields).map(([field, label]) =>
          <label key={field}>{label}<input type={field === 'as_ylo' || field === 'as_yhi' ? 'number' : 'text'}
            min={1000} max={9999} value={values[field] ?? ''} onChange={event => {
              setValues(current => ({ ...current, [field]: event.target.value }));
              setError('');
            }} /></label>)}</div>
        <label className="lit-choice"><input type="checkbox" checked={titleOnly} onChange={event => setTitleOnly(event.target.checked)} />Search within titles</label>
      </>}
      <div><button className="lit-primary" disabled={raw ? !query.trim() : !Object.values(values).some(value => value.trim())}>Search Google Scholar <ExternalLink size={15} aria-hidden /></button></div>
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}
