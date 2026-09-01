# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.7] - 2026-09-01

### Added
- **Network Meta-Analysis** (NMA): frequentist WLS (Rücker 2012) + Bayesian MCMC with P-score/SUCRA ranking, node-split inconsistency, league matrix, comparison-adjusted funnel.
- **Multilevel / Multivariate / RVE**: three-level meta-analysis (Cheung 2014) with REML variance components, multivariate Gleser-Olkin, cluster-robust RVE with Satterthwaite df.
- **Diagnostic Test Accuracy** (DTA): bivariate Reitsma (2005) model + HSROC, pooled sens/spec with CIs, DOR, AUC, SROC plane.
- **IPD Meta-Analysis**: two-stage + one-stage Cox frailty, proportional hazards test, subgroup × treatment interaction framework.
- **Dose-Response Meta-Analysis**: Greenland-Dennek (1992) two-stage restricted cubic spline + linear trend, E_max parametric with grid-search fit, fitted dose-response curve with 95% CI band.
- **Proportion Meta-Analysis (extended)**: GLMM logit-normal, Freeman-Tukey double-arcsine, Miller back-transformation.
- **Prediction Intervals + Model Averaging**: t-dist prediction intervals (k-2 df), Akaike-weighted model averaging across 6 estimators.
- **Survival Extensions**: RMST meta-analysis with tau sensitivity, IPD reconstruction from published KM curves.
- **Living Systematic Review**: cumulative MA over time, ML priority screening with logistic regression classifier, automated stopping rule.
- **Reporting**: LaTeX manuscript export, interactive HTML report, Python/Stata replication scripts.
- **Collaboration**: project snapshots, diff between versions, restore to any snapshot.
- **Niche MA Types**: Hunter-Schmidt correlations (reliability correction + credibility intervals), variability ratios (CVD), single-case experimental designs (Tau-U), Poisson GLMM for incidence rates, agreement (Cohen's kappa, ICC).
- **Specialized MA**: QoL/Patient-Reported Outcomes (MD/SMD + responder analysis), Economic Evaluation (cost/QALY MD, ICER), Genetics (OR pooling + model selection), Ecology (response ratio lnRR), Education/Psychology (pre-post SMD, Morris 2008), Adverse Events (Peto OR, NNH).
- **Advanced MA**: Prognostic factor/model (logHR, C-statistic, calibration), Qualitative synthesis (code frequency), Bibliometric (co-citation, RPYS), Sequential/TSA (Z-curve, O'Brien-Fleming boundaries, RIS), Decision Curve Analysis (net benefit curve).
- **UI Polish**: OptionsDrawer contrast fix, font size live preview, color blindness modes (protanopia/deuteranopia/tritanopia), dark/light mode schedule, study count limit warnings, duplicate project detection, export preview modal, window size memory, What's New dialog, effect size conversions in Meta, project templates integration, Rayyan/Covidence import, bulk PDF upload, crash reporting, app icon in title bar, telemetry/analytics, Settings page with templates.
- **Logo**: actual app icon rendered everywhere (header, splash, dashboard, installer, dock icon) instead of SVG placeholder.

### Tests
- Engine suite now 67 tests (was 22): +6 NMA, +5 multilevel, +5 DTA, +3 IPD, +2 dose-response, +10 collaboration/niche/advanced, +14 specialized, +13 reporting/collaboration.

## [0.5.3] - 2026-08-26

### Added
- **Theming**: full light + dark themes with a persisted toggle (SwitchButton in the header and workspace drawer). Every surface — pages, charts, canvas line-field, native controls — follows the theme; the dark palette is unchanged from v0.5.2.
- **Navigation**: floating dock replaces the sidebar (magnifying icons with tooltips, active state).
- **Boot experience**: multilingual greeting splash while local services start; optional first-run avatar + name setup stored locally.
- **Command palette** (Ctrl+K): jump to any page or run file actions.
- **Screening**: PRISMA screening funnel chart and a reviewer-count selector (dual-screening support).
- **Meta-Analysis**: shimmer state on the Run button and a live computation panel while the engine works.
- **PRISMA**: live Sankey flow diagram from the recorded numbers; checklist/flow options drawer.
- **Profile menu**: account-style dropdown in the corner carrying profile, appearance, and the app's version/license line.

### Changed
- UI primitives (button/input/card/drawer/dropdown) now token-driven for theming.
- Version constants unified at 0.5.3.

## [0.5.2] - 2026-08-26

### Fixed
- **Windows**: launching poolr no longer flashes a black console window. The engine sidecar (a console-subsystem executable) is now spawned with `CREATE_NO_WINDOW` and its stdio explicitly nulled, so no console is allocated at all.
- **UI**: the sidebar footer showed a hardcoded "v0.4.0" on v0.5.x builds. The version now comes from a single `APP_VERSION` constant shared by the footer and copyright line.
- **UI**: the connection indicator could stay stuck on "offline" after launch — the single 1.5 s health probe lost the race against the self-contained engine's cold start. The shell now polls with backoff until the engine answers.
- **Frontend**: failing to load the bundled demo project now shows an error banner instead of failing silently.

### Changed
- Version constants unified at 0.5.2 (engine /health, /version, tauri.conf.json, package.json, Cargo.toml); generated R-replication scripts and methods paragraphs cite 0.5.2.

## [0.5.1] - 2026-08-25

### Added
- **Engine**: Knapp-Hartung(-Sidik-Jonman) CI adjustment; Mantel-Haenszel (RBG variance) and Peto one-step OR poolers; leave-one-out + cumulative + fixed-vs-random sensitivity pack; computed Duval-Tweedie trim-and-fill; Peters & Harbord regression tests; PET/PEESE; p-curve right/left-skew tests; Henmi-Copas limit meta-analysis; experimental step-function selection model (3PSM); Rosenthal & Orwin fail-safe N; H² and I² 95% CI (noncentral chi-square); subgroup Q-between interaction test with per-group heterogeneity; new outcome types — single-arm proportions (logit/arcsine), incidence rates (IRR/IRD), correlations (Fisher z), generic inverse-variance, Glass's delta; effect-size conversion endpoint incl. Wan-2014 median→mean/SD.
- **Figures**: contour-enhanced funnel, Galbraith/radial, L'Abbe, Baujat, robvis-style RoB traffic-light and weighted summary-bar plots.
- **GRADE**: Summary-of-Findings generator (markdown + structured rows) with OIS-based imprecision assessment.
- **Export**: R/metafor replication-script generator, BibTeX/RIS citation export, methods-section paragraph generator.
- **Frontend**: extended measure list + Knapp-Hartung toggle on Meta page; leave-one-out table with influence highlighting; I²-CI/H² tiles; Q-between display; contour-funnel card; structured exclusion-reason dropdown in Screening; automatic import de-duplication (PMID/DOI/title) with duplicate counts; ROBINS-I/QUADAS-2/AMSTAR-2 tools on Risk-of-Bias page; PRISMA 27-item checklist tracker; bundled BCG demo project with one-click loader.
- **Tests**: xUnit benchmarks validating MH/Peto against metafor's published dat.bcg results; engine suite now 22 tests.

### Changed
- Version constants unified at 0.5.1 (engine /health, /version, tauri.conf.json, package.json, Cargo.toml).
- Meta-Analysis page now calls the extended /api/meta2 endpoint; legacy /api/meta remains byte-compatible for automation.

## [0.5.0] - 2026-08-24

### Added
- **Bklit UI charts** (visx + motion, shadcn-registry components) themed to poolr's monochrome palette: animated screening-progress rings + I² heterogeneity gauge on the Dashboard, per-study weight rings on Meta-Analysis, and a RoB domain-coverage radar chart.
- **Frontend unit tests** (Vitest, 38 tests): citation-import parsers (MEDLINE/RIS/EndNote/CSV detection + parsing) and the engine API bridge (health, postJson, offline/timeout errors). Wired into CI.
- Issue templates (bug report, feature request) and a PR template with the local-checks checklist.
- README: real app screenshots, feature comparison table (poolr vs RevMan vs R metafor vs JASP), updated structure/testing docs.

### Changed
- **CI hardened — every gate now fails the build**: removed the `|| true` bypass on `dotnet format --verify-no-changes`; added oxlint, Vitest, `cargo fmt --check`, and `cargo clippy -- -D warnings` jobs; the .NET vulnerability scan now exits non-zero on findings.
- **LICENSE is now pure MIT** — removed the contradictory "no copying without written permission" footer that made GitHub classify the repo as "Other".
- Rust shell identity: crate renamed `app` → `poolr`, real repository/homepage metadata, professional bundle descriptions.

### Fixed
- CSV citation import: header-less files whose first row contained the word "abstract" lost their first record (fuzzy header detection now requires short, header-like cells).
- Rust: replaced undefined-behaviour `static mut` JobObject handle with a safe `OnceLock`; removed unused import (clippy `-D warnings` clean).
- C# engine whitespace formatting (format gate now enforced in CI).

## [0.4.0] - 2026-08-02

### Added
- **Native desktop overhaul**: Tauri 2 (Rust) shell + React/TypeScript UI + C# 12 / .NET 8 engine sidecar. **100% Python-free** — no Python in the product or the repo.
- All 8 pages reimplemented in React (Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta-Analysis, PRISMA).
- C# meta-analysis engine: OR/RR/RD/MD/SMD/HR, fixed + random-effects (DL/REML/PM/HS/ML/EB), Cochran Q, I², τ², Egger/Begg publication bias, subgroup analysis — guarded by the `engine/Poolr.Engine.Tests` xUnit suite.
- In-app SVG forest + funnel plots (SkiaSharp).
- Screening import: PubMed MEDLINE, CSV, RIS/.nbib, EndNote parsers.
- Auto-GRADE evidence profile on the PRISMA page.
- Word (.docx)/Markdown/LaTeX/JSON export with a pre-export copyright confirmation.
- MIT license + © 2026 M. Haris Awan copyright embedded in installers/footer/disclaimer.
- 6-OS native installer matrix (MSI/NSIS win x64/x86/arm64, DMG mac x64/arm64, deb/rpm linux x64); WebView2 fixed runtime bundled on Windows.

### Changed
- Persistence: atomic auto-save to `poolr.json` with rolling `.bak` restore; load-on-start; force-close safe.
- Engine bridge uses a localhost HTTP API; UI is offline-aware.

### Fixed
- Screening selection now tracked by record id (not list index) so filter/import/decision changes can't repoint selection at the wrong record.

## [0.3.2] - 2026-07-31

### Fixed
- **Critical**: page navigation crashed with `TclError: bad window path name` when revisiting any page — `_select_page` destroyed cached page widgets while keeping them in the page cache. Pages are now hidden with `pack_forget()` and stale cache entries rebuilt. Verified against the packaged v0.3.1 Windows exe where the bug reproduced.
- **Critical (CI)**: PRISMA page auto-generation popped a blocking modal in `on_enter`, which hung the headless xvfb GUI smoke test indefinitely (PR #10 CI cancelled). `on_enter` now runs non-interactively; only user-initiated button clicks show popups.
- Meta-analysis significance test now uses the correct null value per effect measure (ratio measures OR/RR/HR → null 1; difference measures MD/SMD/RD → null 0) instead of hardcoding 1, which mislabeled MD/SMD/HR results as significant/non-significant. The redundant "Analysis Complete" modal was replaced with a status-bar hint for a more responsive UI.
- Build: macOS DMG is now named per-architecture (`poolr-x64.dmg` / `poolr-arm64.dmg`) so the x64 and arm64 matrix legs no longer overwrite each other — both architecture artifacts are now actually published.
- About dialog showed hardcoded `v0.3.0` — now reads `__version__`

### Added
- GUI smoke test now includes a page-switching regression test (2 full navigation rounds across all 8 pages); confirmed to fail on the old code and pass on the fix

## [0.3.1] - 2026-07-31

### Added
- Window title now displays the running version (e.g. `poolr v0.3.1`)
- Tagged releases (`v*`) now publish real (non-draft) GitHub Releases with per-platform zip assets; pushes to `develop` keep publishing the draft Nightly Build

### Changed
- CI release job packages one zip archive per platform before upload

### Fixed
- 8 runtime bugs from the full debug pass (v0.3.0 post-release hardening)
- CLI entrypoint (`poolr-cli`) and headless GUI smoke test
- Release job permissions (`contents: write`) so CI can publish releases
- Stopped tracking `dist/poolr.exe` build artifact in git

## [0.3.0] - 2026-07-30

### Added
- Initial project structure with modular architecture
- GUI with 8-phase SRMA workflow (Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta, PRISMA)
- Advanced meta-analysis engine supporting OR, RR, RD, MD, SMD, HR
- Random-effects (DL, REML, PM, HS, SJ, ML, EB) and fixed-effect models
- Subgroup analysis and meta-regression
- Publication bias tests (Egger, Begg)
- Forest plots and funnel plots with SVG/PNG/PDF export
- PRISMA 2020 checklist and flow diagram generator
- GRADE evidence profiling with auto-population
- Word (.docx) and LaTeX (.tex) manuscript export
- RIS import/export for EndNote/Zotero/Mendeley
- PubMed direct import via NCBI Entrez API
- Dual independent screening with conflict resolution
- Cross-platform installers (Windows, macOS, Linux)

## [0.1.0] - 2026-07-30

### Added
- Initial proof-of-concept release
- Basic GUI with sidebar navigation
- PICO definition and protocol metadata
- Search strategy builder for 5 databases
- Title/abstract and full-text screening
- Data extraction forms
- RoB 2, NOS, PROBAST assessments
- Basic meta-analysis (OR only, DerSimonian-Laird)
- PRISMA checklist (manual only)
- JSON project persistence

---

## Release Template

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features

### Security
- Security improvements
