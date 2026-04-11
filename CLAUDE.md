# Word Compiler — Personal Essay Writer

A context compiler for personal essays and articles. Structured writing intent (author voice, style rules, section contracts) is compiled into optimized LLM context payloads, enabling gated section-by-section prose generation with anti-AI-slop guardrails.

Forked from a fiction writing tool. The compilation pipeline and data model use fiction terminology internally (Bible = essay brief, ScenePlan = section plan, Character = author voice). The UI shows essay terminology. Do not rename TypeScript interfaces or database tables — the adaptation is prompt-level only.

## Quick Reference

```bash
pnpm dev:all          # Start frontend (5173) + API server (3001)
pnpm test             # Vitest unit tests (1441 tests, ~5s)
pnpm e2e              # Playwright E2E tests
pnpm check-all        # Lint + typecheck + unit tests
pnpm storybook        # Component docs on port 6006
pnpm eval:mock        # Evaluation suite (no LLM calls)
```

Pre-commit hook runs: `lint-staged && typecheck && test`

Server uses `node --env-file .env --import tsx/esm` for native env loading (no dotenv).

## Internal-to-Essay Terminology Map

The codebase uses fiction terms internally. When writing prompts, UI strings, or user-facing text, always use the essay equivalent.

| Internal (code/types) | Essay (UI/prompts) | Notes |
|---|---|---|
| `Bible` | Essay Brief | The project's voice guide + style rules |
| `ScenePlan` | Section Plan | One section of the essay |
| `ChapterArc` | Essay Arc | Overall essay structure |
| `CharacterDossier` | Author Voice Profile | Single author, not fictional characters |
| `character` | author voice | Variable names stay as-is |
| `povCharacterId` | voice ID | Which voice profile to use |
| `dialogueSamples` | writing samples | Example passages in the author's voice |
| `verbalTics` | writing tics | Recurring stylistic patterns |
| `Location` | Reference / Source | Not used for essays currently |
| `narrativeGoal` | section goal | What the section must accomplish |
| `failureModeToAvoid` | failure mode | What the section must NOT do |
| `scene` (in UI strings) | section | Always "section" in user-facing text |
| `chapter` (in UI strings) | essay | Always "essay" in user-facing text |

## Architecture

```
src/
  compiler/     Ring 1/2/3 builders, budget enforcer, assembler
  auditor/      Kill list, sentence variance, epistemic leaks, subtext
  bootstrap/    Essay brief generation, section planning, genre templates, profile extraction
  learner/      Diff analysis, pattern accumulation, voice proposals, tuning
  linter/       Compilation linter (priming risk, missing voice, budget health)
  ir/           Narrative IR extraction and parsing
  metrics/      Style drift, voice separability
  gates/        13 workflow gates (6 content + 7 stage-transition)
  simulator/    Reader epistemic state accumulator
  profile/      Author voice profiling pipeline types and rendering
  review/       Editorial review orchestration, annotations, refinement
  export/       Markdown and plaintext export
  types/        All interfaces + factory functions (7 files, ~680 lines via barrel)
  tokens/       Token counting (tiktoken)
  bible/        Brief versioning
  llm/          Anthropic SDK wrapper (supports OpenRouter via LLM_BASE_URL)
  api/          Fetch-based API client
  app/
    store/      Svelte 5 runes-based state (ProjectStore, generation, commands)
    components/ Major UI panels (DraftingDesk, CompilerView, AtlasPane, modals)
    primitives/ Reusable UI elements (Button, Modal, Tabs, Badge, etc.)
    stories/    Storybook stories + test factories
    styles/     Global CSS

docs/
  architecture/ 15 detailed architecture docs (00-overview through 14-personalization)
  plans/        Implementation plans with YAML frontmatter
  solutions/    Documented solutions to past problems, organized by category with YAML frontmatter (module, tags, problem_type)

server/
  proxy.ts      Express entry point (port 3001)
  middleware.ts Request logging and error handling
  api/          REST routes (55+ endpoints under /api/data)
  db/           SQLite schema + repository modules (JSON blob storage)
  profile/      Voice profiling pipeline (CIPHER, distillation, stages 1-5)
```

## The Three Rings

The context compiler builds LLM prompts in three concentric rings:

- **Ring 1** (system message): Project voice, tone, kill list, anti-ablation guardrails, global rules. Hard-capped at 4000 tokens.
- **Ring 2** (essay context): Essay arc, section-to-section flow. Currently underutilized for essays.
- **Ring 3** (section context): Section plan, voice fingerprints, continuity bridge, anchor lines. Gets >=60% of budget.

When over budget, compress in priority order: R1 -> R2 -> R3. Never compress: kill list, section contract, voice fingerprints, anchor lines, anti-ablation guardrails.

## Data Flow

```
EssayBrief + SectionPlan + PreviousChunks + Config
  -> Ring Builder (R1, R2, R3)
  -> Budget Enforcer (token counting, priority trim)
  -> Linter (priming risk, missing voice, budget health)
  -> Assembler (system msg + user msg + gen params)
  -> CompiledPayload -> LLM API -> Generated Chunk
  -> Human Review (accept/edit/reject)
  -> Auditor (kill list, variance, subtext, epistemic)
  -> Learner (diff classification -> pattern proposals)
```

## Key Conventions

- **Biome**: 2-space indent, 120 line width, double quotes, trailing commas, always semicolons
- **TypeScript strict** with `noUncheckedIndexedAccess`. Path alias `@/*` -> `./src/*`
- **Svelte 5 runes**: `$state`, `$derived`, `$effect` — no legacy stores
- **Core logic is framework-free**: compiler/, auditor/, learner/ are pure TS with no UI imports
- **No LangChain**: Raw prompt construction is intentional. The context compiler IS the product.
- **Server-first persistence**: Mutations call API first, update store from response. SQLite is local (~1ms).
- **Repository pattern** for all DB access (`server/db/repositories/`)
- **Factory functions** for defaults: `createEmptyBible()`, `createEmptyScenePlan()`, etc. in `src/types/index.ts`
- **Fill-blank merge strategy**: When auto-filling data (profile extraction, genre templates), never overwrite user-set values. Only fill null/empty fields.

## Testing

- **Framework**: Vitest with Testing Library for UI components
- **Location**: `tests/` mirrors `src/` structure (`tests/compiler/ring1.test.ts` <-> `src/compiler/ring1.ts`)
- **Command**: `pnpm test` (1441 tests, ~5s)
- **Configuration**: `vitest.config.ts`
- **Pre-commit**: Full test suite runs on every commit via lint-staged
- **E2E**: Playwright (`pnpm e2e`)
- **Evals**: `pnpm eval:mock` for deterministic evaluation suite

## Database

- **Engine**: SQLite via better-sqlite3 (local, ~1ms queries)
- **Schema**: `server/db/schema.ts` — tables for projects, bibles, scene_plans, chapter_arcs, chunks, narrative_irs, compilation_logs, profile data
- **Storage pattern**: Structured data stored as JSON blobs in TEXT columns. Field-level changes require zero schema migration. Only table renames need ALTER TABLE.
- **Access**: Repository pattern in `server/db/repositories/`
- **Connection**: `server/db/connection.ts` — singleton per process

## LLM Configuration

- **SDK**: Anthropic SDK (`@anthropic-ai/sdk`)
- **Default model**: `claude-sonnet-4-6` (configurable via `DEFAULT_MODEL` in `src/types/metadata.ts`)
- **Multi-backend**: Set `LLM_BASE_URL` and `LLM_API_KEY` in `.env` for OpenRouter or other providers
- **Model fallback**: If `models.list` returns empty or throws, falls back to built-in MODEL_REGISTRY (10 models)
- **Proxy**: All LLM calls go through `server/proxy.ts` which handles auth, streaming, and structured output

## File Naming

- TypeScript: camelCase (`profileExtractor.ts`)
- Svelte: PascalCase (`DraftingDesk.svelte`)
- DB columns: snake_case (`chapter_number`)
- Interfaces: PascalCase (`ScenePlan`, `ExtractedProfile`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_MODEL`, `DEFAULT_KILL_LIST`)
- Tests: same name as source with `.test.ts` suffix

## Important Files

- `src/types/index.ts` — All TypeScript interfaces (barrel re-export of 7 files, ~680 lines)
- `src/types/metadata.ts` — Model registry, DEFAULT_MODEL constant
- `src/bootstrap/index.ts` — Essay brief generation, section plan creation, profile re-exports
- `src/bootstrap/profileExtractor.ts` — Extract author voice profile from writing samples
- `src/bootstrap/genres.ts` — Essay style templates (Personal, Analytical, Op-Ed, Narrative Nonfiction)
- `src/compiler/assembler.ts` — Final prompt assembly (system + user message)
- `src/compiler/ring1.ts` — Ring 1 builder (voice, kill list, guardrails)
- `src/compiler/ring3.ts` — Ring 3 builder (section context)
- `src/gates/index.ts` — Workflow gate definitions
- `src/app/store/project.svelte.ts` — Main application state
- `src/app/store/commands.ts` — User-facing actions (generate, audit, complete)
- `src/app/components/field-glossary.ts` — Field tooltips and descriptions (needs essay adaptation)
- `src/app/components/field-examples.ts` — Example content for form fields (needs essay adaptation)
- `src/app/stories/factories.ts` — Mock data factories for tests and stories
- `server/proxy.ts` — Express server, LLM proxy, model listing
- `server/db/schema.ts` — SQLite table definitions
- `SPEC.md` — Original build spec (fiction-oriented, for reference only)
- `docs/architecture/` — 15 architecture docs (fiction-oriented, for reference)

## Voice Pipeline (Competitive Differentiator)

The 5-stage CIPHER voice profiling pipeline is the key differentiator. No other essay tool learns the author's voice from their edits and writing samples.

- **Stage 1-5**: Analyze writing samples, extract patterns, distill into voice fingerprint
- **CIPHER**: Preference learning from human edits (31-73% edit cost reduction)
- **Profile extraction**: One-shot LLM analysis of pasted writing samples (`src/bootstrap/profileExtractor.ts`)
- **Voice injection**: Extracted voice goes into Ring 1 system message for every generation

## Adaptation Status

The fiction-to-essay adaptation is prompt-level only. Here is what has been adapted and what remains:

**Adapted (working for essays):**
- Bootstrap prompt and parser (thesis, sections, tone, kill list)
- Genre templates (4 essay styles)
- Assembler generation instruction
- Anti-ablation guardrails
- Gate messages (section/voice/goal terminology)
- Linter messages
- Profile extraction (essay-specific fields)
- Key UI components (stage headers, form labels, buttons)

**Not yet adapted (still fiction-framed):**
- `src/bootstrap/sceneBootstrap.ts` — LLM prompt says "narrative architect", asks for subtext/emotionalBeat
- `src/review/prompt.ts` — System prompts say "long-form fiction"
- `src/review/refine.ts` — System prompt says "literary fiction"
- `src/compiler/ring3.ts` — Subtext contract, scene cast guardrail, character knowledge
- `src/compiler/ring1.ts:127` — "Do not invent backstory" (fiction language)
- `src/auditor/epistemic.ts` — Tracks character knowledge (fiction concept)
- `src/auditor/subtext.ts` — Literary subtext checking (fiction concept)
- `src/ir/extractor.ts` — "Facts in the story world" (fiction framing)
- `src/app/components/field-glossary.ts` — 44 fiction-oriented tooltips
- `src/app/components/field-examples.ts` — All examples use fiction scenarios
- `src/app/App.svelte` — Default title "Untitled Novel"
- ~28 user-visible fiction strings across UI components (see UI audit)

## Scope Rules

- **Never modify TypeScript interfaces** (Bible, ScenePlan, CharacterDossier, etc.) — the adaptation is prompt-only
- **Never modify the compilation pipeline logic** (ring builders, budget enforcer, assembler structure)
- **Never modify the SQLite schema** — JSON blob storage means field changes are free
- **Always use essay terminology in user-facing text** — see terminology map above
- **Always use fill-blank strategy** when merging auto-generated data — never overwrite user-set values
