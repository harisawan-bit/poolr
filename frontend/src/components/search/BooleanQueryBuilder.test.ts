import { describe, expect, it } from 'vitest';
import { buildBooleanQuery } from './BooleanQueryBuilder';

type Group = Parameters<typeof buildBooleanQuery>[0][number];
type Term = Group['terms'][number];
const term = (value: string, options: Partial<Term> = {}): Term =>
  ({ id: value, value, operator: 'AND', field: '', match: 'words', distance: 6, ...options });
const group = (terms: Term[], operator: Group['operator'] = 'AND'): Group => ({ id: 'group', operator, terms });

describe('visual search syntax', () => {
  it('groups synonyms and applies exclusions to the whole query', () => {
    expect(buildBooleanQuery([
      group([term(''), term('diabetes', { field: 'Title' }), term('blood sugar', { operator: 'OR', match: 'phrase', field: 'Title/Abstract' })]),
      group([term('exercise')]),
      group([term('mice'), term('rats', { operator: 'OR' })], 'NOT'),
    ], 'pubmed')).toBe('(((diabetes[Title] OR "blood sugar"[Title/Abstract]) AND exercise) NOT (mice OR rats))');
  });

  it('uses PROSPERO field, proximity and truncation syntax', () => {
    expect(buildBooleanQuery([group([term('heart failure', { match: 'phrase', field: 'TI' }),
      term('nurs', { operator: 'NEAR', distance: 3, match: 'prefix' })])], 'prospero')).toBe('("heart failure":TI NEAR3 nurs*)');
  });

  it('keeps literal Boolean keywords and trial phrases separate', () => {
    expect(buildBooleanQuery([group([term('heart failure', { match: 'phrase' }), term('OR', { operator: 'NOT' })])],
      'clinicaltrials')).toBe('("heart failure" NOT "OR")');
  });

  it('requires native syntax to be entered in the raw editor', () => {
    expect(() => buildBooleanQuery([group([term('x[TI]')])], 'pubmed')).toThrow();
    expect(() => buildBooleanQuery([group([term('abc', { match: 'prefix' })])], 'pubmed')).toThrow();
  });
});
