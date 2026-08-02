# Contributing to poolr

Thank you for your interest in contributing to **poolr** — a native desktop app
(Tauri 2 / Rust + React/TypeScript + a C# 12 / .NET 8 engine sidecar) for
systematic reviews and meta-analyses.

## 🌿 Branch Strategy

We keep it simple and protected:

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production releases only | Protected — never push directly |
| `develop` | Integration branch for the next release | Protected — PR required |
| `feature/*` | New features / fixes | Short-lived, merge into `develop` via PR |

**Rule:** never push directly to `main`. Always open a PR from a feature branch
into `develop`, let CI go green, then merge. Releases are cut from `develop` → `main`
and tagged `vX.Y.Z` (the tag triggers the 6-OS installer build).

### Branch Naming
- Features: `feature/short-description`
- Fixes: `fix/short-description`

## 🔄 Pull Request Process

### 1. Before Opening a PR
- [ ] Branch from `develop`: `git checkout -b feature/my-change develop`
- [ ] Keep changes focused and reviewable
- [ ] Run the checks locally (see below)
- [ ] Update `CHANGELOG.md` / `RELEASES.md` if user-facing

### 2. Opening a PR
- Target: **`develop`**
- Link related issues (`Fixes #123`)
- Describe what changed and why

### 3. Merge
- CI must be green (`ci.yml` + `build.yml` matrix across Windows/macOS/Linux)
- Squash-merge feature branches; delete the branch after merge

## 🧱 Repo Layout (what lives where)

| Path | Stack | Notes |
|------|-------|-------|
| `frontend/` | React + TypeScript (Vite) | The 8 SRMA pages + `lib/` (engine bridge, import parser) |
| `src-tauri/` | Rust (Tauri 2) | Native shell; spawns the C# engine; bundle config in `tauri.conf.json` |
| `engine/` | C# 12 / .NET 8 | Meta-analysis HTTP API (`:5180`). Math.NET for stats, SkiaSharp for figures |
| `src/poolr/` | Python | **Parity oracle only** — validates the C# engine numerics in CI. Not shipped |
| `tests/verification/` | Python (`pytest`) | Runs the C# engine vs the Python reference (`tests/verification/test_meta_analysis.py`) |
| `.github/workflows/` | YAML | `ci.yml` (lint/type/test) + `build.yml` (6-OS installer matrix on tags) |

## 🧪 Local Checks

```bash
# Frontend type-check + production build
cd frontend && npm ci && npm run build

# Rust shell
cd src-tauri && cargo check

# C# engine ↔ Python reference parity (the CI gate that keeps numerics honest)
pip install -e ".[dev]"
pytest tests/verification -q

# Run the engine locally for manual API calls
cd engine && dotnet run --project Poolr.Engine.Api
# then:  curl http://127.0.0.1:5180/health
```

## 📦 Building Installers (locally, optional)

```bash
cd src-tauri && cargo tauri build        # produces msi/nsis/dmg/deb/rpm in target/
```

In CI this happens automatically when you push a `vX.Y.Z` tag.

## 🏷️ Versioning & Releases

- Semantic Versioning: `MAJOR.MINOR.PATCH`
- Bump `version` in `frontend/package.json`, `src-tauri/tauri.conf.json`, and
  `pyproject.toml` together
- Update `RELEASES.md` + `CHANGELOG.md`
- Merge `develop` → `main`, then `git tag -a vX.Y.Z -m "poolr vX.Y.Z"` and push the tag
- `build.yml` builds and publishes the 6-OS installers to the GitHub Release

## 🔒 Security

Do **not** open public issues for vulnerabilities. Email the maintainer directly.
CI runs dependency scanning; never commit secrets or `.env` files.

## 📜 License

MIT — © M. Haris Awan. All rights reserved. See [LICENSE](LICENSE).
