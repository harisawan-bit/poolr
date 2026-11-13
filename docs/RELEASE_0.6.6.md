# Poolr 0.6.6 release notes

## Summary

Poolr v0.6.6 unifies the systematic review pipeline end-to-end (`Protocol` → `Search & Citation Library` → `Screening` → `Study Manager & Extraction` → `Risk of Bias` → `Analysis` → `PRISMA 2020 & GRADE` → `Manuscript`), fixes button contrast and editorial color legibility across light and dark modes, adds linked citation and source provenance inspection, and aligns all application version strings to `0.6.6`.

## Key Changes in v0.6.6

- **Pipeline Stepper & Linked Workflows**: Persistent 8-stage progress navigation in `App.tsx`, direct Citation Library ↔ Extraction ↔ RoB ↔ Meta-Analysis cross-links, and 1-click study inspection from Forest/Funnel plots back to source data.
- **Reference & Citation Manager**: Dedicated bibliographic manager supporting PubMed Summary/Abstract, PMID lists, MEDLINE/NBIB, RIS, EndNote, Rayyan CSV, and Covidence CSV imports with BibTeX/RIS/CSV exports and full-text URL/PDF metadata.
- **Study Source Viewer & Highlight Provenance**: Capture highlighted source quotes directly onto extracted values and RoB 2 domain rationales.
- **Visual System & Analysis Hub Unification**: Warm/neutral readable light and dark token contrast, Risk-of-Bias Traffic Light matrix inside Meta-Analysis, official Page et al. PRISMA 2020 Box SVG diagram, and consolidated Analysis Workspace.
- **Bug Fixes & Version Alignment**: Resolved TSA integer `informationFraction` JSON deserialization errors (`HTTP 400`) across `Meta.tsx`, `useMetaAnalysis.ts`, and `ComplexDataHub.tsx`; synchronized version `0.6.6` across root, frontend, Tauri, and C# API manifests.

## Updater Continuity for Existing Users

- **`v0.6.5` installations**: Automatic in-app updates work seamlessly via `@tauri-apps/plugin-updater` once this release is promoted from draft to non-prerelease `latest` on GitHub Releases (`pubkey` key ID `C1C149B7917EDEF0` preserved unchanged in `src-tauri/tauri.conf.json`).
- **`v0.6.4` and earlier installations**: Must perform one manual installer upgrade (`v0.6.5` or `v0.6.6`) due to the key rotation documented in [UPDATER_SIGNING.md](UPDATER_SIGNING.md).

## Release Publication Checklist

- Ensure all CI checks (`ci.yml`) and 6-target installer builds (`build.yml`) succeed (`win-x64`, `win-x86`, `win-arm64`, `osx-x64`, `osx-arm64`, `linux-x64`).
- Verify `latest.json` and `.sig` signatures are uploaded in the draft GitHub release for `v0.6.6`.
- Uncheck **Pre-release** and **Draft** only after smoke testing; GitHub `/releases/latest/download/latest.json` ignores draft and pre-release entries.
