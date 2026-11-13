import { useState } from 'react';

type Source = 'pubmed' | 'clinicaltrials' | 'prospero';
type Operator = 'AND' | 'OR' | 'NOT' | 'NEAR';
type Term = { id: string; value: string; operator: Operator; field: string; match: 'words' | 'phrase' | 'prefix'; distance: number };
type Group = { id: string; operator: Operator; terms: Term[] };
const operators = { AND: 'AND · require both', OR: 'OR · either', NOT: 'NOT · exclude', NEAR: 'NEAR · nearby in order' };
const newTerm = (): Term => ({ id: crypto.randomUUID(), value: '', operator: 'AND', field: '', match: 'words', distance: 6 });
const newGroup = (): Group => ({ id: crypto.randomUUID(), operator: 'AND', terms: [newTerm()] });

export function buildBooleanQuery(groups: Group[], source: Source) {
  return groups.reduce((query, group) => {
    const clause = group.terms.reduce((left, term) => {
      const value = term.value.trim().replace(/\s+/g, ' ');
      if (!value) return left;
      if (/["()[\]*]/.test(value) || (source === 'prospero' && /[:#]/.test(value))) {
        throw new Error('Enter a term without search punctuation here. You can paste native syntax into the main query box.');
      }
      if (term.match === 'prefix' && !new RegExp(source === 'pubmed' ? '^\\p{L}{4,}$' : '^\\p{L}+$', 'u').test(value)) {
        throw new Error(source === 'pubmed' ? 'Enter one word with at least four letters for a PubMed wildcard.' : 'Enter one word for a PROSPERO wildcard.');
      }
      const field = !term.field ? '' : source === 'prospero' ? `:${term.field}` : `[${term.field}]`;
      if (term.operator === 'NEAR' && left && term.match === 'words' && value.includes(' ')) {
        throw new Error('Choose Exact phrase to use multiple words as the second part of a proximity search.');
      }
      const words = term.match === 'words' ? value.split(' ') : [value];
      const parts = words.map(word => {
        const literal = term.match === 'phrase' || /^(AND|OR|NOT|NEAR\d*|ADJ\d*|RANGE|ALL)$/i.test(word) ? `"${word}"` : word;
        return literal + (term.match === 'prefix' ? '*' : '') + field;
      });
      const right = parts.length > 1 ? `(${parts.join(' AND ')})` : parts[0];
      const join = term.operator === 'NEAR' ? `NEAR${term.distance}` : term.operator;
      return left ? `(${left} ${join} ${right})` : right;
    }, '');
    if (!clause) return query;
    return query ? `(${query} ${group.operator} ${clause})` : clause;
  }, '');
}

export default function BooleanQueryBuilder({ source, fields = [], fieldLabels = {}, onApply }: {
  source: Source; fields?: readonly string[]; fieldLabels?: Record<string, string>; onApply: (query: string) => void;
}) {
  const [groups, setGroups] = useState(() => [newGroup()]);
  const updateGroup = (id: string, update: (group: Group) => Group) =>
    setGroups(current => current.map(group => group.id === id ? update(group) : group));
  const updateTerm = (groupId: string, termId: string, patch: Partial<Term>) =>
    updateGroup(groupId, group => ({ ...group, terms: group.terms.map(term => term.id === termId ? { ...term, ...patch } : term) }));
  let preview = '';
  let error = '';
  try { preview = buildBooleanQuery(groups, source); }
  catch (err) { error = (err as Error).message; }

  function operatorSelect(value: Operator, change: (value: Operator) => void, near = false) {
    return <select value={value} onChange={event => change(event.target.value as Operator)}>
      {(Object.keys(operators) as Operator[]).filter(operator => near || operator !== 'NEAR').map(operator =>
        <option key={operator} value={operator}>{operators[operator]}</option>)}
    </select>;
  }

  return <div className="lit-tools">
    <details>
      <summary>Visual query builder</summary>
      <p>Choose how terms and groups combine. Within a group, rows combine in order.</p>
      {groups.map((group, groupIndex) => <fieldset className="lit-query-group" key={group.id}>
        <legend>Group {groupIndex + 1}</legend>
        {groupIndex > 0 && <label>Combine with earlier groups{operatorSelect(group.operator, operator =>
          updateGroup(group.id, current => ({ ...current, operator })))}</label>}
        {group.terms.map((term, termIndex) => <div className="lit-query-row" key={term.id}>
          {termIndex > 0 && <label>Combine with earlier terms{operatorSelect(term.operator, operator =>
            updateTerm(group.id, term.id, { operator }), source === 'prospero')}</label>}
          {term.operator === 'NEAR' && termIndex > 0 && <label>Within words
            <input type="number" min={1} max={99} value={term.distance} onChange={event =>
              updateTerm(group.id, term.id, { distance: Math.max(1, Math.min(99, Math.trunc(Number(event.target.value)) || 1)) })} />
          </label>}
          <label>Term<input value={term.value} onChange={event => updateTerm(group.id, term.id, { value: event.target.value })} /></label>
          <label>Match<select value={term.match} onChange={event => updateTerm(group.id, term.id, { match: event.target.value as Term['match'] })}>
            <option value="words">All words</option><option value="phrase">Exact phrase</option>
            {source !== 'clinicaltrials' && <option value="prefix">Word starts with</option>}
          </select></label>
          {fields.length > 0 && <label>Field<select value={term.field} onChange={event => updateTerm(group.id, term.id, { field: event.target.value })}>
            <option value="">Any field</option>
            {fields.map(field => <option key={field} value={field}>{fieldLabels[field] ?? field}</option>)}
          </select></label>}
          {group.terms.length > 1 && <button type="button" aria-label={`Remove term ${termIndex + 1} from group ${groupIndex + 1}`}
            onClick={() => updateGroup(group.id, current => ({ ...current, terms: current.terms.filter(item => item.id !== term.id) }))}>Remove term</button>}
        </div>)}
        <div className="lit-row">
          <button type="button" onClick={() => updateGroup(group.id, current => ({ ...current, terms: [...current.terms, newTerm()] }))}>Add term</button>
          {groups.length > 1 && <button type="button" aria-label={`Remove group ${groupIndex + 1}`}
            onClick={() => setGroups(current => current.filter(item => item.id !== group.id))}>Remove group</button>}
        </div>
      </fieldset>)}
      <button type="button" onClick={() => setGroups(current => [...current, newGroup()])}>Add group</button>
      {error && <p role="alert">{error}</p>}
      {preview && <div><p>Query preview</p><code>{preview}</code></div>}
      <button type="button" className="lit-primary" disabled={!preview} onClick={() => onApply(preview)}>Use this query</button>
    </details>
  </div>;
}
