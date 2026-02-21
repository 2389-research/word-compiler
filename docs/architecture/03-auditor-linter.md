# Auditor & Linter

Two complementary systems enforce prose quality: the **linter** validates the compilation payload *before* generation, and the **auditor** analyzes the generated prose *after* generation.

## Linter (`src/linter/index.ts`)

The linter runs on the assembled payload and returns `{ issues: LintIssue[] }`. Each issue has a `code`, `severity` (error | warning), and `message`.

### 12 Lint Checks

| Code | Severity | What It Checks |
|------|----------|---------------|
| `R1_OVER_CAP` | warning | Ring 1 exceeds allocated budget |
| `R2_OVER_CAP` | warning | Ring 2 exceeds allocated budget |
| `R3_STARVED` | error | Ring 3 has insufficient budget after compression |
| `NO_SYSTEM_MSG` | error | System message is empty |
| `NO_USER_MSG` | error | User message is empty |
| `NO_SCENE_PLAN` | error | Scene plan section missing from Ring 3 |
| `NO_VOICE` | warning | No voice profile in Ring 1 |
| `NO_CHARACTERS` | warning | No character dossiers in Ring 1 |
| `BUDGET_EXCEEDED` | error | Total tokens exceed available budget |
| `EMPTY_KILL_LIST` | warning | Bible has no avoid list entries |
| `DUPLICATE_SECTIONS` | error | Same section name appears twice |
| `IMMUNE_REMOVED` | error | An immune section was compressed (should never happen) |

## Auditor (`src/auditor/`)

The auditor runs on generated chunks and produces `AuditFlag[]` entries. Each flag has severity, category, message, and resolution state.

### Core Auditor (`src/auditor/index.ts`)

| Check | Category | What It Finds |
|-------|----------|--------------|
| Kill list scan | `kill-list` | Avoid list violations in generated text |
| Sentence variance | `sentence-variance` | Low variance = monotonous rhythm |
| Paragraph length | `paragraph-length` | Paragraphs exceeding max sentence count |

`auditChunk(chunk, bible)` returns `AuditFlag[]`.

### Epistemic Auditor (`src/auditor/epistemic.ts`)

Detects hedging language and epistemic markers that weaken prose:
- "seemed to", "appeared to", "couldn't help but"
- "a sense of", "something like", "in a way"

Category: `epistemic-hedge`

### Setup/Payoff Tracker (`src/auditor/setup-payoff.ts`)

Cross-scene analysis that tracks narrative setups planted in earlier scenes and whether they've been paid off in later scenes. Reports dangling setups (planted but never resolved).

Uses verified `NarrativeIR` data (`setupsPlanted`, `payoffsExecuted`).

### Subtext Analyzer (`src/auditor/subtext.ts`)

Evaluates whether dialogue has sufficient gap between surface meaning and subtext. Flags dialogue that is too "on the nose" — characters saying exactly what they mean without subtext.

### Trust Tracking (`src/auditor/trust-tracking.ts`)

`getAuditStats(flags)` computes aggregate trust metrics:
- Total flags, resolved count, actionable count
- Used by the audit resolution gate to determine scene completeness

## Key Types

```typescript
interface AuditFlag {
  id: string;
  sceneId: string;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  lineReference: string | null;
  resolved: boolean;
  resolvedAction: string | null;  // "fixed" | "dismissed" | "deferred"
  wasActionable: boolean | null;
}
```

## Data Flow

```
Compiled Payload ──▶ Linter ──▶ LintResult (pre-generation)
                                      │
                                      ▼
                              Generation blocked if errors
                                      │
                                      ▼
Generated Chunk ──▶ Auditor ──▶ AuditFlag[] (post-generation)
                                      │
                                      ▼
                              Author resolves each flag
                                      │
                                      ▼
                              Audit Resolution Gate
```
