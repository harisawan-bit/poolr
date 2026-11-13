import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSearchLines, searchLiterature } from '../api/literature';
import { emptyProject, normalizeProject } from '../project';

afterEach(() => vi.unstubAllGlobals());

describe('literature search', () => {
  it('expands saved lines without changing quoted literals', () => {
    expect(resolveSearchLines('#1 AND "#2"', ['trial[ti]'])).toBe('(trial[ti]) AND "#2"');
    expect(() => resolveSearchLines('#2', ['trial'])).toThrow('not found');
  });

  it('carries the trial cursor, status filter and real dates to the next page', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      nextPageToken: 'next',
      studies: [{ protocolSection: {
        identificationModule: { nctId: 'NCT01234567', briefTitle: 'Trial' },
        statusModule: { startDateStruct: { date: '2020-01' }, overallStatus: 'RECRUITING' },
      } }],
    })));
    vi.stubGlobal('fetch', fetcher);
    const page = await searchLiterature('clinicaltrials', '', '', new AbortController().signal,
      { cursor: JSON.stringify({ token: 'first', total: 31 }), trialFields: { 'filter.overallStatus': 'RECRUITING' } });
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/api/literature/trials');
    expect(url.searchParams.get('pageToken')).toBe('first');
    expect(url.searchParams.get('countTotal')).toBe('true');
    expect(url.searchParams.get('filter.overallStatus')).toBe('RECRUITING');
    expect(page).toMatchObject({ next: JSON.stringify({ token: 'next', total: 31 }), total: 31, records: [{ nct: 'NCT01234567', date: '2020-01' }] });
  });

  it('preserves search provenance when reopening a project', () => {
    const project = emptyProject();
    const run = { id: 'run', source: 'pubmed' as const, query: 'trial', sort: 'relevance', at: '2026-11-13',
      total: 1, fields: {}, warnings: [], retrieved: ['pubmed-1'], imported: 1, duplicates: 0 };
    project.search = { databases: [], runs: [run] };
    project.screening.title_abstract.push({ id: 'pubmed-1', title: 'Trial', abstract: '', decision: 'include',
      stage: 'title_abstract', searchRunIds: ['run'] });
    const restored = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(restored.search?.runs?.[0]).toMatchObject(run);
    expect(restored.screening.title_abstract[0]).toMatchObject({ decision: 'include', searchRunIds: ['run'] });
  });
});
