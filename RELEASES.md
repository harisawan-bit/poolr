# poolr Releases

## Latest Release

**poolr v0.5.0** — Quality & polish release  
Release date: 2026-08-24

> Hardened CI with real gates, frontend unit-test suite, premium Bklit UI charts (screening rings, I² gauge, RoB radar, study-weight rings), pure-MIT license fix, and repo-professionalism pass.

### What's New in v0.5.0

- **Bklit UI charts** themed to poolr's monochrome palette: animated screening-progress rings + I² heterogeneity gauge on the Dashboard, per-study weight rings on Meta-Analysis, RoB domain-coverage radar.
- **Frontend unit tests** (Vitest, 38): citation parsers + engine API bridge — wired into CI as a required gate.
- **CI hardened**: every gate fails the build now (C# format without bypass, oxlint, Vitest, cargo fmt --check, clippy -D warnings, vulnerability scan that exits non-zero).
- **Fixed**: CSV import losing the first record when a header-less file mentioned "abstract"; Rust `static mut` undefined behaviour replaced with a safe `OnceLock`.
- **License**: pure MIT (contradictory footer removed) — GitHub now recognises the license correctly.

### Downloads (native installers)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr-linux-x86_64.deb` + `poolr-linux-x86_64.rpm` | Debian or RPM package. |

---


**poolr v0.4.0** — Native Tauri + React + C# overhaul  \nRelease date: 2026-08-02

> This release replaces the old Python / CustomTkinter app with a fully native desktop build: a **Tauri 2 (Rust)** window, a **React + TypeScript** UI, and a bundled **C# 12 / .NET 8** statistical engine sidecar. No Python runtime is required — the app runs on any stock machine. Project data auto-saves (`poolr.json` + rolling `.bak`) so multi-day reviews survive a force-close.

### Downloads (native installers — full, not portable zips)

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.msi` | Recommended for most PCs. Also ships `poolr-windows-x64.exe` (NSIS) installer. |
| Windows x86 | `poolr-windows-x86.msi` | 32-bit Windows. |
| Windows ARM64 | `poolr-windows-arm64.msi` | Windows on ARM. |
| macOS Apple Silicon | `poolr-macos-arm64.dmg` | Contains `poolr.app`. |
| macOS Intel | `poolr-macos-x64.dmg` | Contains `poolr.app`. |
| Linux x86_64 | `poolr-linux-x86_64.AppImage` + `poolr-linux-x86_64.deb` | AppImage (portable) or Debian package. |

### What's New in v0.4.0

- **Fully native stack**: Tauri 2 (Rust) shell + React/TypeScript UI + C# 12 / .NET 8 engine sidecar (localhost HTTP API). **100% Python-free** — no Python in the product or the repo.
- **All 8 pages reimplemented** in React: Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta-Analysis, PRISMA.
- **Meta-analysis engine (C#)**: OR/RR/RD/MD/SMD/HR, fixed + random-effects (DL/REML/PM/HS/ML/EB), Cochran Q, I², τ², Egger/Begg publication bias, subgroup analysis — guarded by the `engine/Poolr.Engine.Tests` xUnit suite.
- **Figures**: SkiaSharp/ SVG forest + funnel plots rendered in-app.
- **Screening import**: parse PubMed MEDLINE, CSV, RIS / .nbib, and EndNote exports into screening items (hidden file picker — works in Tauri and plain browser).
- **Persistence**: atomic auto-save to `poolr.json` with rolling `.bak` restore; load-on-start; force-close safe.
- **GRADE**: Auto-GRADE evidence profile from meta results + RoB on the PRISMA page.
- **Export**: Word (.docx), Markdown, LaTeX, JSON — with a pre-export copyright/disclaimer confirmation.
- **Licensing**: MIT license, © 2026 M. Haris Awan. All rights reserved. Native installers carry the copyright string.
- **Bundled engine**: self-contained C# sidecar embedded in every installer; Windows WebView2 fixed runtime bundled (no separate download).


### What's New in v0.3.2

- **Critical fix**: page navigation no longer crashes (`bad window path name`) when revisiting pages — found by launch-testing the packaged v0.3.1 Windows exe
- **Critical fix**: PRISMA auto-generation no longer hangs the headless GUI smoke test (blocking modal removed from the automatic path)
- Meta-analysis significance now respects the correct null per effect measure (MD/SMD/HR were being tested against the wrong null), and the results screen shows a status hint instead of a popup
- Build: macOS x64 and arm64 now ship separate, correctly-named DMG files (previously both overwrote a single `universal.dmg`)
- About dialog version now stays in sync automatically
- New page-switching regression test in CI

### What's New in v0.3.1

- Version now shown in the app window title
- Tagged releases publish real (non-draft) GitHub Releases with per-platform zip assets
- 8 runtime bugs fixed in the full debug pass
- `poolr-cli` entrypoint fixed + headless GUI smoke test in CI
- CI hardening: release permissions, per-platform zip packaging, repo hygiene

### What's New in v0.3.0

- Full 8-phase SRMA GUI: Dashboard, Protocol, Search, Screening, Extraction, RoB, Meta-Analysis, PRISMA
- Advanced meta-analysis engine: OR, RR, RD, MD, SMD, HR with fixed/random-effects models
- Subgroup analysis and publication bias testing
- Publication-ready forest plots, funnel plots, and PRISMA flow diagrams
- GRADE evidence profiling with auto-population
- Word (.docx), LaTeX, and JSON manuscript export
- RIS/EndNote/Zotero import and export
- Dual independent reviewer screening with conflict resolution
- Cross-platform desktop installers

### Installation

1. Download the installer for your platform above
2. Run the installer
3. Launch poolr from your applications menu or desktop shortcut

### Upgrade Notes

- If you have a project from an older version, open the project folder and poolr will auto-upgrade the format.
- Back up your project folder before upgrading if possible.

### System Requirements

| Requirement | Details |
|-------------|---------|
| OS | Windows 10+, macOS 11+, or Ubuntu 20.04+ |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 200 MB for installation |
| Display | 1280x720 minimum resolution |

### Known Issues

- macOS: First launch may take 10-15 seconds on Apple Silicon
- Linux: AppImage requires `libfuse2` on some distros
- Large screening lists (>2000 records) may slow UI refresh

### Support

- Report issues: https://github.com/harisawan-bit/poolr/issues
- Email: m.harisawan@icloud.com

---

## Older Releases

### v0.1.0 (2026-07-30)
Initial proof-of-concept release with basic PICO, search builder, screening, extraction, RoB, meta-analysis, and JSON export.
