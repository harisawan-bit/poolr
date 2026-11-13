# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.6] - 2026-11-13

### Added
- **Unified Research Pipeline & Navigation Stepper**: Sticky 8-stage top pipeline bar linking `Protocol` → `Search & Citations` → `Screening` → `Extraction` → `Risk of Bias` → `Synthesis` → `PRISMA 2020` → `Manuscript` with live study counts and completion state.
- **Reference & Citation Manager (`CitationManager.tsx`)**: Central searchable bibliographic library supporting PubMed Summary/Abstract, PMID lists, MEDLINE/NBIB, RIS, EndNote, Rayyan CSV, Covidence CSV, BibTeX, and manual references with editable dossiers, PDF URL attachment, and 1-click handoff to Extraction.
- **Source Provenance Viewer (`StudySourceViewer.tsx`)**: Highlight-to-field provenance viewer in Extraction and Risk of Bias linking abstracts, attached study text/PDF excerpts, and quotes directly to extracted values and RoB domain rationales.
- **Risk-of-Bias Integrated Forest Matrix & Interactive Funnel**: `ForestStudyMatrix` displays RoB 2 traffic-light domain ratings alongside study weights inside Meta-Analysis; Interactive Funnel plots support clicking any point to inspect study details and jump directly to Extraction/RoB.
- **PRISMA 2020 Structured Box Flow Diagram**: Official Page et al. box-style PRISMA 2020 SVG diagram alongside Sankey mode, driven by live exclusion reason tags and Search/Screening counts.
- **Unified Analysis Hub (`AnalysisHub.tsx`)**: Combined classical pairwise, Bayesian MCMC, Network Meta-Analysis, DTA, Survival/IPD, Dose-Response, Qualitative Synthesis, and Figure/Reporting views into a single searchable workspace with `MetaWorkbench`.
- **Visual System & WCAG Contrast Overhaul**: Redesigned editorial light/dark theme tokens, readable button states, accessible label wrapping, and refreshed v0.6.6 screenshots.

### Fixed
- **Trial Sequential Analysis (TSA) Engine Payload**: Fixed `Meta.tsx`, `useMetaAnalysis.ts`, and `ComplexDataHub.tsx` sending floating-point `informationFraction` or mismatched field names to `/api/advanced/sequential` (`Int32` validation failure -> HTTP 400).
- **Version Alignment & Profile Defaults**: Unified version `0.6.6` across root, frontend (`APP_VERSION`, `project.ts`, `Legal.tsx`), Tauri (`tauri.conf.json`, `Cargo.toml`), and C# engine (`Poolr.Engine.Api.csproj`, `Program.cs`).

## [0.6.5] - 2026-11-04

### Added
- **Signed Updater Trust Root & Multi-OS Releases**: Established persistent Tauri updater signing key (`C1C149B7917EDEF0`) with signed installers across Windows (`x64`, `x86`, `arm64`), macOS (`aarch64`, `x64`), and Linux (`.AppImage`, `.deb`, `.rpm`). See [UPDATER_SIGNING.md](docs/UPDATER_SIGNING.md).
- **Multi-Format PubMed Importer, Reactive Screening & Continuous Extraction**: Added multi-format PubMed/PMID parsers, reactive dual-screening badges, continuous study `Int. n` / `Ctrl n` fields, AI statistical interpretation routing, and mode preservation across reopen/save cycles.

## [0.6.4] - 2026-11-03

### Added
- **Workspace Redesign & Native Drive BYOS Collaboration**: Replaced hosted sync prototype with native `rclone` transport, encrypted P-256 ECDSA identity vault, owner-signed membership epoch chains, append-only revisions, conflict resolution UI, and project-backed manuscript checkpoints. See [RELEASE_0.6.4.md](docs/RELEASE_0.6.4.md).

### Fixed
- **Linux Wayland/Mesa AppImage Packaging**: Excluded incompatible bundled host display libraries via Tauri CLI >= 2.12.1 and enforced CI AppImage checks (`scripts/check-appimage.py`).

## [0.6.3] - 2026-09-18

### Added
- **Google OAuth & Identity Resolution**: Prominent Google Sign-in across UI header, onboarding screen, and profile dropdown. Real token exchange via Google Identity Services (GIS) and Bearer auth against `/oauth2/v3/userinfo` for robust avatar and profile synchronization.
- **Organized Google Drive BYOS (Bring-Your-Own-Storage)**: Clean folder hierarchy (`My Drive/Poolr Workspace/Projects/{Title}_{UUID}/`), RFC 2387 multipart MIME uploads for create/update without payload truncation, and automated subfile sync (`changelog.json`, `permissions.json`, `comments.json`, `authorship.json`, `manuscript.json`).
- **Team Sharing & Collaboration**: Direct Google Drive Permissions API integration to share reviews with collaborators (`writer`, `commenter`, `reader`), plus shared review discovery (`sharedWithMe`).
- **Role-Based Access Control (RBAC)**: 4-tier team governance (`Owner`, `Lead Methodologist / Editor`, `Reviewer`, `Auditor / Viewer`) enforcing access boundaries across Protocol, Screening, Extraction, Risk of Bias, Meta-Analysis, and Export.
- **Concurrent Edit Protection & Audit Trail**: Real-time section soft locks preventing simultaneous overwrite collisions, append-only delta change logging (`ChangeDelta`) for PRISMA 2020 / Cochrane compliance, and an interactive 3-way visual conflict resolution modal (`ConflictResolverModal`).
- **Step-Level Commenting Drawer**: Reusable inline discussion drawer (`StepCommentsDrawer` / `StepCommentsButton`) mounted on all review step headers (Protocol, Screening, Extraction, Risk of Bias, Meta-Analysis, Manuscript).
- **ICMJE & CRediT Authorship Tracking**: Automatic active-time monitoring per contributor and review section, providing an audit-grade authorship table exportable to Markdown.
- **Collaborative Manuscript Studio**: Dedicated manuscript workstation (`ManuscriptHelper`) with live Markdown editing, formatting toolbar, data/citation insertion from review phases, contributor assignment, and multi-format exports (.md, .doc, PDF).

### Fixed
- **Windows WebView2 Transparent Window Bug**: Resolved white screen / flicker on startup by disabling window transparency in `tauri.conf.json` and declaring solid fallback background color on `html`, `body`, and `#root`.
- **Google OAuth Token Decoding**: Fixed invalid JWT decoding attempts on opaque Google access tokens (`ya29...`) by querying Google's userinfo endpoint.
- **Drive Update Data Loss**: Fixed upload bug in `drive-sync.ts` where updating existing files sent only metadata and dropped file content.
- **In-App Navigation & Project Loading**: Connected dead DOM event bus (`poolr:gopage` and `poolr:loadProject`) in `App.tsx` for seamless routing without page reloads.

### Legal & Commercial
- **Proprietary License Update**: Closed-source proprietary EULA for `Muhammad Haris Awan (d/b/a The Method Lab)` featuring corporate successor assignment, unilateral rights to introduce paid subscription plans/paywalls without grandfathering, BYOS storage disclaimers, and medical evidence synthesis disclaimers.

## [0.6.2] - 2026-09-17

## [0.6.1] - 2026-09-15

### Added
- **Multi-Study Support**: Added `StudyManager` with localStorage persistence and interactive `StudySelector` to effortlessly switch between active systematic reviews.
- **AnalysisHub (34+ Specialized Engines)**: Tabbed workspace integrating Bayesian MCMC, GOSH diagnostics, Permutation tests, Bootstrap CIs, Test of Excess Significance (TES), RevMan 5 bidirectional import/export, and reference manager sync (Zotero/Mendeley).
- **Quality Assessment Workflows**: Added dedicated interfaces and backend engines for RoB 2, ROBINS-I, QUADAS-2, AMSTAR-2, Newcastle-Ottawa Scale (NOS), and GRADE Evidence Profiles.
- **Statistical Parity Suite**: Expanded xUnit regression benchmark tests to 226 tests covering all new engines with zero failures.

### Fixed
- Code formatting across .NET engines enforcing zero-warning standards.
- Clean TypeScript and React 19 build across all analysis pages and components.

## [0.6.0] - 2026-09-09

### Fixed
- **Import parsers (critical)**: MEDLINE/RIS/EndNote parsers now split on 2+ consecutive newlines instead of whitespace lines
- **PubMed search**: Replaced inline efetch parser with shared `parseMedline`
- **Blocking dialogs eliminated**: All `alert()`/`confirm()`/`prompt()` calls replaced with inline banners
- **React stability**: Fixed stale closure in Meta.tsx auto-run; stabilized render-unstable arrays via `useRef`
- **Grey Literature**: Replaced mock data with real Google Scholar/ClinicalTrials.gov/OpenAlex API calls

## [0.5.3] - 2026-08-26

### Added
- Theming, navigation floating dock, boot experience, command palette, screening PRISMA chart, meta-analysis live computation, profile menu

### Changed
- UI primitives token-driven, version unified at 0.5.3

## [0.5.2] - 2026-08-26

### Fixed
- Windows console window flash eliminated, version display fixed, connection indicator polling, demo project error handling

### Changed
- Version unified at 0.5.2

## [0.5.1] - 2026-08-25

### Added
- Knapp-Hartung CI adjustment, Mantel-Haenszel/Peto poolers, sensitivity pack, trim-and-fill, publication bias tests, p-curve, fail-safe N, H²/I² CI, subgroup Q-between, new outcome types, effect-size conversions
- Figures: contour-enhanced funnel, Galbraith, L'Abbé, Baujat, robvis RoB plots
- GRADE Summary-of-Findings, export suite, expanded frontend features

### Changed
- Version unified at 0.5.1

## [0.5.0] - 2026-08-24

### Added
- Bklit UI charts, frontend unit tests, issue/PR templates, README overhaul

### Changed
- CI hardened (all gates fail build), LICENSE pure MIT, Rust shell identity

### Fixed
- CSV citation import header detection, Rust unsafe static mut, C# formatting

## [0.4.0] - 2026-08-02

### Added
- Native desktop overhaul (Tauri 2 + React/TypeScript + C# .NET 8 engine sidecar), 100% Python-free

## [0.3.2] - 2026-07-31

### Fixed
- Page navigation crash, PRISMA modal hang, meta-analysis significance test null value, macOS DMG naming

## [0.3.1] - 2026-07-31

### Added
- Version display window, tagged releases

### Fixed
- 8 runtime bugs

## [0.3.0] - 2026-07-30

### Added
- Initial modular architecture, GUI, meta-analysis engine, plots, PRISMA, GRADE, exports, installers

## [0.1.0] - 2026-07-30

### Added
- Initial proof-of-concept release

---

## Release Template

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
### Security
- Linux AppImage: updated the Tauri bundler to keep Wayland/XKB/XCB display libraries host-provided, preventing EGL startup failures on newer Mesa/WebKit systems. Added a build gate that rejects AppImages bundling those libraries.
- Branding: use the supplied poolr wordmark in the expanded workspace and documentation, the pin mark in collapsed navigation and generated desktop/installer icons.
