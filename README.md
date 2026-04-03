# Word Compiler

A context compiler for long-form fiction. Structured creative intent (characters, voice rules, scene contracts) is compiled into optimized LLM context payloads, enabling gated chunk-by-chunk prose generation.

The author never writes prompts. They fill in structured fields, write anchor lines, and edit generated prose. The app handles all context assembly, budget management, and constraint injection.

## How It Works

```
Bible + Scene Plan + Previous Chunks + Config
  → Ring Builder (system / chapter / scene context)
  → Budget Enforcer (token counting, priority trim)
  → Linter (priming risk, missing voice, budget health)
  → Assembler → LLM → Generated Chunk
  → Human Review (accept / edit / reject)
  → Auditor (kill list, variance, subtext, epistemic)
  → Learner (diff analysis → pattern proposals)
```

The context compiler builds prompts in three concentric rings:

- **Ring 1** (system): Project voice, tone, kill list, global rules
- **Ring 2** (chapter): Chapter arc, character states, active setups
- **Ring 3** (scene): Scene plan, voice fingerprints, continuity bridge, anchor lines

When over budget, rings compress in priority order. Scene context always gets at least 60% of the token budget.

## Quick Start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
git clone https://github.com/2389-research/word-compiler.git
cd word-compiler
pnpm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=your-key-here
```

### Run

```bash
pnpm dev:all    # Starts frontend (localhost:5173) + API server (localhost:3001)
```

### Workflow

1. **Bootstrap** — Paste a synopsis or build a bible manually (characters, locations, style guide, narrative rules)
2. **Plan** — Author scene plans with chapter arcs, beat sheets, and continuity tracking
3. **Draft** — Generate prose chunk by chunk with compiled context; review, edit, accept or reject
4. **Audit** — Run quality checks: kill list violations, sentence variance, subtext compliance
5. **Complete** — Mark scenes done, extract narrative IR for cross-scene analysis
6. **Export** — Output to markdown or plaintext

See the [Quickstart Guide](docs/quickstart.md) for a detailed walkthrough, or [docs/workflow.md](docs/workflow.md) for the full workflow reference.

## Development

```bash
pnpm test             # Unit tests (Vitest)
pnpm e2e              # E2E tests (Playwright)
pnpm check-all        # Lint + typecheck + unit tests
pnpm storybook        # Component docs (localhost:6006)
pnpm eval:mock        # Evaluation suite (no LLM calls)
```

Pre-commit hooks enforce lint, typecheck, and tests via Husky.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup details.

## Architecture

The core compiler logic is pure TypeScript with no framework dependencies. The UI is a Svelte 5 app.

```
src/
  compiler/     Ring 1/2/3 builders, budget enforcer, assembler
  auditor/      Kill list, sentence variance, epistemic leaks, subtext
  bootstrap/    Synopsis → draft bible, scene generation, genre templates
  learner/      Diff analysis, pattern accumulation, bible proposals
  ir/           Narrative IR extraction and parsing
  types/        All interfaces (single source of truth)

server/
  api/          REST routes (Express)
  db/           SQLite schema + repository modules
```

Full architecture documentation lives in [docs/architecture/](docs/architecture/), covering:

- [Overview](docs/architecture/00-overview.md) — System map and design philosophy
- [Theory of Operation](docs/architecture/01-theory-of-operation.md) — How the compilation pipeline works
- [Context Compiler](docs/architecture/02-context-compiler.md) — Ring building and budget enforcement
- [Auditor & Linter](docs/architecture/03-auditor-linter.md) — Quality gate details
- [Narrative IR](docs/architecture/04-narrative-ir.md) — Structured extraction format
- [Gates & Workflow](docs/architecture/05-gates-workflow.md) — Stage progression logic
- [Bible Versioning](docs/architecture/06-bible-versioning.md) — Version control for story bibles
- [Revision Learner](docs/architecture/07-revision-learner.md) — Pattern learning from edits
- [Export Pipeline](docs/architecture/08-export-pipeline.md) — Output formats
- [Bootstrap & Genres](docs/architecture/09-bootstrap-genres.md) — Synopsis-to-bible generation
- [Persistence Layer](docs/architecture/10-persistence-layer.md) — SQLite + repository pattern
- [UI Architecture](docs/architecture/11-ui-architecture.md) — Svelte 5 component design
- [Evaluation System](docs/architecture/12-evaluation-system.md) — Automated quality metrics
- [Protocols](docs/architecture/13-protocols.md) — Inter-module contracts
- [Personalization](docs/architecture/14-personalization.md) — Voice profiling and adaptation

## Security Model

Word Compiler is designed as a **self-hosted, single-user, localhost application**. The API server binds to `127.0.0.1` by default and CORS is restricted to `http://localhost:5173` and `http://127.0.0.1:5173`.

**Do not expose the server to the public internet or untrusted networks.** The API endpoints include an unauthenticated proxy to the Anthropic API using your configured API key. There is no authentication, no rate limiting, and no input validation — this is by design for a local tool.

To override the defaults (not recommended for untrusted networks):
- `HOST=0.0.0.0` — bind to all interfaces
- `CORS_ORIGIN=http://example.com` — allow a different origin

## License

[Apache 2.0](LICENSE)
