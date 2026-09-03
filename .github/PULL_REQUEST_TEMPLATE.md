## Summary of Changes

<!-- Provide a clear, high-level explanation of the changes made and the problem solved. -->

Fixes # <!-- Link related issue here -->

## Type of Change

- [ ] :sparkles: **feat**: New feature or statistical capability
- [ ] :bug: **fix**: Bug fix or mathematical correction
- [ ] :memo: **docs**: Documentation updates or citation improvements
- [ ] :art: **style**: Formatting, whitespace, or code aesthetics
- [ ] :recycle: **refactor**: Code refactoring with no functional change
- [ ] :zap: **perf**: Performance optimization
- [ ] :white_check_mark: **test**: New unit tests or benchmarks
- [ ] :wrench: **chore**: Build, CI, or dependency updates

## Statistical & Methodological Verification

<!-- If modifying any statistical engine or PRISMA flow, verify against gold standards (e.g. R metafor, RevMan). -->

- [ ] Statistical formulas verified against peer-reviewed literature or Cochrane Handbook 6.4
- [ ] Mathematical results benchmarked against R `metafor` or published test datasets
- [ ] PRISMA 2020 reporting compliance maintained

## Pre-Merge Validation Checklist

- [ ] **C# Engine Tests**: `dotnet test engine/Poolr.Engine.Tests/Poolr.Engine.Tests.csproj -c Release` (must pass 100%)
- [ ] **C# Formatting**: `dotnet format engine/Poolr.Engine.Api/Poolr.Engine.Api.csproj --verify-no-changes` (clean)
- [ ] **Frontend Lint & Build**: `cd frontend && npm run lint && npm run build` (0 errors)
- [ ] **Frontend Tests**: `cd frontend && npm test -- --run` (all tests pass)
- [ ] **Rust Shell**: `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings` (clean)
- [ ] Documentation updated (`README.md`, `CHANGELOG.md`, `RELEASES.md`) if user-facing
