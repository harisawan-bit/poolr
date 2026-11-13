# Poolr handoff for Antigravity

Open `/home/haris/Projects/Poolr-Antigravity` as the workspace root. This is a writable, independent copy of the full Poolr source tree from `bf692b10b3f895ddbc308f50a71c22cf38c57a6e`. It includes the latest local changes, public assets, sample review, tests, lockfiles, build scripts, and GitHub workflow definitions.

The source of this snapshot is `/home/haris/Projects/poolr-search-release`. Make edits in this handoff folder. It has its own Git branch, `antigravity/local`, with a baseline commit and no remote. Changes here do not appear in the original checkout or installed Poolr until Haris reviews and applies them. Keep work local. Leave GitHub, the existing checkout, the installed binary, and user project data alone. This folder contains source and documentation. Dependencies and generated binaries are rebuilt locally. No account credentials, signing keys, app storage, or personal review files were copied.

## Where to make changes

| Area | Files and directories |
| --- | --- |
| Desktop layout and scaling | `frontend/src/App.tsx`, `frontend/src/workspace.css`, `src-tauri/tauri.conf.json` |
| Dashboard and greetings | `frontend/src/pages/Dashboard.tsx` and the dashboard tests in `frontend/src/lib/__tests__/` |
| Search tabs, saved strategies, and routing | `frontend/src/pages/Search.tsx`, `frontend/src/components/DatabaseSelector.tsx` |
| PubMed and ClinicalTrials.gov | `frontend/src/components/search/LiteratureSearch.tsx`, `MeSHBrowser.tsx` in the same folder, `frontend/src/lib/api/literature.ts`, and the fixed-upstream routes in `engine/Poolr.Engine.Api/Program.cs` |
| Visual query editor | `frontend/src/components/search/BooleanQueryBuilder.tsx`, `BooleanQueryBuilder.test.ts`, `literature.css` in the same folder |
| PROSPERO and Google Scholar | `frontend/src/components/search/ReviewRegistry.tsx` and `ScholarSearch.tsx` |
| Other search providers | `frontend/src/components/UnifiedSearch.tsx` |
| Analysis workspace | `frontend/src/pages/AnalysisHub.tsx` and the method components it imports |
| Practice review and Learn | `frontend/src/pages/Learn.tsx`, `frontend/src/lib/practiceReview.ts`, `frontend/public/demo-project.json`, `frontend/src/App.tsx`, `docs/GUIDED_REVIEW_PLAN.md` |
| Review data, normalization, screening and imports | `frontend/src/lib/project.ts`, `frontend/src/pages/Screening.tsx`, `frontend/src/lib/__tests__/` |
| Statistics and backend | `engine/Poolr.Engine.Api/`, `engine/Poolr.Engine.Tests/`, `engine/Poolr.Engine.sln` |
| Native shell, sidecar, updater | `src-tauri/src/`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` |
| Build and release workflow | `package.json`, `frontend/package.json`, `.github/workflows/`, `scripts/`, `CONTRIBUTING.md` |

Start with `ARCHITECTURE.md` for the frontend, native shell, and engine boundaries. The app is React and TypeScript on Tauri 2. Its ASP.NET Core engine listens on loopback port 5180.

## What is already working

- Analysis groups the former Advanced and Analysis Hub methods in one workspace.
- PubMed, ClinicalTrials.gov, and PROSPERO have provider-specific visual Boolean query controls. Keep the native query field available and preserve provider-specific syntax. PubMed keeps PICO and MeSH insertion. PROSPERO supports proximity and field filters.
- PROSPERO keyword search uses the public endpoint used by York's website. The third-party contract is undocumented. Keep browser and copy fallbacks, and keep registry records separate from article screening.
- Scholar builds the provider's advanced-search parameters and opens the results in Scholar. Keep structured fields and the pasted-query option.
- Learn provides a local BCG practice copy with nine workspace steps. Practice edits and checkpoint progress stay separate from the working review. The full curriculum, validated sample data, and per-control exercises are specified in `docs/GUIDED_REVIEW_PLAN.md`. The latest implementation intentionally deferred the researched teaching content.

## Develop and verify

Run these commands from this folder. Use a current Node.js release compatible with the lockfile, .NET 8 SDK, Rust/Cargo, and the native Tauri 2 build libraries for your platform.

```bash
npm --prefix frontend ci
npm --prefix frontend run test -- --run
npm --prefix frontend run build
dotnet test engine/Poolr.Engine.Tests/Poolr.Engine.Tests.csproj -c Release
```

On this laptop, if `dotnet --version` reports that it cannot find an SDK, use the existing .NET 8 SDK at `$HOME/.local/share/mise/dotnet-root/dotnet` in place of `dotnet`.

For a browser preview, start the frontend and engine in separate terminals. Vite defaults to port 1420. The optional arguments below use 5173, which the engine also permits, so this copy can run beside the original preview. Only one local engine can bind port 5180 at a time. Check who owns that port before starting another process.

```bash
# Terminal 1
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort

# Terminal 2, if port 5180 is free
dotnet run --project engine/Poolr.Engine.Api/Poolr.Engine.Api.csproj
```

Use `http://127.0.0.1:5173/?demo=1&nosplash=1` in a disposable browser profile for the bundled practice review. The desktop UI may remain closed while running tests.

For a local Linux x86-64 desktop compile, the generated engine belongs under `src-tauri/resources/engine`. The binary is written to `src-tauri/target/release/poolr`.

```bash
dotnet publish engine/Poolr.Engine.Api/Poolr.Engine.Api.csproj -c Release -r linux-x64 --self-contained true -o src-tauri/resources/engine
npm run tauri -- build --no-bundle
```

The release workflow in `.github/workflows/build.yml` shows the additional rclone and signing steps for distribution. The local source build does not require private updater keys.

## Return changes for review

Run `git status --short`, `git diff --check`, and the tests relevant to your edits. Report changed files, exact checks and outcomes, and anything you could not verify. The snapshot is the baseline for reviewing your work. Keep changes as a local diff or make local commits. Haris can inspect `git log --oneline` and `git diff <baseline>..HEAD` before transferring selected changes.
