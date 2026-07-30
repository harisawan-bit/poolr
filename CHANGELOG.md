# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - develop branch

### Added
- N/A

### Changed
- N/A

### Fixed
- N/A

## [0.3.2] - 2026-07-31

### Fixed
- **Critical**: page navigation crashed with `TclError: bad window path name` when revisiting any page (Dashboard/Protocol/Search/etc.) — `_select_page` destroyed cached page widgets while keeping them in the page cache. Pages are now hidden with `pack_forget()` and stale cache entries rebuilt. Verified against the packaged v0.3.1 Windows exe where the bug reproduced.
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