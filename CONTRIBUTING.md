# Contributing to Poolr

Thank you for your interest in contributing to **Poolr**! As an open-source, no-code desktop application for systematic reviews and meta-analyses, Poolr welcomes contributions from biostatisticians, clinical researchers, frontend developers, and systems engineers.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Branching Strategy & Workflow

We adhere to a git-flow model with protected branches:

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Production releases | Protected — direct pushes disallowed. Releases are tagged from here. |
| `develop` | Active integration branch | Protected — PR required with green CI. |
| `feat/*` | New features / analyses | Branch from `develop`, open PR to `develop`. |
| `fix/*` | Bug fixes / corrections | Branch from `develop`, open PR to `develop`. |

### Development Cycle
1. **Fork the Repository**: Fork `harisawan-bit/poolr` to your GitHub account and clone locally.
2. **Branch from develop**:
   ```bash
   git checkout -b feat/my-feature develop
   ```
3. **Commit with Conventional Commits**:
   - `feat: add network meta-analysis node-splitting`
   - `fix: correct degrees of freedom in paired t-test pooling`
   - `docs: add citation guidelines in README`
4. **Run Pre-Commit Verification** (see commands below).
5. **Open a Pull Request**: Target the **`develop`** branch and complete the PR checklist.

---

## Repository Architecture

| Directory | Technology | Role |
|---|---|---|
| `frontend/` | React 19, TypeScript, Vite, Tailwind CSS | The 8 PRISMA stages, UI modals, Bklit vector charts |
| `engine/` | C# 12, .NET 8, ASP.NET Core, Math.NET, SkiaSharp | High-performance statistics & SVG rendering engine |
| `src-tauri/` | Tauri 2, Rust | Cross-platform desktop shell & native sidecar supervisor |
| `.github/` | GitHub Actions Workflows | 10-job cross-platform CI and 6-OS installer release matrix |

For detailed topological architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Local Verification Commands

Before opening a pull request, verify that all CI gates pass locally:

### 1. Frontend (React & TypeScript)
```bash
cd frontend
npm ci
npm run lint          # oxlint checks
npm run build         # TypeScript strict compilation & Vite build
npm test -- --run     # Vitest unit test suite
```

### 2. C# Statistics Engine (.NET 8)
```bash
# Run all mathematical and statistical regression benchmarks
dotnet test engine/Poolr.Engine.Tests/Poolr.Engine.Tests.csproj -c Release

# Verify zero format discrepancies (enforced strictly in CI)
dotnet format engine/Poolr.Engine.Api/Poolr.Engine.Api.csproj --verify-no-changes
```

### 3. Tauri Desktop Shell (Rust)
```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

---

## Building Native Installers Locally

To compile native desktop installers on your workstation:
```bash
cd src-tauri
cargo tauri build
```
Output packages (MSI/NSIS on Windows, DMG on macOS, DEB/RPM on Linux) will be generated in `src-tauri/target/release/bundle/`.

---

## Scientific & Statistical Standards

When submitting changes that affect statistical calculations or figure generators:
1. **Literature Citation**: Cite the methodology paper in your pull request description (e.g. DerSimonian & Laird 1986, Higgins 2009, Wan 2014).
2. **Oracle Benchmark**: Test your calculation against the corresponding gold-standard R package (e.g. `metafor`, `netmeta`, `robvis`). Include numerical comparison in your PR.
3. **Automated Test**: Add an xUnit test in `engine/Poolr.Engine.Tests/` to prevent future regressions.

---

## Security Inquiries

Do not report security vulnerabilities via public GitHub issues. Follow the instructions in [SECURITY.md](SECURITY.md) or email **m.harisawan@icloud.com**.

---

## License

By contributing to Poolr, you agree that your contributions will be licensed under the [MIT License](LICENSE).
