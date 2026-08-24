## What does this PR do?

<!-- One or two sentences. Link the issue it fixes: Fixes #123 -->

## How was it tested?

<!-- Commands you ran. The CI gate is: dotnet test (engine) + npm run build + npm run test (frontend) + cargo fmt/clippy (shell). -->

- [ ] `dotnet test engine/Poolr.Engine.Tests -c Release` passes (required for engine changes)
- [ ] `cd frontend && npm run build && npm run test -- --run` passes
- [ ] `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings` passes
- [ ] Docs updated if user-facing (`README.md`, `RELEASES.md`, `CHANGELOG.md`)

## Screenshots / recordings

<!-- Required for UI changes. -->
