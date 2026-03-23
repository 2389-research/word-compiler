# Contributing to Word Compiler

## Getting Started

### Prerequisites

- Node.js 20 (see `.nvmrc`)
- [pnpm](https://pnpm.io/)

### Setup

```bash
git clone https://github.com/2389-research/word-compiler.git
cd word-compiler
pnpm install
```

This installs dependencies and sets up Husky pre-commit hooks automatically.

### Running Locally

```bash
pnpm dev:all          # Frontend (5173) + API server (3001)
```

Create a `.env` file with your Anthropic API key for LLM features. The app works without one for UI development — generation calls will fail but everything else functions.

## Development Workflow

### Code Style

- **Biome** handles linting and formatting (2-space indent, 120 char width, double quotes, trailing commas, semicolons)
- Run `pnpm lint:fix` to auto-fix
- Pre-commit hooks run `lint-staged`, `typecheck`, and `test` automatically

### Testing

```bash
pnpm test             # Vitest unit tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report
pnpm e2e              # Playwright E2E tests
pnpm e2e:headed       # E2E with browser visible
pnpm eval:mock        # Evaluation suite (no LLM calls)
```

Test files mirror the source tree: `tests/compiler/ring1.test.ts` tests `src/compiler/ring1.ts`.

### Type Checking

```bash
pnpm typecheck        # tsc --noEmit
```

TypeScript is configured with strict mode and `noUncheckedIndexedAccess`.

### Run Everything

```bash
pnpm check-all        # Lint + typecheck + unit tests
```

This is what CI runs. Make sure it passes before opening a PR.

## Project Structure

Core logic (compiler, auditor, learner) is pure TypeScript with no framework dependencies. The UI is Svelte 5.

- `src/types/index.ts` — All interfaces, single source of truth
- `src/compiler/` — Ring builders, budget enforcer, assembler
- `src/app/` — Svelte components, stores, and styles
- `server/` — Express API server with SQLite persistence
- `tests/` — Unit tests (mirrors `src/` structure)
- `e2e/` — Playwright browser tests
- `eval/` — Quality evaluation framework

See [docs/architecture/](docs/architecture/) for detailed design documentation.

## Key Conventions

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) — no legacy stores
- **Server-first persistence** — mutations call the API first, then update the store from the response
- **Repository pattern** for all DB access in `server/db/repositories/`
- **Path alias** `@/*` maps to `./src/*`
- **Factory functions** for defaults: `createEmptyBible()`, `createEmptyScenePlan()`, etc.

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure `pnpm check-all` passes
4. Open a PR with a clear description of the change and why

The PR template will guide you through the checklist.
