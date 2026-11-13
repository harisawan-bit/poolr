import { useMemo, useRef, useState } from "react";
import {
  CITATION_ACCEPT,
  dedupeRecords,
  downloadText,
  exportCitationsText,
  findDuplicateClusters,
  formatStudyLabel,
  importCitationText,
  linkCitationToExtractedStudy,
  mergeScreeningItems,
  type Project,
  type ScreeningItem,
} from "../lib/project";
import { openExternalUrl, readTextFiles } from "../lib/api";
import { Button, Card, EmptyState, Input, Pill, Textarea } from "./ui";
import {
  CopyCheck,
  Download,
  ExternalLink,
  FilePlus2,
  FileUp,
  FolderCheck,
  Link2,
  Plus,
  Search as SearchIcon,
  Trash2,
} from "lucide-react";

type FilterStage = "all" | "pending" | "included" | "excluded" | "full_text" | "extracted";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

export default function CitationManager({ project, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<FilterStage>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const taItems = useMemo(() => project.screening?.title_abstract ?? [], [project.screening?.title_abstract]);
  const ftItems = useMemo(() => project.screening?.full_text ?? [], [project.screening?.full_text]);
  const ftById = useMemo(() => new Map(ftItems.map((i) => [i.id, i])), [ftItems]);
  const extractedIds = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const s of project.extraction?.studies ?? []) {
      if (s.sourceId) ids.add(s.sourceId);
      if (s.study) names.add(s.study.trim().toLowerCase());
    }
    return { ids, names };
  }, [project.extraction?.studies]);

  // Unified library records (title_abstract plus any standalone full_text records)
  const library = useMemo(() => {
    const seen = new Set(taItems.map((i) => i.id));
    const extras = ftItems.filter((i) => !seen.has(i.id));
    return [...taItems, ...extras];
  }, [taItems, ftItems]);

  const clusters = useMemo(() => findDuplicateClusters(library), [library]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of library) for (const t of it.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [library]);

  const isExtracted = (it: ScreeningItem) =>
    extractedIds.ids.has(it.id) || extractedIds.names.has(formatStudyLabel(it).toLowerCase());

  const effectiveDecision = (it: ScreeningItem) => ftById.get(it.id)?.decision ?? it.decision;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return library.filter((it) => {
      const dec = effectiveDecision(it);
      if (stageFilter === "pending" && dec !== "unset" && dec !== "unsure") return false;
      if (stageFilter === "included" && dec !== "include") return false;
      if (stageFilter === "excluded" && dec !== "exclude") return false;
      if (stageFilter === "full_text" && !ftById.has(it.id) && it.stage !== "full_text") return false;
      if (stageFilter === "extracted" && !isExtracted(it)) return false;
      if (tagFilter && !(it.tags ?? []).includes(tagFilter)) return false;
      if (!needle) return true;
      const hay = `${it.title} ${it.authors ?? ""} ${it.year ?? ""} ${it.journal ?? ""} ${it.doi ?? ""} ${it.pmid ?? ""} ${it.abstract}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [library, query, stageFilter, tagFilter, ftById, extractedIds]);

  const selected = useMemo(
    () => library.find((it) => it.id === selectedId) ?? null,
    [library, selectedId]
  );

  const updateCitation = (id: string, patch: Partial<ScreeningItem>) => {
    onChange({
      ...project,
      screening: {
        title_abstract: taItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        full_text: ftItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      },
    });
  };

  const addManualCitation = () => {
    const item: ScreeningItem = {
      id: `cit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: "New reference — click to edit title",
      abstract: "",
      decision: "unset",
      stage: "title_abstract",
      source: "Manual",
    };
    onChange(mergeScreeningItems(project, "title_abstract", [item]));
    setSelectedId(item.id);
    setNotice("Added blank reference to your library.");
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded = await readTextFiles(files);
    const incoming: ScreeningItem[] = [];
    const formats = new Set<string>();
    for (const f of loaded) {
      const res = importCitationText(f.text, f.name, "title_abstract", taItems.length + incoming.length + 1);
      if (res.format !== "unknown") formats.add(res.format);
      incoming.push(...res.items);
    }
    if (incoming.length === 0) {
      setNotice("No recognizable citations found (supports MEDLINE, RIS, .nbib, EndNote, Rayyan/Covidence CSV, PMID lists).");
      return;
    }
    const { kept, duplicatesRemoved } = dedupeRecords(incoming, library);
    const next = mergeScreeningItems(project, "title_abstract", kept);
    // Also mirror pre-screened full_text inclusions if imported from Rayyan/Covidence CSV with decisions
    onChange(next);
    if (kept[0]) setSelectedId(kept[0].id);
    setNotice(
      `Imported ${kept.length} citation${kept.length === 1 ? "" : "s"} (${Array.from(formats).join(", ") || "auto"})${duplicatesRemoved ? ` · skipped ${duplicatesRemoved} duplicates` : ""}.`
    );
  };

  const mergeCluster = (clusterItems: ScreeningItem[]) => {
    if (clusterItems.length < 2) return;
    // Pick richest record (most non-empty fields / longest abstract / decided)
    const ranked = [...clusterItems].sort((a, b) => {
      const score = (x: ScreeningItem) =>
        (x.abstract?.length ?? 0) +
        (x.doi ? 80 : 0) +
        (x.pmid ? 80 : 0) +
        (x.authors ? 40 : 0) +
        (x.decision !== "unset" ? 120 : 0);
      return score(b) - score(a);
    });
    const keeper = ranked[0];
    const dropIds = new Set(ranked.slice(1).map((x) => x.id));
    const mergedTags = Array.from(new Set(clusterItems.flatMap((x) => x.tags ?? [])));
    const mergedPatch: Partial<ScreeningItem> = {
      doi: keeper.doi || ranked.find((x) => x.doi)?.doi,
      pmid: keeper.pmid || ranked.find((x) => x.pmid)?.pmid,
      authors: keeper.authors || ranked.find((x) => x.authors)?.authors,
      year: keeper.year || ranked.find((x) => x.year)?.year,
      journal: keeper.journal || ranked.find((x) => x.journal)?.journal,
      url: keeper.url || ranked.find((x) => x.url)?.url,
      pdfUrl: keeper.pdfUrl || ranked.find((x) => x.pdfUrl)?.pdfUrl,
      ...(mergedTags.length ? { tags: mergedTags } : {}),
    };
    onChange({
      ...project,
      screening: {
        title_abstract: taItems
          .filter((it) => !dropIds.has(it.id))
          .map((it) => (it.id === keeper.id ? { ...it, ...mergedPatch } : it)),
        full_text: ftItems
          .filter((it) => !dropIds.has(it.id))
          .map((it) => (it.id === keeper.id ? { ...it, ...mergedPatch } : it)),
      },
    });
    setSelectedId(keeper.id);
    setNotice(`Merged ${dropIds.size} duplicate${dropIds.size === 1 ? "" : "s"} into "${formatStudyLabel(keeper)}".`);
  };

  const sendToExtraction = (it: ScreeningItem) => {
    if (isExtracted(it)) {
      window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: "extraction" }));
      return;
    }
    const nextStudy = linkCitationToExtractedStudy(it);
    onChange({
      ...project,
      extraction: { studies: [...(project.extraction?.studies ?? []), nextStudy] },
    });
    setNotice(`Sent "${nextStudy.study}" to Study Manager & Extraction.`);
  };

  const removeCitation = (id: string) => {
    if (!window.confirm("Remove this citation from Screening/Library?")) return;
    onChange({
      ...project,
      screening: {
        title_abstract: taItems.filter((it) => it.id !== id),
        full_text: ftItems.filter((it) => it.id !== id),
      },
    });
    if (selectedId === id) setSelectedId(null);
  };

  const go = (page: string) => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: page }));

  return (
    <div className="space-y-3">
      <input
        ref={importRef}
        type="file"
        multiple
        accept={CITATION_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleImportFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {notice && (
        <div className="flex items-center justify-between gap-2 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1.5 text-[12px]">
          <span>{notice}</span>
          <button type="button" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={() => setNotice(null)} aria-label="Dismiss notice">✕</button>
        </div>
      )}

      <Card
        title="Reference & Citation Manager"
        subtitle="Central bibliographic library linking search runs, deduplication, screening decisions, full-text URLs/PDFs, and data extraction"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} title="Import MEDLINE, RIS, EndNote, Rayyan CSV, or Covidence CSV">
              <FileUp className="h-3.5 w-3.5" /> Import Citations
            </Button>
            <Button size="sm" variant="outline" onClick={addManualCitation}>
              <Plus className="h-3.5 w-3.5" /> Add Manual
            </Button>
            {clusters.length > 0 && (
              <Button size="sm" variant={showDuplicates ? "default" : "outline"} onClick={() => setShowDuplicates((v) => !v)}>
                <CopyCheck className="h-3.5 w-3.5" /> Duplicates ({clusters.length})
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={library.length === 0} onClick={() => downloadText("poolr_citations.bib", exportCitationsText(library, "bibtex"), "application/x-bibtex")}>
              <Download className="h-3.5 w-3.5" /> .bib
            </Button>
            <Button size="sm" variant="ghost" disabled={library.length === 0} onClick={() => downloadText("poolr_citations.ris", exportCitationsText(library, "ris"), "application/x-research-info-systems")}>
              <Download className="h-3.5 w-3.5" /> .ris
            </Button>
            <Button size="sm" variant="ghost" disabled={library.length === 0} onClick={() => downloadText("poolr_library.csv", exportCitationsText(library, "csv"), "text/csv")}>
              <Download className="h-3.5 w-3.5" /> .csv
            </Button>
          </div>
        }
      >
        {/* Pipeline summary + Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {([
            ["all", `All (${library.length})`],
            ["pending", `Pending (${library.filter((i) => effectiveDecision(i) === "unset" || effectiveDecision(i) === "unsure").length})`],
            ["included", `Included (${library.filter((i) => effectiveDecision(i) === "include").length})`],
            ["full_text", `Full-Text (${ftItems.length})`],
            ["extracted", `In Extraction (${library.filter(isExtracted).length})`],
            ["excluded", `Excluded (${library.filter((i) => effectiveDecision(i) === "exclude").length})`],
          ] as [FilterStage, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={stageFilter === key}
              className={`btn-ghost text-[11.5px] ${stageFilter === key ? "!border-[var(--color-border-strong)] !text-[var(--color-text)] font-medium" : ""}`}
              onClick={() => setStageFilter(key)}
            >
              {label}
            </button>
          ))}
          {allTags.length > 0 && (
            <select
              aria-label="Filter by tag"
              className="rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-[11.5px] text-[var(--color-text)]"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All tags ({allTags.length})</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              aria-label="Search reference library"
              className="h-8 pl-8 text-[12px]"
              placeholder="Search title, author, DOI, PMID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Duplicate Inspector */}
        {showDuplicates && clusters.length > 0 && (
          <div className="mb-3 space-y-2 rounded-[5px] border border-[var(--color-unsure)]/40 bg-[var(--color-unsure)]/10 p-3">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>Suspected Duplicate Clusters ({clusters.length})</span>
              <button type="button" className="btn-ghost text-[11px]" onClick={() => setShowDuplicates(false)}>Hide</button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {clusters.map((cl) => (
                <div key={cl.key} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[11.5px]">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium uppercase text-[var(--color-unsure)]">{cl.reason} match</span>
                    <span className="mx-1.5 text-[var(--color-text-muted)]">· {cl.items.length} records:</span>
                    <span className="text-[var(--color-text)]">{cl.items[0].title}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => mergeCluster(cl.items)}>
                    Merge &amp; keep best
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {library.length === 0 ? (
          <EmptyState icon="book" title="Your Reference Library is empty">
            Run a search in PubMed / ClinicalTrials / OpenAlex, or click <strong className="text-[var(--color-text)]">Import Citations</strong> to load MEDLINE, RIS, EndNote, Rayyan CSV, or Covidence CSV files.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            {/* Responsive scrollable library table */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Citation library table"
              className="contain-pane max-h-[500px] overflow-auto rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] lg:col-span-7"
            >
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-chrome)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">Citation</th>
                    <th className="px-2 py-2 font-medium">IDs / Source</th>
                    <th className="px-2 py-2 font-medium">Stage Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => {
                    const dec = effectiveDecision(it);
                    const tone = dec === "include" ? "include" : dec === "exclude" ? "exclude" : dec === "unsure" ? "unsure" : "neutral";
                    const extracted = isExtracted(it);
                    const active = selected?.id === it.id;
                    return (
                      <tr
                        key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        className={`cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 ${active ? "bg-[var(--color-row-active)]" : "hover:bg-[var(--hover-surface)]"}`}
                      >
                        <td className="px-2.5 py-2 align-top">
                          <div className="line-clamp-2 font-medium text-[var(--color-text)]">{it.title}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                            {[it.authors, it.journal, it.year].filter(Boolean).join(" · ") || "No author/year metadata"}
                          </div>
                          {!!it.tags?.length && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {it.tags.slice(0, 4).map((t) => <Pill key={t} tone="neutral">{t}</Pill>)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top whitespace-nowrap text-[11px] text-[var(--color-text-muted)]">
                          <div>{it.source ?? "Import"}</div>
                          {it.pmid && <div>PMID {it.pmid}</div>}
                          {it.doi && <div className="max-w-[120px] truncate">{it.doi}</div>}
                          {(it.pdfUrl || it.url) && <div className="text-[var(--color-include)]">Link attached</div>}
                        </td>
                        <td className="px-2 py-2 align-top whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <Pill tone={tone}>{ftById.has(it.id) ? `FT: ${dec}` : `TA: ${dec}`}</Pill>
                            {extracted && <Pill tone="accent">Extracted</Pill>}
                            {it.exclusion_reason && (
                              <span className="max-w-[130px] truncate text-[10px] text-[var(--color-text-muted)]" title={it.exclusion_reason}>
                                {it.exclusion_reason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                        No references match your current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Linked Citation & Full-Text Dossier Inspector */}
            <div className="contain-pane flex flex-col rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3 lg:col-span-5">
              {!selected ? (
                <EmptyState icon="book" title="Select a reference">
                  Inspect or edit bibliographic fields, attach a full-text URL/PDF reference, manage tags, or send straight to Screening / Extraction.
                </EmptyState>
              ) : (
                <div className="space-y-2.5 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Citation Dossier · {formatStudyLabel(selected)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className="btn-ghost text-[11px]" onClick={() => go("screening")}>
                        <FolderCheck className="mr-1 inline h-3 w-3" /> Screen
                      </button>
                      <button type="button" className="btn-primary text-[11px]" onClick={() => sendToExtraction(selected)}>
                        <FilePlus2 className="mr-1 inline h-3 w-3" /> {isExtracted(selected) ? "Open in Studies" : "Send to Extraction"}
                      </button>
                      <button type="button" className="btn-ghost text-[11px]" onClick={() => removeCitation(selected.id)} title="Delete reference">
                        <Trash2 className="h-3.5 w-3.5 text-[var(--color-exclude)]" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Title</label>
                    <Input className="h-8 text-[12px]" value={selected.title} onChange={(e) => updateCitation(selected.id, { title: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Authors</label>
                      <Input className="h-8 text-[12px]" placeholder="Smith J; Jones K" value={selected.authors ?? ""} onChange={(e) => updateCitation(selected.id, { authors: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Year</label>
                        <Input className="h-8 text-[12px]" placeholder="2024" value={selected.year ?? ""} onChange={(e) => updateCitation(selected.id, { year: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">PMID</label>
                        <Input className="h-8 text-[12px]" placeholder="12345678" value={selected.pmid ?? ""} onChange={(e) => updateCitation(selected.id, { pmid: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Journal</label>
                      <Input className="h-8 text-[12px]" value={selected.journal ?? ""} onChange={(e) => updateCitation(selected.id, { journal: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">DOI</label>
                      <Input className="h-8 text-[12px]" placeholder="10.1000/..." value={selected.doi ?? ""} onChange={(e) => updateCitation(selected.id, { doi: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Record / Publisher URL</label>
                      <div className="flex gap-1">
                        <Input className="h-8 text-[12px]" placeholder="https://..." value={selected.url ?? ""} onChange={(e) => updateCitation(selected.id, { url: e.target.value })} />
                        {(selected.url || selected.doi || selected.pmid) && (
                          <button
                            type="button"
                            className="btn-ghost shrink-0 px-2"
                            title="Open article online"
                            onClick={() => {
                              const href = selected.url || (selected.doi ? `https://doi.org/${selected.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${selected.pmid}/`);
                              void openExternalUrl(href);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Full-Text PDF Link / File</label>
                      <div className="flex gap-1">
                        <Input className="h-8 text-[12px]" placeholder="https://...pdf or local ref" value={selected.pdfUrl ?? ""} onChange={(e) => updateCitation(selected.id, { pdfUrl: e.target.value })} />
                        {selected.pdfUrl && /^https?:/i.test(selected.pdfUrl) && (
                          <button type="button" className="btn-ghost shrink-0 px-2" title="Open full-text PDF" onClick={() => void openExternalUrl(selected.pdfUrl!)}>
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Tags (comma-separated)</label>
                    <Input
                      className="h-8 text-[12px]"
                      placeholder="RCT, primary-outcome, priority"
                      value={(selected.tags ?? []).join(", ")}
                      onChange={(e) => updateCitation(selected.id, { tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10.5px] uppercase text-[var(--color-text-muted)]">Abstract</label>
                    <Textarea rows={5} value={selected.abstract} onChange={(e) => updateCitation(selected.id, { abstract: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
