# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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



### Added
- Shared UI style kit (`src/poolr/ui.py`, legacy Python/CustomTkinter app): dark palette, typography helpers, `SectionHeader`, `Card`, `StatTile`, branded `PrimaryButton`/`SecondaryButton` (override-safe colors), and a scrollable-helper — all headless-safe (no display access, no blocking dialogs).

### Changed
- **Premium UI refresh**: redesigned app shell with a branded sidebar (hover + active-state), a header bar showing the current section, and a persistent bottom status bar with version + quick actions.
- Dashboard restyled with KPI tiles (studies, included/excluded, RoB, meta status) and quick-action cards.
- All 8 pages (Protocol, Search, Screening, Extraction, RoB, Meta-Analysis, PRISMA, Dashboard) restyled to a consistent `SectionHeader` + branded primary/secondary buttons, tighter spacing, and themed borders/inputs — page logic and contracts preserved.
- Screening decision buttons are now color-coded (Include / Exclude / Unsure) for faster, clearer judgment.

### Fixed
- Dashboard no longer raises `AttributeError` on project load — the app shell now sets `project_name` (was missing).

## [0.3.2] - 2026-07-31

### Fixed
- **Critical**: page navigation crashed with `TclError: bad window path name` when revisiting any page (Dashboard/Protocol/Search/etc.) — `_select_page` destroyed cached page widgets while keeping them in the page cache. Pages are now hidden with `pack_forget()` and stale cache entries rebuilt. Verified against the packaged v0.3.1 Windows exe where the bug reproduced.
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