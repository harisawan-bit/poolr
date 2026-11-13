export type LiteratureSource = 'pubmed' | 'clinicaltrials';

export interface LiteratureRecord {
  id: string;
  title: string;
  abstract: string;
  citation: string;
  date?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  nct?: string;
  details: Record<string, string>;
  url: string;
}

export interface LiteraturePage {
  records: LiteratureRecord[];
  total: number;
  next?: string;
  translated?: string;
  warnings: string[];
}

import { ENGINE_URL } from './client';

const ncbi = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const pageSize = 30;
let nextNcbiRequest = 0;

async function request(url: URL, signal: AbortSignal, key?: string) {
  const isNcbi = url.hostname === 'eutils.ncbi.nlm.nih.gov';
  if (key && isNcbi) url.searchParams.set('api_key', key);
  for (let attempt = 0; ; attempt++) {
    if (isNcbi) {
      const slot = Math.max(Date.now(), nextNcbiRequest);
      nextNcbiRequest = slot + (key ? 120 : 350);
      if (slot > Date.now()) await new Promise(resolve => setTimeout(resolve, slot - Date.now()));
    }
    const endpoint = isNcbi ? url.pathname.split('/').pop()!.replace('.fcgi', '') : 'trials';
    const local = new URL(`/api/literature/${endpoint}`, ENGINE_URL);
    local.search = url.search;
    const response = await fetch(local, { signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) });
    if (response.ok) return response;
    if (attempt >= 2 || ![429, 502, 503, 504].includes(response.status)) {
      throw new Error(`The database returned HTTP ${response.status}.`);
    }
    const retry = response.headers.get('Retry-After');
    const seconds = retry ? Number(retry) : NaN;
    const delay = Number.isFinite(seconds) ? seconds * 1000 : retry ? Date.parse(retry) - Date.now() : NaN;
    if (delay > 30000) throw new Error('The database asked us to wait. Retry this page later.');
    await new Promise(resolve => setTimeout(resolve, Number.isFinite(delay) ? Math.max(delay, 500) : 900 * 2 ** attempt));
  }
}

export async function searchMesh(query: string, signal: AbortSignal, key?: string) {
  const lookup = new URL('esearch.fcgi', ncbi);
  lookup.search = new URLSearchParams({ db: 'mesh', term: query, retmode: 'json', retmax: '12' }).toString();
  const payload = await (await request(lookup, signal, key)).json();
  const ids: string[] = payload.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const summary = new URL('esummary.fcgi', ncbi);
  summary.search = new URLSearchParams({ db: 'mesh', id: ids.join(','), retmode: 'json' }).toString();
  const data = await (await request(summary, signal, key)).json();
  return ids.flatMap(id => {
    const entry = data.result?.[id];
    const heading = entry?.ds_meshterms?.[0];
    return typeof heading === 'string' ? [{
      heading, ui: String(entry.ds_meshui ?? ''), description: String(entry.ds_scopenote ?? ''),
      trees: (entry.ds_idxlinks ?? []).map((link: { treenum: string }) => link.treenum).filter(Boolean) as string[],
      subheadings: (entry.ds_subheading ?? []) as string[],
    }] : [];
  });
}

function xmlRecords(xml: string): LiteratureRecord[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror, ERROR')) throw new Error('PubMed returned an unreadable record batch.');
  return Array.from(doc.querySelectorAll('PubmedArticle, PubmedBookArticle')).flatMap(record => {
    const value = (selector: string) => record.querySelector(selector)?.textContent?.trim() ?? '';
    const list = (selector: string) => Array.from(record.querySelectorAll(selector));
    const pmid = value('MedlineCitation > PMID, BookDocument > PMID');
    if (!/^\d+$/.test(pmid)) return [];
    const date = value('ArticleDate > Year, JournalIssue PubDate > Year, Book PubDate > Year') ||
      value('JournalIssue PubDate > MedlineDate, Book PubDate > MedlineDate');
    const authors = list('AuthorList > Author').map(author =>
      author.querySelector('CollectiveName')?.textContent ??
      ['LastName', 'ForeName'].map(tag => author.querySelector(tag)?.textContent).filter(Boolean).join(' '));
    const abstract = list('Abstract > AbstractText').map(node =>
      [node.getAttribute('Label'), node.textContent?.trim()].filter(Boolean).join(': ')).join('\n\n');
    return [{
      id: `pubmed-${pmid}`, pmid, title: value('ArticleTitle, BookTitle') || 'Untitled record',
      abstract, date, doi: value('ArticleId[IdType="doi"]'), pmcid: value('ArticleId[IdType="pmc"]'),
      citation: [authors.filter(Boolean).join(', '), value('Journal > Title, BookTitle')].filter(Boolean).join(' · '),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      details: {
        'Publication types': list('PublicationType').map(node => node.textContent).join(', '),
        MeSH: list('DescriptorName').map(node => node.textContent).join(', '),
        Affiliations: [...new Set(list('Affiliation').map(node => node.textContent))].join('; '),
        'Publication notices': list('CommentsCorrections').map(node =>
          [node.getAttribute('RefType'), node.querySelector('PMID')?.textContent].filter(Boolean).join(' · ')).join('; '),
      },
    }];
  });
}

export async function searchLiterature(source: LiteratureSource, query: string, sort: string, signal: AbortSignal,
                                       options: { cursor?: string; key?: string; trialFields?: Record<string, string> } = {}): Promise<LiteraturePage> {
  if (source === 'clinicaltrials') {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    url.search = new URLSearchParams({ pageSize: String(pageSize), countTotal: 'true' }).toString();
    if (query) url.searchParams.set('query.term', query);
    if (sort) url.searchParams.set('sort', sort);
    const cursor = options.cursor ? JSON.parse(options.cursor) as { token: string; total: number } : undefined;
    if (cursor) url.searchParams.set('pageToken', cursor.token);
    for (const [field, value] of Object.entries(options.trialFields ?? {})) {
      if (value.trim()) url.searchParams.set(field, value.trim());
    }
    const payload = await (await request(url, signal)).json();
    const total = payload.totalCount ?? cursor?.total;
    if (typeof total !== 'number') throw new Error('ClinicalTrials.gov did not return a result count.');
    const records: LiteratureRecord[] = (payload.studies ?? []).flatMap((study: any) => {
      const p = study.protocolSection;
      const nct = p?.identificationModule?.nctId;
      if (typeof nct !== 'string' || !/^NCT\d{8}$/.test(nct)) return [];
      return [{
        id: `ct-${nct}`, nct, title: p.identificationModule.briefTitle || 'Untitled study',
        citation: p.sponsorCollaboratorsModule?.leadSponsor?.name || '',
        date: p.statusModule?.startDateStruct?.date,
        abstract: p.descriptionModule?.briefSummary || '',
        url: `https://clinicaltrials.gov/study/${nct}`,
        details: {
          Status: p.statusModule?.overallStatus?.replaceAll('_', ' ') || '',
          'Study type': p.designModule?.studyType || '',
          Phase: p.designModule?.phases?.join(', ') || '',
          Conditions: p.conditionsModule?.conditions?.join(', ') || '',
          Interventions: p.armsInterventionsModule?.interventions?.map((item: {name: string}) => item.name).join(', ') || '',
          Enrollment: String(p.designModule?.enrollmentInfo?.count ?? ''),
          Eligibility: p.eligibilityModule?.eligibilityCriteria || '',
          Locations: [...new Set(p.contactsLocationsModule?.locations?.map((item: {country: string}) => item.country) ?? [])].filter(Boolean).join(', '),
          'Primary outcomes': p.outcomesModule?.primaryOutcomes?.map((item: {measure: string}) => item.measure).join('; ') || '',
          'Posted results': study.hasResults ? 'Available on ClinicalTrials.gov' : 'No posted results',
        },
      }];
    });
    if (records.length !== (payload.studies ?? []).length) throw new Error('ClinicalTrials.gov returned records without valid NCT identifiers.');
    return { records, total, next: payload.nextPageToken ? JSON.stringify({ token: payload.nextPageToken, total }) : undefined, warnings: [] };
  }

  const cursor = options.cursor ? JSON.parse(options.cursor) as {
    webenv: string; querykey: string; start: number; total: number;
  } : undefined;
  let history = cursor;
  let translated: string | undefined;
  let warnings: string[] = [];
  if (!history) {
    const url = new URL('esearch.fcgi', ncbi);
    url.search = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', usehistory: 'y', retmax: '0', sort }).toString();
    const payload = await (await request(url, signal, options.key)).json();
    const result = payload.esearchresult;
    const total = Number(result?.count);
    if (!Number.isSafeInteger(total) || total < 0 || result.ERROR || payload.error) throw new Error('PubMed could not run this search.');
    translated = result.querytranslation;
    warnings = Object.values(result.warninglist ?? {}).flatMap(value => Array.isArray(value) ? value.map(String) : [String(value)]);
    if (!total) return { records: [], total, translated, warnings };
    if (!result.webenv || !result.querykey) throw new Error('PubMed did not provide a search session.');
    history = { webenv: result.webenv, querykey: result.querykey, start: 0, total };
  }
  const { webenv, querykey, start, total } = history;
  const limit = Math.min(total, 10000);
  const count = Math.min(pageSize, limit - start);
  const url = new URL('efetch.fcgi', ncbi);
  url.search = new URLSearchParams({ db: 'pubmed', WebEnv: webenv, query_key: querykey, retmode: 'xml',
    retstart: String(start), retmax: String(count) }).toString();
  const records = xmlRecords(await (await request(url, signal, options.key)).text());
  if (records.length !== count) throw new Error('PubMed returned an incomplete batch. Retry this page or rerun the search if it expired.');
  if (total > limit) warnings.push('This search exceeds the PubMed API retrieval limit of 10,000 records. Narrow the date ranges and reconcile the results before treating them as complete.');
  return {
    records, total, translated, warnings,
    next: start + count < limit ? JSON.stringify({ ...history, start: start + count }) : undefined,
  };
}

export function resolveSearchLines(query: string, lines: string[]) {
  let quoted = false;
  return query.replace(/"|#(\d+)/g, (token, id?: string) => {
    if (token === '"') { quoted = !quoted; return token; }
    if (quoted) return token;
    const line = lines[Number(id) - 1];
    if (!line) throw new Error(`Search line ${token} was not found in this project.`);
    return `(${line})`;
  });
}
