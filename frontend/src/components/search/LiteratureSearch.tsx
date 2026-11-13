import { useEffect, useRef, useState } from 'react';
import { BookOpen, Database, Download, ExternalLink, Search } from 'lucide-react';
import { resolveSearchLines, searchLiterature } from '../../lib/api/literature';
import type { LiteraturePage, LiteratureRecord, LiteratureSource } from '../../lib/api/literature';
import { dedupeRecords, downloadText, mergeScreeningItems, toCsv } from '../../lib/project';
import type { LiteratureRun, Project, ScreeningItem } from '../../lib/project';
import BooleanQueryBuilder from './BooleanQueryBuilder';
import MeSHBrowser from './MeSHBrowser';
import './literature.css';


const labels = { pubmed: 'PubMed', clinicaltrials: 'ClinicalTrials.gov' };
const fields = [
  ['Condition', 'query.cond'], ['Intervention', 'query.intr'], ['Location', 'query.locn'],
  ['Sponsor', 'query.spons'], ['NCT or other study ID', 'query.id'],
  ['Advanced eligibility, phase, age or design expression', 'filter.advanced'],
];
const statuses = ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'ENROLLING_BY_INVITATION',
  'SUSPENDED', 'TERMINATED', 'WITHDRAWN', 'AVAILABLE', 'NO_LONGER_AVAILABLE', 'TEMPORARILY_NOT_AVAILABLE',
  'APPROVED_FOR_MARKETING', 'WITHHELD', 'UNKNOWN'];
const pubmedFilters: Record<string, [string, string][]> = {
  'Publication date': [['Past year', '"last year"[dp]'], ['Past five years', '"last 5 years"[dp]'], ['Past ten years', '"last 10 years"[dp]']],
  'Text and data': [['Abstract', 'hasabstract'], ['Free full text', 'free full text[sb]'], ['Full text', 'full text[sb]'], ['Associated data', 'data[sb]']],
  'Publication type': [
    ['Randomized controlled trial', '"Randomized Controlled Trial"[pt]'], ['Controlled clinical trial', '"Controlled Clinical Trial"[pt]'],
    ['Clinical trial', '"Clinical Trial"[pt]'], ['Systematic review', 'systematic[sb]'], ['Meta-analysis', '"Meta-Analysis"[pt]'],
    ['Review', 'Review[pt]'], ['Observational study', '"Observational Study"[pt]'], ['Case reports', '"Case Reports"[pt]'],
    ['Guideline', 'Guideline[pt]'], ['Preprint', 'Preprint[pt]'], ['Books and documents', '"pubmed books"[sb]'],
  ],
  Species: [['Humans', 'Humans[mh]'], ['Other animals', 'Animals[mh] NOT Humans[mh]']],
  Sex: [['Female', 'Female[mh]'], ['Male', 'Male[mh]']],
  Age: ['Infant, Newborn', 'Infant', 'Child, Preschool', 'Child', 'Adolescent', 'Young Adult', 'Adult',
    'Middle Aged', 'Aged', 'Aged, 80 and over'].map(age => [age, `"${age}"[mh]`]),
  Subset: [['MEDLINE', 'medline[sb]'], ['PubMed Central', 'pubmed pmc[sb]'], ['Nursing', 'nursing[sb]'], ['Dental', 'dental[sb]']],
};
// NLM PubMed User Guide, Clinical Study Categories. These are query expressions, not local classifications.
const clinicalQueries = [
  ['Therapy · broad', '(clinical[tiab] AND trial[tiab]) OR clinical trials as topic[mh] OR clinical trial[pt] OR random*[tiab] OR random allocation[mh] OR therapeutic use[sh]'],
  ['Therapy · narrow', 'randomized controlled trial[pt] OR (randomized[tiab] AND controlled[tiab] AND trial[tiab])'],
  ['Diagnosis · broad', 'sensitiv*[tiab] OR sensitivity and specificity[mh] OR diagnose[tiab] OR diagnosed[tiab] OR diagnoses[tiab] OR diagnosing[tiab] OR diagnosis[tiab] OR diagnostic[tiab] OR diagnosis[mh:noexp] OR diagnostic equipment[mh:noexp] OR diagnostic errors[mh:noexp] OR diagnostic imaging[mh:noexp] OR diagnostic services[mh:noexp] OR diagnosis, differential[mh:noexp] OR diagnosis[sh:noexp]'],
  ['Diagnosis · narrow', 'specificity[tiab]'],
  ['Etiology · broad', 'risk*[tiab] OR risk*[mh:noexp] OR risk adjustment[mh:noexp] OR risk assessment[mh:noexp] OR risk factors[mh:noexp] OR risk management[mh:noexp] OR risk taking[mh:noexp] OR cohort studies[mh] OR group[tw] OR groups[tw] OR grouped[tw]'],
  ['Etiology · narrow', '(relative[tiab] AND risk*[tiab]) OR relative risk[tw] OR risks[tw] OR cohort studies[mh:noexp] OR (cohort[tiab] AND study[tiab]) OR (cohort[tiab] AND studies[tiab])'],
  ['Prognosis · broad', 'incidence[mh:noexp] OR mortality[mh] OR follow up studies[mh:noexp] OR prognos*[tw] OR predict*[tw] OR course*[tw]'],
  ['Prognosis · narrow', 'prognos*[tiab] OR (first[tiab] AND episode[tiab]) OR cohort[tiab]'],
  ['Clinical prediction · broad', 'predict*[tiab] OR predictive value of tests[mh] OR score[tiab] OR scores[tiab] OR scoring system[tiab] OR scoring systems[tiab] OR observ*[tiab] OR observer variation[mh]'],
  ['Clinical prediction · narrow', 'validation[tiab] OR validate[tiab]'],
];

const tags = ['All Fields', 'Title', 'Title/Abstract', 'Author', 'First Author', 'Last Author', 'Journal',
  'Affiliation', 'MeSH Terms', 'MeSH Major Topic', 'MeSH Subheading', 'Publication Type', 'Publication Date',
  'Entry Date', 'Language', 'PMID', 'Article Identifier', 'Secondary Source ID', 'Grant Number', 'Text Word',
  'Other Term', 'Subset', 'Volume', 'Issue', 'Pagination'];
const formRecord = (record: LiteratureRecord, run: LiteratureRun): ScreeningItem => {
  const ym = record.date?.match(/\b(19|20)\d{2}\b/);
  return {
    id: record.id,
    title: record.title,
    abstract: record.abstract,
    pmid: record.pmid,
    doi: record.doi,
    ...(record.citation ? { journal: record.citation } : {}),
    ...(ym ? { year: ym[0] } : {}),
    ...(record.url ? { url: record.url } : {}),
    ...(record.details?.authors ? { authors: record.details.authors } : {}),
    source: run.source === 'pubmed' ? 'PubMed' : 'ClinicalTrials.gov',
    decision: 'unset',
    stage: 'title_abstract',
    searchRunIds: [run.id],
  };
};
const uniqueRecords = (records: LiteratureRecord[]) => [...new Map(records.map(record => [record.id, record])).values()];

export default function LiteratureSearch({ project, onChange, initialQuery = '', initialSource = 'pubmed' }: {
  project: Project; onChange: (project: Project) => void; initialQuery?: string; initialSource?: LiteratureSource;
}) {
  const [source, setSource] = useState<LiteratureSource>(initialSource);
  const [queries, setQueries] = useState<Partial<Record<LiteratureSource, string>>>({ [initialSource]: initialQuery });
  const query = queries[source] ?? '';
  const setQuery = (value: string) => setQueries(current => ({ ...current, [source]: value }));
  const [sort, setSort] = useState('');
  const [key, setKey] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [trialFields, setTrialFields] = useState<Record<string, string>>({});
  const [clinicalFilter, setClinicalFilter] = useState("");
  const [language, setLanguage] = useState('');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [operator, setOperator] = useState('AND');
  const [meshMode, setMeshMode] = useState('MeSH Terms');
  const [concepts, setConcepts] = useState<string[]>(['population', 'intervention']);
  const [results, setResults] = useState<LiteratureRecord[]>([]);
  const [page, setPage] = useState<LiteraturePage | null>(null);
  const [run, setRun] = useState<LiteratureRun | null>(null);
  const [selection, setSelection] = useState(new Set<string>());
  const [windowIndex, setWindowIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmImport, setConfirmImport] = useState<LiteratureRecord[] | null>(null);
  const controller = useRef<AbortController | null>(null);
  const currentProject = useRef(project);
  currentProject.current = project;
  const currentOnChange = useRef(onChange);
  currentOnChange.current = onChange;
  const history = project.search?.runs ?? [];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  function saveRun(entry: LiteratureRun, withProject = currentProject.current) {
    const search = withProject.search ?? { databases: [] };
    const runs = search.runs ?? [];
    const next = runs.some(item => item.id === entry.id)
      ? runs.map(item => item.id === entry.id ? entry : item) : [...runs, entry];
    const updated = { ...withProject, search: { ...search, runs: next } };
    currentProject.current = updated;
    currentOnChange.current(updated);
  }

  function effectiveQuery() {
    if (source !== 'pubmed') return query.trim();
    const input = query.trim();
    const doi = input.replace(/^https?:\/\/doi\.org\//i, "");
    const lookup = /^\d+$/.test(input) ? `${input}[pmid]`
      : /^10\.\d{4,9}\/[^\s"\[\]]+$/i.test(doi) ? `"${doi}"[aid]` : input;
    const base = resolveSearchLines(lookup, history.map(item => item.source === 'pubmed' ? item.query : ''));
    const clauses = Object.values(filters).filter(values => values.length).map(values =>
      `(${values.map(value => `(${value})`).join(' OR ')})`);
    if (clinicalFilter) clauses.push(`(${clinicalFilter})`);
    if (language.trim()) clauses.push(`"${language.trim().replaceAll('"', '')}"[la]`);
    if (dates.from || dates.to) {
      if (dates.from && dates.to && dates.from > dates.to) throw new Error('The start date must come before the end date.');
      clauses.push(`("${dates.from || '1800-01-01'}"[dp] : "${dates.to || '3000-12-31'}"[dp])`);
    }
    return clauses.length ? [base && `(${base})`, ...clauses].filter(Boolean).join(' AND ') : base;
  }

  async function execute(mode: 'new' | 'next' | 'all', previous?: LiteratureRun) {
    if (controller.current) return;
    const signalController = new AbortController();
    controller.current = signalController;
    setBusy(true);
    setError('');
    setNotice('');
    let partial: LiteratureRun | undefined;
    try {
      if (mode === 'new') {
        const q = previous?.query ?? effectiveQuery();
        const inputFields = previous?.fields ?? (source === 'clinicaltrials' ? trialFields : {});
        const database = previous?.source ?? source;
        const order = previous?.sort ?? (sort || (database === 'pubmed' ? 'relevance' : ''));
        if (!q && !Object.values(inputFields).some(value => value.trim())) throw new Error('Enter a query or choose a filter.');
        const first = await searchLiterature(database, q, order, signalController.signal, { key, trialFields: inputFields });
        if (!mounted.current) return;
        if (signalController.signal.aborted) throw signalController.signal.reason;
        const found = uniqueRecords(first.records);
        const entry = { id: crypto.randomUUID(), source: database, query: q, fields: inputFields, sort: order,
          at: new Date().toISOString(), total: first.total, translated: first.translated, warnings: first.warnings,
          retrieved: found.map(record => record.id), imported: 0, duplicates: 0 };
        setRun(entry);
        saveRun(entry);
        setResults(found);
        setPage(first);
        setSelection(new Set());
        setConfirmImport(null);
        setWindowIndex(0);
      } else if (run && page?.next) {
        let current = page;
        let accumulated = results;
        do {
          const response = await searchLiterature(run.source, run.query, run.sort, signalController.signal,
            { cursor: current.next, key, trialFields: run.fields });
          if (!mounted.current) return;
          if (signalController.signal.aborted) throw signalController.signal.reason;
          if (response.total !== run.total || (response.next && response.next === current.next)) {
            throw new Error('The source changed during retrieval. Rerun the search for a consistent result set.');
          }
          accumulated = uniqueRecords([...accumulated, ...response.records]);
          current = response;
          setPage(current);
          setResults(accumulated);
          partial = { ...run, retrieved: accumulated.map(record => record.id) };
          setRun(partial);
        } while (mode === 'all' && current.next);
        const updated = { ...run, retrieved: accumulated.map(record => record.id) };
        setRun(updated);
        saveRun(updated);
        if (mode === 'next') setWindowIndex(Math.floor(results.length / 30));
      }
    } catch (err) {
      if (mounted.current) {
        if (partial) saveRun(partial);
        if (signalController.signal.aborted) setNotice('Retrieval canceled. Fetched records are available.');
        else setError(err instanceof Error ? err.message : 'Search failed.');
      }
    } finally {
      controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  function append(clause: string, join = operator) {
    setQuery(query.trim() ? `(${query.trim()}) ${join} (${clause})` : clause);
  }

  function importRecords(records: LiteratureRecord[]) {
    if (!run || busy) return;
    const project = currentProject.current;
    const existing = project.screening.title_abstract;
    const ids = new Set(existing.map(item => item.id));
    const incoming = records.map(record => formRecord(record, run));
    const { kept } = dedupeRecords(incoming.filter(record => !ids.has(record.id)), existing);
    const updated = { ...run, imported: run.imported + kept.length, duplicates: run.duplicates + records.length - kept.length };
    const merged = mergeScreeningItems(project, 'title_abstract', kept);
    const importedIds = new Set(incoming.map(item => item.id));
    merged.screening.title_abstract = merged.screening.title_abstract.map(item =>
      importedIds.has(item.id) && !item.searchRunIds?.includes(run.id)
        ? { ...item, searchRunIds: [...(item.searchRunIds ?? []), run.id] } : item);
    setRun(updated);
    saveRun(updated, merged);
    setNotice(`Imported ${kept.length} records. Skipped ${records.length - kept.length} duplicates.`);
    setConfirmImport(null);
  }

  function exportRecords(format: string) {
    if (!run || !results.length) return;
    const rows = selection.size ? results.filter(record => selection.has(record.id)) : results;
    const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
    const body = rows.map(record => {
      if (format === 'nbib') return [
        `PMID- ${record.pmid}`, `TI  - ${clean(record.title)}`, `AB  - ${clean(record.abstract)}`,
        `DP  - ${record.date ?? ''}`, ...(record.doi ? [`AID - ${record.doi} [doi]`] : []),
      ].join('\n');
      if (format === 'ris') return [
        `TY  - ${record.nct ? 'ELEC' : 'JOUR'}`, `ID  - ${record.pmid ?? record.nct}`, `TI  - ${clean(record.title)}`,
        `AB  - ${clean(record.abstract)}`, `UR  - ${record.url}`, `DO  - ${record.doi ?? ''}`, 'ER  -',
      ].join('\n');
      if (format === 'bib') return `@misc{${record.id},\n  title = {${clean(record.title).replace(/[{}\\]/g, '')}},\n  url = {${record.url}}\n}`;
      return record.pmid ?? record.nct ?? record.id;
    }).join(format === 'txt' ? '\n' : '\n\n');
    downloadText(`poolr-${run.source}.${format}`, format === 'csv'
      ? toCsv(rows.map(({ details, ...record }) => ({ ...record, ...details }))) : body + '\n');
  }

  const visible = results.slice(windowIndex * 30, (windowIndex + 1) * 30);
  const selected = results.filter(record => selection.has(record.id));
  const preview = confirmImport ? dedupeRecords(confirmImport.map(record => formRecord(record, run!))
    .filter(item => !project.screening.title_abstract.some(existing => existing.id === item.id)), project.screening.title_abstract).kept.length : 0;

  return <section className="literature" aria-label="Literature and trial search">
    <header className="lit-header">
      <div className="lit-heading-icon"><BookOpen size={23} aria-hidden /></div>
      <div><h2>Literature search</h2><p>Find references and trial registrations for this review.</p></div>
    </header>

    <form className="lit-toolbar" onSubmit={event => { event.preventDefault(); void execute('new'); }}>
      <div className="lit-row">
        <label>Database<select value={source} onChange={event => { setSource(event.target.value as LiteratureSource); setSort(''); }}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="">Best match</option>
          {source === 'pubmed' ? <>
            <option value="date">Most recent</option><option value="pubdate">Publication date</option>
            <option value="fauth">First author</option><option value="jour">Journal</option>
          </> : <><option value="LastUpdatePostDate:desc">Last updated</option><option value="StudyFirstPostDate:desc">First posted</option><option value="StartDate:desc">Start date</option></>}
        </select></label>
      </div>
      <label htmlFor="literature-query">{source === 'pubmed' ? 'PubMed query' : 'Trial search terms'}</label>
      <div className="lit-searchbar">
        <Search size={19} aria-hidden />
        <textarea id="literature-query" rows={2} value={query} onChange={event => setQuery(event.target.value)}
          placeholder={source === 'pubmed' ? 'Keywords, PubMed query, PMID, or DOI' : 'Enter a condition, intervention, or NCT identifier'} />
        <button className="lit-primary" disabled={busy}>Search</button>
      </div>
      {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel retrieval</button>}
    </form>

    <BooleanQueryBuilder key={source} source={source} fields={source === 'pubmed' ? tags : []} onApply={setQuery} />
    <div className="lit-tools">
      {source === 'pubmed' ? <>
        <details><summary>PICO and MeSH</summary>
          <label>Combine with current query<select value={operator} onChange={event => setOperator(event.target.value)}>{['AND', 'OR', 'NOT'].map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="lit-row">
            {Object.entries(project.pico).map(([concept, value]) => <label key={concept} className="lit-choice">
              <input type="checkbox" checked={concepts.includes(concept)} disabled={!value.trim()} onChange={() =>
                setConcepts(current => current.includes(concept) ? current.filter(item => item !== concept) : [...current, concept])} />{concept}
            </label>)}
            <button disabled={!Object.entries(project.pico).some(([name, value]) => value.trim() && concepts.includes(name))}
              onClick={() => append(Object.entries(project.pico).filter(([name, value]) => value.trim() && concepts.includes(name))
                .map(([, value]) => `(${value.split(/[;,]/).map((term: string) => term.trim()).filter(Boolean).map((term: string) => `"${term.replaceAll('"', '')}"[tiab]`).join(' OR ')})`).join(' AND '))}>Add selected PICO concepts</button>
          </div>
          <details><summary>Find MeSH headings</summary>
            <label>Insert as<select value={meshMode} onChange={event => setMeshMode(event.target.value)}>
              <option>MeSH Terms</option><option value="mh:noexp">MeSH without explosion</option><option>MeSH Major Topic</option><option>MeSH Subheading</option>
            </select></label>
            <MeSHBrowser apiKey={key} onSelect={(heading, subheading) => append(`"${heading.replaceAll('"', '')}${subheading ? "/" + subheading : ""}"[${subheading ? "mh" : meshMode}]`)} />
          </details>
        </details>
        <details><summary>Filters {Object.values(filters).flat().length > 0 && `(${Object.values(filters).flat().length})`}</summary>
          <div className="lit-filter-grid">
            {Object.entries(pubmedFilters).map(([group, choices]) => <fieldset key={group}><legend>{group}</legend>
              {choices.map(([label, value]) => <label key={value} className="lit-choice">
                <input type="checkbox" checked={(filters[group] ?? []).includes(value)} onChange={() => setFilters(current => {
                  const values = current[group] ?? [];
                  return { ...current, [group]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
                })} />{label}
              </label>)}
            </fieldset>)}
          </div>
          <div className="lit-row">
            <label>From<input type="date" value={dates.from} onChange={event => setDates({ ...dates, from: event.target.value })} /></label>
            <label>Through<input type="date" value={dates.to} onChange={event => setDates({ ...dates, to: event.target.value })} /></label>
            <label>Language<input value={language} onChange={event => setLanguage(event.target.value)} placeholder="e.g. English" /></label>
            <button onClick={() => { setFilters({}); setDates({ from: '', to: '' }); setLanguage(''); setClinicalFilter(''); }}>Clear filters</button>
          </div>
          <p>MeSH-based filters can omit records that have not been indexed.</p>
        </details>
        <details><summary>Clinical Queries</summary>
          <label>Clinical study category<select value={clinicalFilter} onChange={event => setClinicalFilter(event.target.value)}>
            <option value="">All clinical study categories</option>
            {clinicalQueries.map(([label, expression]) => <option value={expression} key={label}>{label}</option>)}
          </select></label>
          <a href={`https://pubmed.ncbi.nlm.nih.gov/clinical/?term=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">Open Clinical Queries <ExternalLink size={13} aria-hidden /></a>
        </details>
        <details><summary>NCBI API key</summary><label>API key for this session<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} /></label></details>
      </> : <details><summary>Trial filters</summary><div className="lit-filter-grid">
        {fields.map(([label, field]) => <label key={field}>{label}<input value={trialFields[field] ?? ''}
          onChange={event => setTrialFields(current => ({ ...current, [field]: event.target.value }))} /></label>)}
        <label>Recruitment status<select value={trialFields['filter.overallStatus'] ?? ''}
          onChange={event => setTrialFields(current => ({ ...current, 'filter.overallStatus': event.target.value }))}>
          <option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select></label>
        <button onClick={() => setTrialFields({})}>Clear filters</button>
      </div></details>}
      <details><summary>Project search history ({history.length})</summary>
        {history.length === 0 ? <p>Searches you run appear here.</p> : <>
          <ol>{history.map((entry, index) => <li key={entry.id}>
            <strong>#{index + 1} · {labels[entry.source]} · {entry.total.toLocaleString()} found</strong>
            <p>{new Date(entry.at).toLocaleString()} · {entry.retrieved.length} fetched · {entry.imported} imported · {entry.duplicates} duplicates</p>
            <code>{entry.query || Object.values(entry.fields).filter(Boolean).join(' · ')}</code>
            <div className="lit-row"><button disabled={busy} onClick={() => void execute('new', entry)}>Rerun exact strategy</button>
              {entry.source === 'pubmed' && <button onClick={() => { setSource('pubmed'); append(`#${index + 1}`); }}>Add line</button>}
            </div>
          </li>)}</ol>
          <button onClick={() => downloadText('poolr-search-history.json', JSON.stringify(history, null, 2), 'application/json')}>Export search history</button>
        </>}
      </details>
    </div>

    {error && <p className="lit-message" role="alert">{error}</p>}
    <p role="status">{busy ? 'Retrieving records…' : notice}</p>
    {run && <section aria-label="Search results">
      <div className="lit-results-header">
        <div><h3>{labels[run.source]} results</h3><p>{run.total.toLocaleString()} found · {results.length.toLocaleString()} fetched · {selection.size} selected</p></div>
        <div className="lit-row">
          {page?.next && <button disabled={busy} onClick={() => void execute('all')}>Retrieve remaining</button>}
          <button className="lit-primary" disabled={!results.length || busy} onClick={() => setConfirmImport(selected.length ? selected : results)}>
            <Download size={16} aria-hidden /> Import {selected.length ? 'selected' : 'fetched'}
          </button>
        </div>
      </div>
      {results.length < run.total && <p className="lit-message">Partial retrieval. {results.length.toLocaleString()} of {run.total.toLocaleString()} records are available locally.</p>}
      <details className="lit-details"><summary>Search Details</summary>
        <p>Submitted query</p><code>{run.query || 'Filter-only search'}</code>
        {Object.entries(run.fields).filter(([, value]) => value.trim()).map(([field, value]) => <p key={field}>{field}: {value}</p>)}
        {run.translated && <><p>PubMed translation</p><code>{run.translated}</code></>}
        {run.warnings.map(warning => <p key={warning} className="lit-message">{warning}</p>)}
        {run.source === 'pubmed' && <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(run.query)}`} target="_blank" rel="noreferrer">Open query in PubMed <ExternalLink size={13} aria-hidden /></a>}
      </details>
      {confirmImport && <div className="lit-message">
        <p>{preview} new records · {confirmImport.length - preview} duplicates</p>
        <div className="lit-row"><button className="lit-primary" disabled={busy} onClick={() => importRecords(confirmImport)}>Confirm import</button>
          <button onClick={() => setConfirmImport(null)}>Cancel import</button></div>
      </div>}
      {results.length === 0 ? <div className="lit-empty"><Database size={22} aria-hidden /><p>No records match this search.</p></div> : <>
        <div className="lit-row lit-actions">
          <button onClick={() => setSelection(current => new Set([...current, ...visible.map(record => record.id)]))}>Select page</button>
          {selection.size > 0 && <button onClick={() => setSelection(new Set())}>Clear selection</button>}
          <button disabled={busy} onClick={() => setConfirmImport(visible)}>Import page</button>
          <label>Export <select value="" onChange={event => exportRecords(event.target.value)}>
            <option value="" disabled>Choose format</option>
            {['csv', 'ris', 'bib', 'txt', ...(run.source === 'pubmed' ? ['nbib'] : [])].map(format => <option key={format} value={format}>{format === 'txt' ? 'Identifier list' : format.toUpperCase()}</option>)}
          </select></label>
        </div>
        <div className="lit-records">{visible.map(record => <article key={record.id} className="lit-record">
          <div className="lit-record-title">
            <input type="checkbox" aria-label={`Select ${record.title}`} checked={selection.has(record.id)} onChange={() => setSelection(current => {
              const next = new Set(current);
              if (next.has(record.id)) next.delete(record.id); else next.add(record.id);
              return next;
            })} />
            <div><h4><a href={record.url} target="_blank" rel="noreferrer">{record.title} <ExternalLink size={13} aria-hidden /></a></h4>
              <p>{[record.citation, record.date, record.pmid && `PMID ${record.pmid}`, record.nct].filter(Boolean).join(' · ')}</p></div>
          </div>
          <details><summary>{record.nct ? 'Study details' : 'Abstract and record details'}</summary>
            <p className="lit-abstract">{record.abstract || 'No abstract or summary supplied by the source.'}</p>
            {record.doi && <p>DOI {record.doi}</p>}
            {record.pmcid && /^PMC\d+$/.test(record.pmcid) && <a href={`https://pmc.ncbi.nlm.nih.gov/articles/${record.pmcid}/`} target="_blank" rel="noreferrer">Full text in PubMed Central</a>}
            <dl>{Object.entries(record.details).filter(([, value]) => value).map(([label, value]) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </details>
        </article>)}</div>
        <nav className="lit-row lit-pagination" aria-label="Result pages">
          <button disabled={windowIndex === 0} onClick={() => setWindowIndex(windowIndex - 1)}>Previous</button>
          <span>Page {windowIndex + 1}</span>
          <button disabled={busy || ((windowIndex + 1) * 30 >= results.length && !page?.next)}
            onClick={() => (windowIndex + 1) * 30 < results.length ? setWindowIndex(windowIndex + 1) : void execute('next')}>Next</button>
        </nav>
      </>}
    </section>}
  </section>;
}
