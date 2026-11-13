# Poolr guided review specification

The local build includes an isolated BCG practice copy with nine workspace steps, back and next navigation, local resume, reset, and exit. The validation and instructional work below describe the full guide.

## Entry points and workspace

Learn opens a practice review library. Start practice creates a dedicated local copy with a new project ID. Resume opens that copy and restores the last checkpoint. Inspect completed review opens a separate read-only reference. Exit returns to the user's previous review. Reset asks before replacing practice progress. Practice copies are clearly labeled on screen and in exports. They must never overwrite a working review or sync to a team automatically.

Show the guide beside the real screen on wide windows and in a collapsible panel on narrow ones. Keep the highlighted control visible and reachable by keyboard. Each step includes the task, expected result, check, optional hint, and a worked explanation. Next advances the guide. Back revisits instructions without rolling back data. Skip records a skipped checkpoint. Progress stays with the practice copy. A disconnected engine should leave the lesson readable and make the blocked action clear.

## Control walkthrough

| Screen | Controls and decisions to teach | What the exercise checks |
|---|---|---|
| Dashboard and project bar | New, Open, Save, Recover draft, Continue, metric cards, command palette, Export | Learner can distinguish the practice copy from their own review and find each stage. |
| Protocol | Title, objective, PICO, eligibility, research discovery, registration, PROSPERO record link | Fields and decisions survive reopening. A training record is clearly labeled. |
| Literature Search | Database and sort, query, PICO and MeSH, field tags, filters, Search Details, page navigation, cancel, history, exports | Query and translated terms match the recorded strategy. Partial retrieval stays visible. |
| Registries and other sources | ClinicalTrials.gov condition and status filters, PROSPERO topic and CRD lookup, OpenAlex and Crossref, external sources and strategy export | Explain what each source indexes and keep review registrations separate from included study records. |
| Import and screening | Select page, import fetched or selected, duplicate preview, status filters, include/exclude/unsure, full-text promotion, reviewer disagreement, exclusion reasons, AI suggestions | Importing twice retains one record and preserves decisions. Counts distinguish records, reports and studies. |
| Extraction | Add and remove, CSV import/export, effect calculator, arm values, units and timepoints, AI extraction review | Check against source tables. Catch an intentionally swapped arm and a repeated report. |
| Risk of bias | Tool, study and domain selection, evidence and judgment, chart, delete confirmation | Require a rationale for a judgment and keep AI suggestions distinct from reviewer decisions. |
| Analysis | Pairwise inputs, run, study weights, forest plot, effect direction, model, uncertainty, sensitivity, save and export | Reproduce reference output for a declared effect scale and estimator. Include a case where pooling is inappropriate. |
| Other methods | Method search, grouped pages, required data, run controls and outputs | Separate optional exercises per method. Verify every advertised route, disable unavailable paths and identify examples before any run. |
| PRISMA and certainty | Search appendix, counts, flow, checklist, Summary of Findings, manuscript/export | Reconcile counts and trace each estimate, table and figure to the analysis revision. |
| Team, Drive Sync and Settings | Identity, team switch, local vs shared copy, appearance, provider setup, and updates | Keep practice offline by default. Use explicit opt-in for live provider or storage exercises. |
| Learn | Start, resume, inspect answer, hint, check, skip, reset and exit | Test keyboard flow, compact layout, restart/resume, and a complete run with no real project changes. |

## Dataset and editorial work

Audit the existing BCG preview before reusing it. Its screening, full-text, extracted-study and PRISMA counts currently describe different sets. Build a traceable fixture linking citation records, reports, source excerpts, study IDs, decisions and extracted values. Record fixture origins and distinguish fixed teaching data from changing live search results. Benchmark the quantitative exercise independently against a published reference and retain the expected result and tolerance.

Research and review the instructional content before release. Draft the manual calculations, worked explanations, non-pooling case, answer key, source citations and assessment rubric with a methods reviewer. Link each chapter to the relevant Cochrane methods guidance and PRISMA reporting item. Keep a faculty facilitator guide and a separate assessment dataset as later deliverables.

## Search follow-up

Save a structured per-database strategy and provenance for every run. Expand trial filters with validated registry fields, add DOI and PMID lookup and query assistance, then add resumable retrieval and an explicit completeness check for large PubMed sets. Verify imports against duplicate identifiers and preserve existing decisions. For any new provider, require documented access and test a real search, pagination, failures, import and replay before advertising in-app results. PROSPERO currently uses the public website search endpoint. Verify its contract before changes and keep the external search and copy controls available. Google Scholar uses its public advanced-search form.
