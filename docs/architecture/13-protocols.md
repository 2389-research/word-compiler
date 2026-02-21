# Protocols & Schemas

This document specifies the communication protocols and key data schemas used across the system.

## REST API

Base path: `/api/data` (mounted on the Express server at `server/proxy.ts`).

All requests use `Content-Type: application/json`. Non-OK responses return `{ error: string }`.

### Route Table

| Method | Path | Request | Response |
|--------|------|---------|----------|
| **Projects** | | | |
| GET | `/projects` | — | `Project[]` |
| GET | `/projects/:id` | — | `Project` |
| POST | `/projects` | `Project` | `Project` (201) |
| PATCH | `/projects/:id` | `{ title?, status? }` | `Project` |
| DELETE | `/projects/:id` | — | `{ ok: true }` |
| **Bibles** | | | |
| GET | `/projects/:pid/bibles/latest` | — | `Bible` |
| GET | `/projects/:pid/bibles/:version` | — | `Bible` |
| GET | `/projects/:pid/bibles` | — | `[{ version, createdAt }]` |
| POST | `/projects/:pid/bibles` | `Bible` | `Bible` (201) |
| **Chapter Arcs** | | | |
| GET | `/projects/:pid/chapters` | — | `ChapterArc[]` |
| GET | `/chapters/:id` | — | `ChapterArc` |
| POST | `/chapters` | `ChapterArc` | `ChapterArc` (201) |
| PUT | `/chapters/:id` | `ChapterArc` | `ChapterArc` |
| **Scene Plans** | | | |
| GET | `/chapters/:cid/scenes` | — | `[{ plan, status, sceneOrder }]` |
| GET | `/scenes/:id` | — | `{ plan, status, sceneOrder }` |
| POST | `/scenes` | `{ plan, sceneOrder }` | `ScenePlan` (201) |
| PUT | `/scenes/:id` | `ScenePlan` | `ScenePlan` |
| PATCH | `/scenes/:id/status` | `{ status }` | `{ ok: true }` |
| **Chunks** | | | |
| GET | `/scenes/:sid/chunks` | — | `Chunk[]` |
| GET | `/chunks/:id` | — | `Chunk` |
| POST | `/chunks` | `Chunk` | `Chunk` (201) |
| PUT | `/chunks/:id` | `Chunk` | `Chunk` |
| DELETE | `/chunks/:id` | — | `{ ok: true }` |
| **Audit Flags** | | | |
| GET | `/scenes/:sid/audit-flags` | — | `AuditFlag[]` |
| POST | `/audit-flags` | `AuditFlag[]` or `AuditFlag` | created (201) |
| PATCH | `/audit-flags/:id/resolve` | `{ action, wasActionable }` | `{ ok: true }` |
| GET | `/scenes/:sid/audit-stats` | — | `AuditStats` |
| **Narrative IRs** | | | |
| GET | `/scenes/:sid/ir` | — | `NarrativeIR` |
| POST | `/scenes/:sid/ir` | `NarrativeIR` | `NarrativeIR` (201) |
| PUT | `/scenes/:sid/ir` | `NarrativeIR` | `NarrativeIR` |
| PATCH | `/scenes/:sid/ir/verify` | — | `{ ok: true }` |
| GET | `/chapters/:cid/irs` | — | `NarrativeIR[]` |
| GET | `/chapters/:cid/irs/verified` | — | `NarrativeIR[]` |
| **Compilation Logs** | | | |
| POST | `/compilation-logs` | `CompilationLog` | `CompilationLog` (201) |
| GET | `/compilation-logs/:id` | — | `CompilationLog` |
| GET | `/chunks/:cid/compilation-logs` | — | `CompilationLog[]` |
| **Edit Patterns** | | | |
| GET | `/projects/:pid/edit-patterns` | — | `EditPattern[]` |
| GET | `/scenes/:sid/edit-patterns` | — | `EditPattern[]` |
| POST | `/edit-patterns` | `EditPattern[]` | `EditPattern[]` (201) |
| **Learned Patterns** | | | |
| GET | `/projects/:pid/learned-patterns?status=` | — | `LearnedPattern[]` |
| POST | `/learned-patterns` | `LearnedPattern` | `LearnedPattern` (201) |
| PATCH | `/learned-patterns/:id/status` | `{ status }` | `{ ok: true }` |
| **Profile Adjustments** | | | |
| GET | `/projects/:pid/profile-adjustments?status=` | — | `ProfileAdjustment[]` |
| POST | `/profile-adjustments` | `ProfileAdjustment` | `ProfileAdjustment` (201) |
| PATCH | `/profile-adjustments/:id/status` | `{ status }` | `{ ok: true }` |

### LLM Proxy Routes

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/models` | — | `{ models: ModelSpec[] }` |
| POST | `/api/generate` | `CompiledPayload` | `{ text, usage, stopReason }` |
| POST | `/api/generate/stream` | `CompiledPayload` | SSE stream |

## SSE Streaming Protocol

The `/api/generate/stream` endpoint uses Server-Sent Events with three event types:

### Event Format

```
data: {"type":"delta","text":"chunk of generated text"}\n\n
data: {"type":"delta","text":"more text"}\n\n
...
data: {"type":"done","usage":{"input_tokens":N,"output_tokens":N},"stopReason":"end_turn"}\n\n
```

### Event Types

| Type | Fields | When |
|------|--------|------|
| `delta` | `{ type: "delta", text: string }` | Each token batch from the LLM |
| `done` | `{ type: "done", usage: object, stopReason: string }` | Generation complete |
| `error` | `{ type: "error", error: string }` | Generation failed |

The client accumulates `delta.text` values to build the full response. The stream ends after either a `done` or `error` event.

### Sampling Parameters

The server applies this precedence: if `temperature` is provided, use it; else if `topP` is provided, use it; else default to `temperature: 0.8`. The Anthropic API forbids sending both `temperature` and `top_p` simultaneously.

## Ring Section Format

The compiler produces ring sections that feed into the budget enforcer:

```typescript
interface RingSection {
  name: string;      // Section identifier (e.g., "HEADER", "VOICE_PROFILE")
  text: string;      // Section content
  priority: number;  // Lower = compressed first (1 is lowest priority)
  immune: boolean;   // If true, never compressed
}
```

### Priority Semantics

- **immune sections** are never removed regardless of budget pressure
- When budget is exceeded, sections are removed in ascending `priority` order
- Compression order: Ring 1 → Ring 2 → Ring 3 (Ring 1 sections compressed first)
- Within a ring, lower-priority sections are removed before higher-priority ones

### Standard Section Names

| Ring | Section Name | Immune | Purpose |
|------|-------------|--------|---------|
| Ring 1 | `HEADER` | yes | System role instruction |
| Ring 1 | `VOICE_PROFILE` | no | Character voice fingerprint |
| Ring 1 | `CHARACTER_DOSSIERS` | no | Character details |
| Ring 1 | `LOCATION_PALETTES` | no | Location sensory palettes |
| Ring 1 | `STYLE_GUIDE` | no | Kill list, preferences |
| Ring 1 | `NARRATIVE_RULES` | no | POV, subtext, exposition rules |
| Ring 2 | `CHAPTER_CONTEXT` | no | Chapter arc and prior scene summaries |
| Ring 2 | `PRIOR_SCENE_IR` | no | Verified IR from completed scenes |
| Ring 3 | `SCENE_PLAN` | yes | Current scene plan |
| Ring 3 | `CONTINUITY_BRIDGE` | no | Last chunk of previous scene |
| Ring 3 | `PRIOR_CHUNKS` | no | Previously generated chunks in this scene |

## Compilation Config

```typescript
interface CompilationConfig {
  modelContextWindow: number;         // Total context window (tokens)
  reservedForOutput: number;          // Tokens reserved for generation
  ring1MaxFraction: number;           // Max fraction of budget for Ring 1
  ring2MaxFraction: number;           // Max fraction of budget for Ring 2
  ring3MinFraction: number;           // Minimum fraction for Ring 3
  ring1HardCap: number;              // Absolute token cap for Ring 1
  bridgeVerbatimTokens: number;      // Tokens for cross-scene bridge text
  bridgeIncludeStateBullets: boolean; // Include reader state bullets in bridge
  maxNegativeExemplarTokens: number;  // Token budget for negative exemplars
  maxNegativeExemplars: number;       // Max number of negative exemplars
  maxPositiveExemplars: number;       // Max number of positive exemplars
  defaultTemperature: number;         // Default generation temperature
  defaultTopP: number;               // Default top-p sampling
  defaultModel: string;              // Default model ID
  sceneTypeOverrides: Record<string, { temperature: number; topP: number }>;
}
```

## Compiled Payload

The final output of the compilation pipeline, sent to the LLM:

```typescript
interface CompiledPayload {
  systemMessage: string;              // Ring 1 assembled text
  userMessage: string;                // Ring 2 + Ring 3 assembled text
  temperature: number;
  topP: number;
  maxTokens: number;
  model: string;
  outputSchema?: Record<string, unknown>;  // For structured output (bootstrap)
}
```

## Key Files

| File | Purpose |
|------|---------|
| `server/api/routes.ts` | REST API route definitions |
| `server/proxy.ts` | LLM proxy + SSE streaming |
| `src/api/client.ts` | Typed browser REST client |
| `src/types/index.ts` | RingSection, CompilationConfig, CompiledPayload |
| `src/compiler/assembler.ts` | Payload assembly from ring sections |
