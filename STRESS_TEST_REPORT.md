# Poolr v0.6.1 Stress Test Report

**Date:** 2026-09-16  
**Version tested:** v0.6.1 (GitHub `harisawan-bit/poolr`, commit `main`)  
**Engine version in csproj:** `0.5.7` (MISMATCH - app reports `0.6.1`)  
**Test environment:** Windows 11, .NET 8.0.408, 214 unit tests all passing

---

## Summary

| Category | Count |
|----------|-------|
| Total tests run | 117 |
| Passed | 48 |
| Failed (real bugs) | 6 |
| Failed (test data mismatch) | 63 |
| **Real bugs found** | **6** |

---

## REAL BUGS (require code fixes)

### BUG-1: NullReferenceException in DiagnosticFigures.Galbraith()
- **Endpoint:** `POST /api/figure/galbraith`
- **Error:** `System.NullReferenceException: Object reference not set to an instance of an object.`
- **Location:** `DiagnosticFigures.cs` line ~70: `d.Names[i]` accessed when `d.Names` is null
- **Root cause:** `PlotInput` record has `List<string> Names` but the code doesn't guard against null Names
- **Repro:** Send `{ measure: "OR", effs: [...], vars: [...] }` without `names` field
- **Fix needed:** Add null check or default empty list for Names

### BUG-2: NullReferenceException in DiagnosticFigures.Baujat()
- **Endpoint:** `POST /api/figure/baujat`
- **Error:** Same as BUG-1
- **Location:** `DiagnosticFigures.cs` line ~120: `d.Names[i]` in Baujat method
- **Root cause:** Same missing guard
- **Repro:** Send Baujat request without names array
- **Fix needed:** Same as BUG-1

### BUG-3: IndexOutOfRangeException in ClusterDetectionEngine
- **Endpoint:** `POST /api/cluster/detect`
- **Error:** `Index was out of range. Must be non-negative and less than the size of the collection.`
- **Location:** `ClusterDetectionEngine.cs` ~line 75: `ses[i]` when `ses` count < `effects` count
- **Root cause:** `ses` is built from `req.variances.Select(Math.Sqrt)` but the code uses `req.effects.Count` for the loop. If `variances` is null/empty, `ses` is empty but loop still iterates over `effects.Count` items
- **Repro:** Send `{ effects: [7 items], ses: [7 items] }` but engine expects `variances` not `ses` — so variances is empty
- **Fix needed:** Validate that variances count matches effects count before processing

### BUG-4: IndexOutOfRangeException in LeagueMatrixEngine
- **Endpoint:** `POST /api/figure/league-matrix`
- **Error:** `Index was out of range.`
- **Location:** `BubbleLeagueEngine.cs` ~line 233: `matrix[i][j]` when matrix is empty/default
- **Root cause:** When request JSON doesn't match `LeagueMatrixRequest` shape (missing `matrix` property), `req.matrix` defaults to empty list. Code tries to access `matrix[i][j]` on it.
- **Repro:** Send request without proper 2D matrix structure
- **Fix needed:** Add null/empty validation for matrix before access

### BUG-5: Arithmetic Overflow in MultilevelNmaEngine
- **Endpoint:** `POST /api/nma/multilevel`
- **Error:** `Arithmetic operation resulted in an overflow.`
- **Location:** `MultilevelHsrocEngine.cs` matrix operations
- **Root cause:** With only 1 study / 1 comparison, the design matrix `X` has dimensions that cause numerical overflow in `SolveLinear()` — likely divide-by-zero or near-singular matrix
- **Repro:** Send single-study request
- **Fix needed:** Add minimum study count validation before matrix decomposition

### BUG-6: Arithmetic Overflow in MultiArmNmaEngine
- **Endpoint:** `POST /api/nma/multiarm`
- **Error:** `Arithmetic operation resulted in an overflow.`
- **Location:** `MultiArmQualitativeEngine.cs` matrix operations
- **Root cause:** Same as BUG-5 — insufficient data for matrix operations
- **Repro:** Send single-study request
- **Repro:** Add minimum study count validation

---

## NON-BUG FINDINGS (correct behavior, test data issues)

These returned HTTP 400 with clear error messages — working as intended:

| Endpoint | Error | Reason |
|----------|-------|--------|
| `/api/meta` | `No data provided` | Empty data array — correct rejection |
| `/api/meta` | `Invalid method 'SJ'` | SJ not in engine's supported list (DL/REML/PM/HS/EB/ML only) |
| `/api/meta` | `Invalid effect measure 'AS'` | AS not supported (OR/RR/RD only for binary) |
| `/api/dose` | `At least 2 studies with 2+ dose categories` | Correct validation |
| `/api/ipd` | JSON parse error | IpdStudy.events is `int?`, test sent array |
| `/api/dta` | JSON parse error | Test sent wrong field names |
| `/api/proportion` | JSON parse error | Test sent `events`/`n` as int, engine expects `int?` |
| `/api/bayesian` | `At least 2 studies required` | Correct validation |
| `/api/bootstrap` | `At least 2 studies required` | Correct validation |
| `/api/influence` | `At least 3 studies required` | Correct validation |
| `/api/permutation` | `At least 2 studies required` | Correct validation |
| `/api/gosh` | `At least 3 studies required for GOSH` | Correct validation |
| `/api/multilevel` | JSON parse error | Wrong request shape |
| `/api/prediction` | JSON parse error | Wrong request shape |
| `/api/modelaverage` | `At least 2 studies required` | Correct validation |
| `/api/niche/correlation` | JSON parse error | Wrong field names |
| `/api/niche/sced` | `At least 2 valid studies required` | Correct validation |
| `/api/specialized/genetic` | `At least 2 valid studies required` | Correct validation |
| `/api/specialized/adverse` | `At least 2 valid studies required` | Correct validation |
| `/api/advanced/prognostic` | `At least 2 valid studies required` | Correct validation |
| `/api/advanced/dca` | `At least 2 valid studies required` | Correct validation |
| `/api/report/latex` | JSON parse error | ManuscriptRequest has different fields (authors is string, not array; needs studies/participants/etc.) |
| `/api/deduplicate` | JSON parse error | Citation.Year is `string`, test sent `int` |
| `/api/pvalue/combine` | `At least 2 p-values required` | Correct validation |
| `/api/time-series` | `At least 3 studies required` | Correct validation |
| `/api/figure/bubble` | `At least 3 studies required` | Correct validation |
| `/api/prisma-dta` | JSON parse error | Wrong request shape |
| `/api/bucher` | `Both arms must have effect estimates` | Correct validation |
| `/api/cnma` | JSON parse error | Wrong request shape |
| `/api/scr/flow` | JSON parse error | Wrong request shape |
| `/api/spatiotemporal` | JSON parse error | Wrong request shape |
| `/api/response-surface` | `At least 3 valid studies required` | Correct validation |
| `/api/amstar-2` | JSON parse error | Wrong request shape |
| `/api/grade/evidence-profile` | JSON parse error | Wrong request shape |
| `/api/sucra` | JSON parse error | SucraRequest has different structure |
| `/api/dta/dor-forest` | JSON parse error | Wrong request shape |
| `/api/clusterrobust/egger` | `Cluster-robust Egger requires at least 5 studies` | Correct validation |
| `/api/powerhouse/pvalue-combine` | `At least 2 valid p-values required` | Correct validation |
| `/api/bayesian-multilevel` | `At least 3 studies required` | Correct validation |
| `/api/bayesian-dta` | `At least 2 valid studies required` | Correct validation |
| `/api/bayesian-prognostic` | `At least 3 studies required` | Correct validation |
| `/api/qualitative/synthesis` | `At least 2 studies required` | Correct validation |
| `/api/profile-likelihood` | `At least 2 studies required` | Correct validation |
| `/api/tes` | `At least 3 studies required for TES` | Correct validation |
| `/api/locationscale` | `At least 3 studies required` | Correct validation |
| `/api/mi` | `At least 2 complete studies required` | Correct validation |
| `/api/rcs` | `At least 4 dose-response points required` | Correct validation |
| `/api/clusterrobust` | `At least 2 effects required` | Correct validation |
| `/api/prognostic/meta` | `Insufficient valid studies for measure 'c-statistic'` | Correct validation |
| `/api/dta/bivariate` | `Insufficient valid studies with sensitivity and specificity` | Correct validation |
| `/api/dta/hsroc` | `HSROC requires at least 3 studies` | Correct validation |
| `/api/competing-risks` | `At least 2 studies required for each outcome` | Correct validation |
| `/api/qualitative/meta` | JSON parse error | Wrong request shape |
| `/api/bayesian-nma` | `At least two studies required for Bayesian NMA` | Correct validation |
| `/api/ipd/from-km` | `At least 2 KM points required` | Correct validation |
| `/api/rve` | `At least 2 effects required` | Correct validation |
| `/api/grade/sof-table` | JSON parse error | Wrong request shape |
| `/api/nma/regression` | `At least 3 studies required` | Correct validation |
| `/api/bma` | `At least 3 studies required for BMMA` | Correct validation |
| `/api/phylo` | `At least 3 studies required` | Correct validation |
| `/api/dose/multivariate` | `At least 2 studies with 2+ outcomes required` | Correct validation |

---

## WORKING ENDPOINTS (48 tests passed)

| Endpoint | Test |
|----------|------|
| `GET /health` | Health check |
| `POST /api/meta` | BCG dataset, single study, zero cells, continuous MD, survival HR, Knapp-Hartung, subgroups, sensitivity |
| `POST /api/meta2` | Extended meta-analysis |
| `POST /api/figure/forest` | Forest plot SVG |
| `POST /api/figure/funnel` | Funnel plot SVG |
| `POST /api/figure/galbaujat_baujat` | (only when names provided) |
| `POST /api/figure/labbe` | L'Abbe plot SVG |
| `POST /api/figure/funnel_contour` | Contour-enhanced funnel SVG |
| `POST /api/export` | JSON, Markdown, LaTeX, DOCX |
| `POST /api/grade/sof` | GRADE Summary of Findings |
| `POST /api/grade` | GRADE evaluation |
| `POST /api/nma` | Network meta-analysis |
| `POST /api/proportion` | Proportion meta-analysis |
| `POST /api/living/cumulative` | Living systematic review |
| `POST /api/collaboration/snapshot` | Snapshot creation |
| `POST /api/collaboration/snapshot` | Snapshot listing |
| `POST /api/report/html` | HTML report |
| `POST /api/report/python` | Python replication |
| `POST /api/report/stata` | Stata replication |
| `POST /api/revman/export` | RevMan CSV export |
| `POST /api/rob2` | Risk of Bias 2 |
| `POST /api/robins-i` | ROBINS-I |
| `POST /api/quadas-2` | QUADAS-2 |
| `POST /api/nos` | Newcastle-Ottawa Scale |
| `POST /api/nma/graph` | Network graph SVG |
| `POST /api/citation/network` | Citation network analysis |
| `POST /api/mcmc/diagnostics` | MCMC diagnostics |
| `POST /api/zotero/connect` | Zotero stub |
| `POST /api/mendeley/connect` | Mendeley stub |
| `POST /api/project/save` | Project persistence |
| `POST /api/project/load` | Project loading |
| `POST /api/export/r_code` | R replication code |
| `POST /api/export/citations` | BibTeX export |
| `POST /api/export/methods` | Methods paragraph |
| `POST /api/figure/rob_traffic` | RoB traffic light |
| `POST /api/figure/rob_summary` | RoB summary bar |
| `POST /api/figure/cumulative-forest` | Cumulative forest |
| `POST /api/living/automate` | Living review automation |
| `POST /api/umbrella` | Umbrella review |
| `POST /api/deduplicate` | (with correct data types) |
| `POST /api/ai/screening` | AI screening stub |
| `POST /api/meta` | 100-study stress test |
| `POST /api/meta` | Extreme values |
| `POST /api/meta` | Missing fields (graceful) |
| `POST /api/meta` | Invalid measure (graceful) |
| `POST /api/meta` | Invalid model (graceful) |
| `POST /api/sucra` | SUCRA ranking |

---

## ADDITIONAL OBSERVATIONS

### Version Mismatch
- `Poolr.Engine.Api/Poolr.Engine.Api.csproj`: `<Version>0.5.7</Version>`
- App reports: `{"version":"0.6.1"}` (hardcoded in `Program.cs`)
- Should be updated to `0.6.1` in csproj

### Compilation Warnings
33 warnings — all `CS8629: Nullable value type may be null` in:
- `BayesianNmaUmbrellaEngine.cs` (lines 94-95, 507-510)
- `AdvancedBayesianEngines.cs` (lines 241-244)
- `CitationBucherCnmaEngine.cs` (lines 394-395)
- `GradeQualityEngines.cs` (lines 651, 666)
- `MultilevelHsrocEngine.cs` (lines 92-93, 282-283, 400-406)
- `MultivariateNmaGradeEngine.cs` (lines 290-291)
- `PrognosticBivariateEngine.cs` (lines 87-90)

### Architecture Note
The HTTP 500 errors (BUG-1 through BUG-6) all return raw ASP.NET exception messages to the client. In production this leaks stack traces. Consider:
1. Adding the guard checks listed above
2. Ensuring the global exception handler returns sanitized error messages in production (the `app.Environment.IsDevelopment()` check is missing)

---

## RECOMMENDED FIX ORDER

1. **BUG-1 + BUG-2:** Add `d.Names ??= new List<string>()` guard in both Galbraith and Baujat — 1 line each
2. **BUG-3:** Add `if (req.variances?.Count != req.effects.Count) throw` in ClusterDetectionEngine — 1 line
3. **BUG-4:** Add null/empty matrix validation in LeagueMatrixEngine — 1 line
4. **BUG-5 + BUG-6:** Add minimum study count check (≥ 2) in both NMA engines — 1 line each
5. **Version bump:** Update `Poolr.Engine.Api.csproj` to `0.6.1` to match
