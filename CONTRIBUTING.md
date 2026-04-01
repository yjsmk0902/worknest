# Contributing to Worknest

Thanks for taking the time to contribute! Worknest is an open-source, local-first collaboration platform with web, desktop, and server components. We welcome bug reports, feature requests, docs improvements, and code contributions.

## Before you start

Before making any significant changes, please open an issue to discuss the proposal. Talking through changes early helps keep the contribution process smooth for everyone.

## Ways to contribute

- Report bugs and regressions
- Propose features or improvements
- Improve documentation
- Submit code changes

## Development setup (quick pointers)

See the main [README.md](README.md) for full local setup details:

- Root setup: `npm install`
- Server: `apps/server` (uses Postgres + Redis; Docker Compose is provided)
- Web: `apps/web`
- Desktop: `apps/desktop`
- Mobile: `apps/mobile` (experimental; not ready for production use)
- Scripts: see [scripts/README.md](scripts/README.md) for emojis, icons, and seed data

Notes:

- `npm install` runs a `postinstall` step that generates/copies emoji and icon assets into the apps.
- These generated asset outputs are intentionally ignored by git; please don’t add them to commits (focus on source changes under `scripts/` instead).

## Tests

Tests are written with [Vitest](https://vitest.dev/) and live in each app or package:

```bash
# Run all tests from the repo root (via Turbo)
npm run test

# Run tests for a specific app/package
cd apps/server && npm run test   # Integration tests (requires Docker for Testcontainers)
cd apps/web && npm run test      # Unit tests (jsdom)
cd packages/core && npm run test # Unit tests
cd packages/crdt && npm run test # Unit tests
cd packages/client && npm run test # Unit tests
```

When contributing:

- Add tests for new logic, especially in shared packages (`packages/core`, `packages/crdt`, `packages/client`).
- Server tests use [Testcontainers](https://testcontainers.com/) for Postgres and Redis — Docker must be running.
- Web tests use jsdom with mocks for browser APIs (OPFS, IntersectionObserver, etc.).
- Run `npm run build` when relevant before opening a PR.
- If your change cannot be covered by automated tests, include clear manual verification steps in your PR description.

## Pull request process

- Fork the repo and branch from `main`.
- Keep PRs focused and scoped to a single change when possible.
- Update or add docs if your change affects usage or setup.
- For UI changes, include screenshots or a short video.

## License

By contributing, you agree that your contributions are licensed under the Apache 2.0 License (see `LICENSE`).
