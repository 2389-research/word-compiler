# Stage-Gated UX Redesign

**Date:** 2026-02-24
**Status:** Proposed
**Prerequisite:** Merge PR #9 (Atlas Pane redesign + scene-character linking)

---

## Problem

The current UI shows everything at once regardless of workflow stage: 3 JSON editors, 7 analysis tabs, 10+ header controls, scene sequencer, and a 3-column layout visible at all times. Users describe it as a "power-user situation" that feels like operating a space shuttle.

The app has a clear sequential workflow (bootstrap → plan → draft → audit → complete → export), but the UI does not reflect it.

## Design Principles

1. **Progressive disclosure** — show only what matters for the current stage.
2. **Hard gates** — future stages are locked until prerequisites are met. The UI teaches the workflow.
3. **Per-section advanced toggles** — power users expand JSON editors or extra options granularly. No global "Expert Mode."
4. **Prompt-to-advance** — when prerequisites are met, a "Continue to [Next Stage]" CTA appears. No auto-navigation.
5. **Dissolved Atlas** — no persistent left column. Each stage owns its data editing inline.
6. **Modals become workspaces** — Bootstrap, Bible Authoring, and Scene Authoring are inline stage content, not modal overlays.

---

## Layout Architecture

### Permanent Elements

1. **Header bar** — Project title (clickable to rename), word count badge, theme toggle, settings menu. Stage-specific actions injected contextually (e.g., model selector in Draft, export scope in Export).
2. **Workflow Rail** — Horizontal stepper below the header: `Bootstrap > Plan > Draft > Audit > Complete > Export`. Each step shows an icon, label, and status (locked / active / complete). Hard-gated: future steps disabled until prerequisites pass.
3. **Stage CTA** — "Continue to [Next Stage]" button appears when the current stage's prerequisites are met.

### Variable Element

4. **Stage Workspace** — The entire area below the rail. Changes per stage. Each stage defines its own layout (single-column, two-column, or whatever fits).

### What Disappears

- Always-visible Scene Sequencer → moves into Plan and Draft stages only
- 7-tab navigation bar → tabs become per-stage context panels
- Persistent Atlas left column → dissolved into Bootstrap/Plan stages
- Packed header → model selector to Draft, export to Export, chapter arc to Plan

### What Appears

- Per-section "Advanced" toggles on any panel (reveals JSON editors or extra options)
- Stage prerequisite indicators (what's needed to unlock the next stage)
- Smooth transitions between stages (fade or slide)

---

## Stage Details

### Bootstrap

**Purpose:** Create or import the project bible.

**Layout:** Single-column, centered content.

**What's visible:**
- Genre template selector (literary fiction, thriller, sci-fi, fantasy) at the top.
- Two paths presented as large cards:
  - **"Start from Synopsis"** — Text area for synopsis, "Generate Bible" button. Streams the LLM-generated bible into a live preview below.
  - **"Build Manually"** — Guided Bible form inline (characters, locations, tone, kill list). Uses PR #9's character cards, location cards, and guided form tabs.
- **"Import Bible"** — Tertiary button to load from JSON file.

**Advanced toggle:** Expands a JSON editor below the form for direct editing.

**Prerequisites to unlock Plan:** Bible must exist with at least one character.

**CTA:** "Continue to Plan"

---

### Plan

**Purpose:** Structure chapters, arcs, and scenes.

**Layout:** Two-column. Left: scene sequencer + scene editing. Right: reference panel.

**What's visible:**
- **Scene Sequencer** (horizontal strip) appears here. "+" button to add scenes.
- **Chapter Arc editor** inline — timeline view of the arc.
- Clicking a scene opens the **Scene Authoring form** inline (two modes: AI Bootstrap tab, Guided Form tab — from PR #9 and current SceneAuthoringModal).
- Right panel: **reference cards** — characters, locations, and a lightweight "setup coverage" indicator (which setups are planted but lack payoffs).

**Advanced toggles:** Scene Plan JSON editor, Chapter Arc JSON editor, Bible JSON editor (read-only reference).

**Prerequisites to unlock Draft:** At least one scene plan with required fields filled (passes scene plan gate).

**CTA:** "Start Drafting"

---

### Draft

**Purpose:** Generate and review prose chunk by chunk.

**Layout:** Two-column. Center: Drafting Desk (~65%). Right: contextual insights (~35%).

**What's visible:**
- **Scene Sequencer** at the top (switch between scenes).
- **Model selector** in the header (Draft stage only).
- **Drafting Desk** (center): Chunk cards with accept/edit/reject controls, "Generate Chunk" button, "Autopilot" toggle. Essentially unchanged from the current DraftingDesk component.
- **Context Insights** (right) — scoped tabs:
  - **Compiled Context** — Compilation log, token budget bar, lint results (current "Draft Engine" tab content).
  - **Voice** — Voice Consistency + Character Voices combined into one panel with two collapsible sections.
  - **Setups** — Active setups to plant/payoff for this scene.
- Audit triggers as per-chunk micro-actions: small "Run Audit" and "Deep Audit" buttons on each chunk card.

**Advanced toggles:** Full compiled payload JSON, Bible/ScenePlan JSON reference panels.

**Prerequisites to unlock Audit:** At least one chunk must be generated.

**CTA:** "Review & Audit"

---

### Audit

**Purpose:** Quality review and analysis of drafted prose.

**Layout:** Two-column. Left: read-only prose with inline audit markers. Right: analysis reports and resolution queues.

**What's visible:**
- **Prose view** (left): Scene chunks displayed read-only with audit flag annotations inline (highlighted spans for kill list violations, epistemic leaks, etc.). Click a flag to see details and resolve.
- **Analysis panel** (right) — full set of analysis tabs:
  - **Audit Flags** — Flag queue with resolve/dismiss actions, signal-to-noise meter.
  - **Reader Journey** — Full forward simulator view.
  - **Voice Consistency** — Style drift report with scene-by-scene comparison.
  - **Setups** — Setup/payoff registry with unresolved tracking.
  - **Learner** — Edit pattern analysis, bible proposals, tuning suggestions.
- **Batch actions:** "Run All Audits" button at the top of the analysis panel.

**Advanced toggles:** Scene IR JSON, full audit stats breakdown.

**Prerequisites to unlock Complete:** All critical audit flags resolved.

**CTA:** "Complete Scene"

---

### Complete

**Purpose:** Finalize the scene, extract IR, lock it.

**Layout:** Single-column with summary cards.

**What's visible:**
- **Scene Summary card** — Title, chunk count, word count, audit stats (resolved/total), voice consistency score.
- **IR Extraction** — "Extract Scene Blueprint" button. Shows narrative IR summary: events, character deltas, facts introduced, setups planted/paid off.
- **Regression check** — If other scenes exist, shows whether completing this scene creates setup/payoff orphans or arc inconsistencies.
- **Actions:** "Mark Complete" (locks the scene), "Reopen to Draft" (unlocks it).

**Prerequisites to unlock Export:** At least one scene marked complete.

---

### Export

**Purpose:** Export the manuscript.

**Layout:** Two-column. Left: format options. Right: live preview.

**What's visible:**
- **Format selector** — Markdown or Plaintext.
- **Scope selector** — Current scene, current chapter, or full manuscript.
- **Preview pane** — Live rendered preview.
- **Export button** — Downloads the file.
- **Warnings** — Banner if any scenes have unresolved flags or incomplete status.

---

## Analysis Tab Mapping

| Current Tab | Stage(s) | Presentation |
|---|---|---|
| Draft Engine | Draft | "Compiled Context" section in right panel |
| Scene Blueprint (IR) | Complete | IR extraction and summary view |
| Reader Journey | Audit | Full forward simulator in analysis panel |
| Voice Consistency | Draft (lightweight) + Audit (full report) | Draft: badge + collapsible section. Audit: full report |
| Character Voices | Draft (as Voice subsection) | Combined with Voice Consistency |
| Setups | Plan (coverage indicator) + Draft (active setups) + Audit (registry) | Adapted per stage |
| Learner | Audit | Edit patterns + tuning proposals in analysis panel |

---

## Prerequisite Gates

| Gate | Condition | Unlocks |
|---|---|---|
| Bootstrap → Plan | Bible exists with ≥1 character | Plan stage |
| Plan → Draft | ≥1 scene plan passes scene plan gate | Draft stage |
| Draft → Audit | ≥1 chunk generated | Audit stage |
| Audit → Complete | All critical audit flags resolved | Complete stage |
| Complete → Export | ≥1 scene marked complete | Export stage |

---

## Per-Section Advanced Toggles

Instead of a global Expert Mode, each panel can have an "Advanced" toggle that expands additional content:

| Panel | Advanced Content |
|---|---|
| Bootstrap Bible form | Raw Bible JSON editor |
| Plan scene editor | Scene Plan JSON editor |
| Plan chapter arc | Chapter Arc JSON editor |
| Plan reference panel | Bible JSON (read-only) |
| Draft compiled context | Full payload JSON |
| Draft insights | Bible/ScenePlan JSON reference |
| Audit analysis | Scene IR JSON, raw stats |
| Complete IR view | Full IR JSON |

Advanced toggle state is persisted per-user in localStorage. Writers never touch them; power users leave their favorites open.

---

## Rollout Plan

### Phase 1 — Foundation (1-2 sprints)

- **Merge PR #9** — Tabbed Atlas, guided forms, character/location cards are prerequisite components.
- Create `WorkflowStage` type + `workflowStore` (Svelte runes) with prerequisite checking logic.
- Build `WorkflowRail` component (horizontal stepper).
- Wire up hard gates: disable locked stages, show prerequisite tooltips.
- Implement the **Draft stage** workspace first (closest to current layout, heaviest usage, least disruptive).
- Stage-scope the analysis tabs: show only Draft-relevant tabs during Draft.

### Phase 2 — Stage Workspaces (2 sprints)

- Dissolve Atlas into **Bootstrap** and **Plan** stages.
- Convert Bootstrap/Bible/Scene authoring modals into inline stage workspaces.
- Build **Audit** stage with read-only prose view + inline flag annotations.
- Build **Complete** and **Export** stages.
- Add per-section "Advanced" toggles throughout.
- Move scene sequencer into Plan/Draft only.
- Implement "Continue to [Next]" CTA logic with prerequisite checking.

### Phase 3 — Polish (1 sprint)

- Animated stage transitions (fade/slide).
- Keyboard shortcuts for stage navigation.
- Persist Advanced toggle preferences in localStorage.
- Update E2E tests for new navigation flow.
- Update `docs/workflow.md` to reflect new stage-based UI.

---

## Migration Notes

- The current "all at once" layout effectively becomes what you'd see if every Advanced toggle were open and gates were bypassed. No functionality is removed.
- Existing data flows and API patterns are unchanged. This is purely a view-layer refactoring.
- The `store` architecture (project.svelte.ts, commands.ts) stays the same. The new `workflowStore` is additive.
- Components like DraftingDesk, CompilerView, ForwardSimulator, etc. are reused as-is within their stage workspaces.

---

## Industry Precedent

- **Scrivener:** Navigator + Editor + Inspector with context-aware right panel.
- **Ulysses:** Focused writing mode with optional metadata drawer.
- **Arc Studio:** Outline / Write / Review workspace modes.
- **Obsidian:** Hides YAML frontmatter in collapsible sections.
- **Sudowrite:** Inline AI suggestions with side insights panel.

All follow the pattern: simple default, power on demand.
