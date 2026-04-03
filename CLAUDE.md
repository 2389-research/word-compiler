# Word Compiler

A context compiler for long-form fiction. Structured creative intent (characters, voice rules, scene contracts) is compiled into optimized LLM context payloads, enabling gated chunk-by-chunk prose generation.

## Quick Reference

```bash
pnpm dev:all          # Start frontend (5173) + API server (3001)
pnpm test             # Vitest unit tests
pnpm e2e              # Playwright E2E tests
pnpm check-all        # Lint + typecheck + unit tests
pnpm storybook        # Component docs on port 6006
pnpm eval:mock        # Evaluation suite (no LLM calls)
```

Pre-commit hook runs: `lint-staged && typecheck && test`

## Architecture

```
src/
  compiler/     Ring 1/2/3 builders, budget enforcer, assembler
  auditor/      Kill list, sentence variance, epistemic leaks, subtext
  bootstrap/    Synopsis → draft bible, scene generation, genre templates
  learner/      Diff analysis, pattern accumulation, bible proposals, tuning
  linter/       Compilation linter (priming risk, missing voice, budget health)
  ir/           Narrative IR extraction and parsing
  metrics/      Style drift, voice separability
  gates/        13 workflow gates (6 content + 7 stage-transition)
  simulator/    Reader epistemic state accumulator
  profile/      Author voice profiling pipeline types and rendering
  review/       Editorial review orchestration, annotations, refinement
  export/       Markdown and plaintext export
  types/        All interfaces + factory functions (7 files, ~680 lines via barrel)
  tokens/       Token counting
  bible/        Bible versioning
  llm/          Anthropic SDK wrapper
  api/          Fetch-based API client
  app/
    store/      Svelte 5 runes-based state (ProjectStore, generation, commands)
    components/ Major UI panels (DraftingDesk, CompilerView, AtlasPane, modals)
    primitives/ Reusable UI elements (Button, Modal, Tabs, Badge, etc.)
    stories/    Storybook stories + test factories
    styles/     Global CSS

server/
  proxy.ts      Express entry point
  middleware.ts Request logging and error handling
  api/          REST routes (55+ endpoints under /api/data)
  db/           SQLite schema + repository modules
  profile/      Voice profiling pipeline (CIPHER, distillation, stages 1-5)
```

## Key Conventions

- **Biome**: 2-space indent, 120 line width, double quotes, trailing commas, always semicolons
- **TypeScript strict** with `noUncheckedIndexedAccess`. Path alias `@/*` → `./src/*`
- **Svelte 5 runes**: `$state`, `$derived`, `$effect` — no legacy stores
- **Core logic is framework-free**: compiler/, auditor/, learner/, etc. are pure TS with no UI imports
- **No LangChain**: Raw prompt construction is intentional. The context compiler IS the product.
- **Server-first persistence**: Mutations call API first, update store from response. SQLite is local (~1ms).
- **Repository pattern** for all DB access (`server/db/repositories/`)
- **Test mirrors source**: `tests/compiler/ring1.test.ts` ↔ `src/compiler/ring1.ts`
- **Factory functions** for defaults: `createEmptyBible()`, `createEmptyScenePlan()`, etc. in `src/types/index.ts`

## The Three Rings

The context compiler builds LLM prompts in three concentric rings:
- **Ring 1** (system message): Project voice, tone, kill list, global rules. Hard-capped.
- **Ring 2** (chapter context): Chapter arc, character states from IR deltas, active setups.
- **Ring 3** (scene context): Scene plan, voice fingerprints, continuity bridge, anchor lines. Gets ≥60% of budget.

When over budget, compress in priority order: R1 → R2 → R3. Never compress: kill list, scene contract, voice fingerprints, anchor lines, anti-ablation.

## Data Flow

```
Bible + ScenePlan + PreviousChunks + Config
  → Ring Builder (R1, R2, R3)
  → Budget Enforcer (token counting, priority trim)
  → Linter (priming risk, missing voice, budget health)
  → Assembler (system msg + user msg + gen params)
  → CompiledPayload → Anthropic API → Generated Chunk
  → Human Review (accept/edit/reject)
  → Auditor (kill list, variance, subtext, epistemic)
  → Learner (diff classification → pattern proposals)
```

## File Naming

- TypeScript: camelCase (`sceneBootstrap.ts`)
- Svelte: PascalCase (`DraftingDesk.svelte`)
- DB columns: snake_case (`chapter_number`)
- Interfaces: PascalCase (`ScenePlan`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_MODEL`)

## Important Files

- `SPEC.md` — The full build plan (Phases 0-3, data model, compiler pseudocode)
- `docs/architecture/` — 15 detailed architecture docs (00-overview through 14-personalization)
- `docs/plans/` — Phase 2.5/3 design decisions
- `docs/workflow.md` — User-facing workflow guide
- `src/types/index.ts` — All TypeScript interfaces (barrel re-export of 7 files, ~680 lines total)
- `src/app/store/project.svelte.ts` — Main application state
- `src/app/store/commands.ts` — User-facing actions (generate, audit, complete)
- `src/app/stories/factories.ts` — Mock data factories for tests and stories
