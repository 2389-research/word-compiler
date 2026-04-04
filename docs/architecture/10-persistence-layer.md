# Persistence Layer

The persistence layer uses a three-tier architecture: browser client, Express server, and SQLite database.

## Architecture

```
Browser (Svelte)          Server (Express)           Database (SQLite)
┌──────────────┐         ┌──────────────────┐       ┌─────────────────┐
│  API Client  │──HTTP──▶│  REST Router     │──SQL─▶│  better-sqlite3 │
│  (fetch)     │◀─JSON──│  (routes.ts)     │◀─────│  (WAL mode)     │
└──────────────┘         │                  │       └─────────────────┘
                         │  LLM Proxy      │──API─▶ Anthropic SDK
                         │  (proxy.ts)     │◀──SSE─
                         └──────────────────┘
```

## API Client (`src/api/client.ts`)

Typed REST client using browser `fetch`. All functions follow the pattern:

```typescript
export function apiResource(args): Promise<T> {
  return fetchJson(`${BASE}/path`, { method, body: JSON.stringify(data) });
}
```

Base path: `/api/data`. The `fetchJson` helper adds `Content-Type: application/json` and throws on non-OK responses.

### Client Functions by Resource

| Resource | Functions |
|----------|-----------|
| Projects | `apiListProjects`, `apiGetProject`, `apiCreateProject`, `apiUpdateProject` |
| Bibles | `apiGetLatestBible`, `apiGetBibleVersion`, `apiListBibleVersions`, `apiSaveBible` |
| Chapter Arcs | `apiListChapterArcs`, `apiGetChapterArc`, `apiSaveChapterArc`, `apiUpdateChapterArc` |
| Scene Plans | `apiListScenePlans`, `apiGetScenePlan`, `apiSaveScenePlan`, `apiUpdateScenePlan`, `apiUpdateSceneStatus` |
| Chunks | `apiListChunks`, `apiSaveChunk`, `apiUpdateChunk`, `apiDeleteChunk` |
| Audit Flags | `apiListAuditFlags`, `apiSaveAuditFlags`, `apiResolveAuditFlag`, `apiGetAuditStats` |
| Narrative IRs | `apiGetSceneIR`, `apiCreateSceneIR`, `apiUpdateSceneIR`, `apiVerifySceneIR`, `apiListChapterIRs`, `apiListVerifiedChapterIRs` |
| Compilation Logs | `apiSaveCompilationLog` |
| Profile Adjustments | `apiListProfileAdjustments`, `apiCreateProfileAdjustment`, `apiUpdateProfileAdjustmentStatus` |

## Server (`server/proxy.ts`)

Express server serving two roles:

### 1. LLM Proxy
- `POST /api/generate` — single-shot LLM call, returns `{ text, usage, stopReason }`
- `POST /api/generate/stream` — SSE streaming, emits `delta`, `done`, `error` events
- `GET /api/models` — cached model list from Anthropic API
- Uses `@anthropic-ai/sdk` with sampling parameter logic: prefers `temperature`, falls back to `top_p`

### 2. REST API
- Mounted at `/api/data` via `createApiRouter(db)`
- Delegates to 16 repository modules
- `ensureProject()` auto-creates project rows on first Bible save

## Database

### Connection (`server/db/connection.ts`)

- `getDatabase(path?)` — singleton, creates `data/word-compiler.db` with WAL mode + foreign keys
- `getMemoryDatabase()` — in-memory database for tests
- `closeDatabase()` — cleanup

### Schema (`server/db/schema.ts`)

18 tables with indexes:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `projects` | Project metadata | id, title, status |
| `bibles` | Versioned Bible snapshots | project_id, version, data (JSON) |
| `chapter_arcs` | Chapter-level plans | project_id, chapter_number, data (JSON) |
| `scene_plans` | Scene plans with status | chapter_id, scene_order, status, data (JSON) |
| `chunks` | Generated/edited prose | scene_id, sequence_number, data (JSON) |
| `compilation_logs` | Payload debug records | chunk_id, data (JSON) |
| `audit_flags` | Prose quality flags | scene_id, severity, category, resolved |
| `compiled_payloads` | Cached payload debugging | chunk_id, data (JSON) |
| `narrative_irs` | LLM-extracted IR per scene | scene_id, verified, data (JSON) |
| `edit_patterns` | Raw diff-classified edits | project_id, edit_type, sub_type |
| `profile_adjustments` | Auto-tuning proposals | project_id, parameter, status |
| `learned_patterns` | Accumulated edit patterns | project_id, pattern_type, status |
| `voice_guide` | Singleton voice guide (version-controlled) | id, version, data (JSON) |
| `voice_guide_versions` | Voice guide version history | version, data (JSON), change_reason |
| `writing_samples` | Uploaded writing samples | filename, domain, word_count, data (JSON) |
| `significant_edits` | Raw edit pairs awaiting batch CIPHER | project_id, chunk_id, processed |
| `preference_statements` | CIPHER preference statements | project_id, statement, edit_count |
| `project_voice_guide` | Per-project voice guide from edits + manuscript analysis | project_id, version, data (JSON) |

Complex domain objects (Bible, ChapterArc, Chunk, NarrativeIR) are stored as JSON in `data` columns. Scalar fields (status, severity, resolved) are stored as native columns for indexing and querying.

### Repositories (`server/db/repositories/`)

16 repository modules, one per resource:

| Repository | Table |
|------------|-------|
| `projects.ts` | projects |
| `bibles.ts` | bibles |
| `chapter-arcs.ts` | chapter_arcs |
| `scene-plans.ts` | scene_plans |
| `chunks.ts` | chunks |
| `compilation-logs.ts` | compilation_logs |
| `audit-flags.ts` | audit_flags |
| `narrative-irs.ts` | narrative_irs |
| `edit-patterns.ts` | edit_patterns |
| `learned-patterns.ts` | learned_patterns |
| `profile-adjustments.ts` | profile_adjustments |
| `voice-guide.ts` | voice_guide |
| `writing-samples.ts` | writing_samples |
| `significant-edits.ts` | significant_edits |
| `preference-statements.ts` | preference_statements |
| `project-voice-guide.ts` | project_voice_guide |

Each repository exports CRUD functions that take a `Database` instance as the first argument. JSON columns are parsed on read and stringified on write.

## Key Files

| File | Purpose |
|------|---------|
| `src/api/client.ts` | Typed browser REST client |
| `server/proxy.ts` | Express server: LLM proxy + REST API |
| `server/api/routes.ts` | REST router with 16 repository bindings |
| `server/db/connection.ts` | SQLite singleton with WAL mode |
| `server/db/schema.ts` | 18-table schema with indexes |
| `server/db/repositories/` | 16 repository modules |
