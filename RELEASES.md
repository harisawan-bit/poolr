# poolr Releases

## Latest Release

**poolr v0.3.1** — Stable release  
Release date: 2026-07-31

### Downloads

| Platform | File | Notes |
|----------|------|-------|
| Windows x64 | `poolr-windows-x64.zip` | Recommended for most PCs — unzip and run `poolr-x64.exe` |
| Windows x86 | `poolr-windows-x86.zip` | 32-bit Windows |
| Windows ARM64 | `poolr-windows-arm64.zip` | Windows on ARM |
| macOS Apple Silicon | `poolr-macos-arm64.zip` | Contains `poolr.app` + `poolr-universal.dmg` |
| macOS Intel | `poolr-macos-x64.zip` | Contains `poolr.app` + `poolr-universal.dmg` |
| Linux x86_64 | `poolr-linux.zip` | Single-file executable — `chmod +x poolr && ./poolr` |

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
- Email: poolr-support@example.com

---

## Older Releases

### v0.1.0 (2026-07-30)
Initial proof-of-concept release with basic PICO, search builder, screening, extraction, RoB, meta-analysis, and JSON export.
