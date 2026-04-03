# Word Compiler Workflow Guide

A task-oriented guide to writing fiction with Word Compiler. For technical internals, see `docs/architecture/`.

---

## Quick Start

1. **Create a project** — On first launch you'll see a welcome screen. Click "Create Project". If you already have projects, the Project List appears instead — click "New Project".

2. **Bootstrap** — The app starts on the Bootstrap stage. You have two options:
   - **Start from Synopsis** — Paste a synopsis and let the LLM generate characters, locations, tone, and a kill list. Pick a genre template (literary fiction, thriller, sci-fi, fantasy) to pre-fill sensible defaults.
   - **Build Manually** — Open the guided form and fill in everything step by step. Good when you already know your world.

3. **Plan** — Navigate to the Plan stage (unlocked after your bible has at least 1 character). Click "+ New Scene" to open the Scene Authoring modal:
   - **AI Bootstrap** — Describe the chapter direction, set a scene count, select characters and locations, and generate. The LLM produces scene plans with continuity between them.
   - **Guided Form** — Manually fill in every field: POV, narrative goal, emotional beat, subtext, reader state, chunk descriptions, etc.

4. **Draft** — Navigate to the Draft stage (unlocked after at least 1 scene plan). The Drafting Desk is front and center:
   - **Generate Chunk** — Produces the next chunk of prose using the compiled context (bible + scene plan + previous chunks). Review, edit, then accept or reject.
   - **Autopilot** — Generates all remaining chunks automatically, accepting each one.

5. **Audit** — Navigate to the Audit stage (unlocked after at least 1 chunk is generated). Run quality checks:
   - **Run Audit** — Deterministic: kill list violations, sentence length variance, paragraph length, signal-to-noise ratio.
   - **Deep Audit** — LLM-assisted subtext compliance check. Flags lines where characters say the quiet part out loud.
   - Resolve or dismiss flags inline.

6. **Edit** — Navigate to the Edit stage (unlocked when all critical flags are resolved). Revise prose with editorial review annotations — squiggly underlines for local checks and LLM-suggested improvements. Accept, dismiss, or refine suggestions inline.

7. **Complete** — Navigate to the Complete stage (available after the Edit stage). Mark scenes as complete, extract Scene IR for cross-scene analysis.

8. **Export** — Navigate to the Export stage (unlocked after at least 1 scene is marked complete). Choose markdown or plaintext format. Copy to clipboard or download.

---

## The Stages

The app uses a 7-stage workflow. Navigate between stages via the **WorkflowRail** (the horizontal stepper below the header). Stages unlock progressively as prerequisites are met.

| Stage | Unlocked When | Purpose |
|-------|--------------|---------|
| Bootstrap | Always | Create and edit your story bible |
| Plan | Bible has >= 1 character | Author scene plans, set chapter arcs |
| Draft | >= 1 scene plan exists | Generate and review prose chunks |
| Audit | >= 1 chunk generated | Quality checks, flag resolution |
| Edit | All critical flags resolved | Revise prose with editorial review annotations |
| Complete | Always (after Edit unlocks) | Mark scenes done, extract IR |
| Export | >= 1 scene marked complete | Export prose to markdown/plaintext |

**Keyboard shortcuts:** `Ctrl+1` through `Ctrl+7` navigate to each stage (if unlocked). `Ctrl+Enter` advances to the next unlocked stage.

### Bootstrap Stage
Your project's foundation. When no bible exists, you see two entry cards: "Start from Synopsis" (AI-assisted) and "Build Manually" (guided form). Once a bible exists, you see the bible summary with "Edit Bible" and "Re-bootstrap" actions.

### Plan Stage
Two-column layout. Left: Scene Sequencer (horizontal strip of scene cards) + scene detail view (the Atlas Scene tab). Right: reference panel with character/location cards and setup/payoff coverage. Use "+ New Scene" to author scene plans.

### Draft Stage
Two-column layout. Left: Scene Sequencer + Drafting Desk (where prose happens). Right: tabbed context panel with Draft Engine (compiled payload), Voice Consistency, Character Voices, and Setups. Model selector appears in the header during Draft.

### Audit Stage
Two-column layout. Left: read-only prose view with inline audit flags. Right: tabbed analysis with Reader Journey, Voice Drift, Voices, Setups, and Learner. "Run Audit" and "Deep Audit" buttons in the toolbar.

### Edit Stage
Two-column layout. Left: rich text editor (TipTap/ProseMirror) with editorial review annotations — squiggly underlines for local checks (kill list violations, sentence variance, paragraph length) and LLM-suggested improvements. Right: annotation panel with accept/dismiss/refine actions. Inline refinement popover for applying AI-suggested rewrites.

### Complete Stage
Single-column summary. Scene cards showing status, chunk count, word count, audit flag counts, and IR extraction badge. "Mark Complete" / "Reopen to Draft" actions per scene.

### Export Stage
Format selector (Markdown/Plain Text), word count, scene completion stats. Warnings for unresolved audit flags. Copy to Clipboard or Download actions. Full prose preview.

---

## Key Concepts

### The Three Rings
The context compiler builds the LLM prompt in three rings:
- **Ring 1** — System message: project voice, tone, kill list, global rules.
- **Ring 2** — Chapter context: bible characters/locations relevant to this chapter, chapter arc.
- **Ring 3** — Scene context: scene plan, previous chunks, continuity bridge from prior scene.

When the total exceeds the token budget, the compiler compresses rings in priority order (R1 first, then R2, then R3) by removing non-immune sections.

### Chunks
A scene is composed of multiple chunks (typically 3-5). Each chunk is a passage of prose, usually 300-800 words. Chunks are generated sequentially — each new chunk sees all previous chunks in the Ring 3 context.

### Gates
Quality checkpoints that enforce workflow discipline:
- **Scene Plan Gate** — Validates the plan has required fields before drafting.
- **Compile Gate** — Ensures the context compiles without critical lint errors.
- **Chunk Review Gate** — Checks that chunks are reviewed before generating more.
- **Scene Completion Gate** — Requires all chunks accepted and audit flags resolved.
- **Audit Resolution Gate** — Validates audit flag resolution before marking complete.
- **Bible Versioning Gate** — Ensures bible changes are versioned.

### Subtext
Each scene plan can define subtext rules:
- **Surface conversation** — What characters appear to be discussing.
- **Actual conversation** — What's really being communicated underneath.
- **Enforcement rule** — How to maintain the gap between surface and actual.

The Deep Audit checks whether your prose violates these rules by having characters state the subtext explicitly.

---

## Common Tasks

### Adding a scene to an existing chapter
Navigate to the Plan stage. Click "+ New Scene". Set Scene Count to **1** in the AI Bootstrap tab. Existing scenes are untouched — the new plan is appended.

### Editing the bible
Navigate to the Bootstrap stage. Click "Edit Bible" to open the authoring modal, or "Re-bootstrap" to regenerate from a new synopsis. The bible version increments on save.

### Switching between projects
Click "Projects" in the header (visible when you have 2+ projects). Your current project state is preserved in the database.

### Using genre templates
When bootstrapping a bible via "Start from Synopsis", select a genre template before generating. The template pre-fills tone, metaphoric domains, pacing notes, and a starter kill list appropriate to the genre.

### Exporting your work
Navigate to the Export stage. Choose format:
- **Markdown** — Scene titles as headings, preserves formatting.
- **Plaintext** — Clean text with scene breaks, no markup.

Click "Copy to Clipboard" or "Download" to get your prose.
