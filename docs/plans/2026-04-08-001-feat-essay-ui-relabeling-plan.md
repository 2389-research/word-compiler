---
title: "feat: Relabel UI from fiction to essay domain"
type: feat
status: active
date: 2026-04-08
origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md
---

# Relabel UI from Fiction to Essay Domain

## Overview

The essay-writer adaptation changed all prompt-level code but left the UI untouched. Every user-facing string still says "Story Bible," "Scene," "Character," "Synopsis," etc. This plan covers the systematic relabeling of ~20 Svelte components and 1 gate file to present essay-appropriate terminology, without changing any component names, CSS classes, variable names, or data model.

## Problem Frame

A user opening Word Compiler for essay writing sees fiction terminology everywhere — "Create Your Story Bible," "Start from Synopsis," "Add Character," "Scene Details." This creates cognitive friction and undermines confidence that the tool is designed for essays. The adaptation requirements doc (see origin) explicitly called out "UI label changes are cosmetic, not structural" as a scope boundary.

## Requirements Trace

- R6. Bootstrap prompt rewritten for essay brief (prompt done; UI labels still fiction)
- R8. ScenePlan structure works for essays when relabeled (data model done; labels still fiction)
- R9. Single "character" represents the author persona (code done; UI still says "Character")
- Origin scope: "Not renaming variables or database columns — internal names stay as-is"
- Origin scope: "UI label changes are cosmetic, not structural"

## Scope Boundaries

- **No component renames** — `SceneSequencer.svelte`, `BibleAuthoringModal.svelte` etc. keep their filenames
- **No variable/prop renames** — `bible`, `scene`, `character` stay as-is in code
- **No CSS class renames** — `.scene-card`, `.bible-title` etc. stay
- **No data model changes** — TypeScript interfaces and SQLite columns unchanged
- **No hiding/removing sections** — Fiction-specific fields (locations, behavior, subtext) stay in the UI since they gracefully degrade when empty. A user who finds them useful for essay structure can still use them.
- **No structural component changes** — No splitting components, no conditional rendering based on mode

## Context & Research

### Relevant Code and Patterns

All changes are string literal replacements in Svelte template markup and one TypeScript file. The mapping follows the convention established in the requirements doc:

| Fiction Term | Essay Term | Notes |
|---|---|---|
| Story Bible | Essay Brief | Primary data structure label |
| Bible (in buttons) | Brief | Shortened form |
| Synopsis | Essay Description | Bootstrap input |
| Scene | Section | Structural unit |
| Character | Author Voice | Single-persona model |
| Chapter | Article/Essay | Top-level container |
| POV Character | Author Voice | Only one "character" in essay mode |
| Narrative Goal | Section Goal | What the section accomplishes |
| Chapter Direction | Essay Direction | Bootstrap input |
| Scene Ending Policy | Section Ending Policy | Narrative rules label |

### Institutional Learnings

- `docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md` — Established the pattern of prompt-only changes. Warns about "domain leak" in immune sections. UI labels are the remaining leak vector.

## Key Technical Decisions

- **Pure string replacement**: Every change is a literal string swap in a `.svelte` template or the `gates/index.ts` file. No logic changes, no conditional rendering, no mode flags. This keeps the blast radius minimal and the changes trivially reviewable.
- **Keep fiction-specific form fields visible**: Fields like "Locations," "Behavior," "Subtext" stay in the UI. They're useful for structured essay planning (locations can be "settings" for personal narrative, behavior can be "author tendencies"). Hiding them adds complexity with no clear benefit since they gracefully degrade when empty.
- **Relabel placeholders and hints**: Fiction-specific placeholder text (e.g., "Marcus Cole, a retired detective...") gets essay-appropriate replacements. Hints that say "character" become "author voice."
- **Deep Audit tooltip**: The fiction-specific tooltip about "characters explicitly stating subtext" gets reworded to "prose stating what should remain implicit" — still accurate for essays.

## Implementation Units

- [ ] **Unit 1: Core labels — Bootstrap, Bible, and workflow stages**

**Goal:** Relabel the highest-visibility UI: the bootstrap welcome screen, bible header, workflow stage prerequisites, and gate messages.

**Requirements:** R6, R8, R9

**Dependencies:** None

**Files:**
- Modify: `src/app/components/stages/BootstrapStage.svelte`
- Modify: `src/app/components/BootstrapModal.svelte`
- Modify: `src/app/components/BibleAuthoringModal.svelte`
- Modify: `src/app/store/workflow.svelte.ts`
- Modify: `src/gates/index.ts`

**Approach:**

`BootstrapStage.svelte`:
- "Create Your Story Bible" → "Create Your Essay Brief"
- "A bible defines your characters, voice rules, and narrative constraints..." → "An essay brief defines your voice, style rules, and structural plan. Choose how to start."
- "Start from Synopsis" → "Start from Description"
- "Paste a synopsis and let the AI extract characters, locations, tone, and style rules." → "Paste your essay idea and let the AI extract your thesis, section structure, tone, and style rules."
- "Build Manually" stays (domain-agnostic)
- "Use the guided form to define characters, voice rules, and narrative constraints step by step." → "Use the guided form to define your voice, style rules, and essay structure step by step."
- "Story Bible vN" → "Essay Brief vN"
- "Edit Bible" → "Edit Brief"

`BootstrapModal.svelte`:
- "Bootstrap Bible from Synopsis" → "Bootstrap Brief from Description"
- Instructions paragraph: rewrite for essay context
- Placeholder: replace fiction synopsis with essay description example
- "Bootstrap Bible" button → "Bootstrap Brief"

`BibleAuthoringModal.svelte`:
- "Bible Authoring" → "Essay Brief Editor"
- "Save Bible" → "Save Brief"

`workflow.svelte.ts`:
- prereqDescription for "plan": "Bible with at least 1 character" → "Brief with author voice defined"
- prereqDescription for "draft": "At least 1 scene plan" → "At least 1 section plan"
- prereqDescription for "export": "At least 1 scene complete" → "At least 1 section complete"

`gates/index.ts`:
- "Create a bible first." → "Create an essay brief first."
- "Add at least 1 character to your bible." → "Add an author voice to your brief."
- "Create at least 1 scene plan with a title and narrative goal." → "Create at least 1 section plan with a title and section goal."
- "Mark at least 1 scene as complete." → "Mark at least 1 section as complete."

**Patterns to follow:**
- Direct string replacement only. No logic changes.

**Test scenarios:**
- Happy path: Gate messages display essay terminology when conditions aren't met (no brief → "Create an essay brief first"; no author voice → "Add an author voice to your brief")
- Happy path: Workflow stage prerequisite descriptions use essay terminology
- Edge case: Gate still passes with the same conditions as before (bible with 1+ characters = brief with author voice)

**Verification:**
- All gate messages read as essay-appropriate
- Workflow stepper shows essay-appropriate prereq descriptions
- Bootstrap welcome screen uses essay terminology throughout

- [ ] **Unit 2: Scene → Section relabeling across all stage components**

**Goal:** Replace "scene" with "section" in all user-facing text across stage components, the scene sequencer, the drafting desk, and the scene authoring modal.

**Requirements:** R8

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Modify: `src/app/components/SceneSequencer.svelte`
- Modify: `src/app/components/SceneAuthoringModal.svelte`
- Modify: `src/app/components/stages/PlanStage.svelte`
- Modify: `src/app/components/stages/DraftStage.svelte`
- Modify: `src/app/components/stages/EditStage.svelte`
- Modify: `src/app/components/stages/AuditStage.svelte`
- Modify: `src/app/components/stages/CompleteStage.svelte`
- Modify: `src/app/components/stages/ExportStage.svelte`
- Modify: `src/app/components/DraftingDesk.svelte`

**Approach:**

`SceneSequencer.svelte`:
- `Scene ${i + 1}` → `Section ${i + 1}`
- "Add new scene" title → "Add new section"
- "New Scene" label → "New Section"

`SceneAuthoringModal.svelte`:
- "Scene Authoring" → "Section Authoring"
- "Generate Scenes" → "Generate Sections"
- "Commit N Scene(s)" → "Commit N Section(s)"
- "Save Scene Plan" → "Save Section Plan"

`PlanStage.svelte`:
- "Scene Details" → "Section Details"
- "+ New Scene" → "+ New Section"
- "No scene selected. Create a scene plan to get started." → "No section selected. Create a section plan to get started."
- "Create Scene Plan" → "Create Section Plan"
- "No characters or locations in bible." → "No author voice or references in brief."

`DraftStage.svelte`:
- "Character Voices" tab → "Voice Analysis"
- Default `baselineSceneTitle` "Scene 1" → "Section 1"

`DraftingDesk.svelte`:
- "Complete Scene" → "Complete Section"
- "Generate all chunks, auto-accept, and complete scene" tooltip → "...complete section"
- "Load a Bible and Scene Plan, then generate your first chunk." → "Load a brief and section plan, then generate your first chunk."
- Deep audit tooltip: "characters explicitly state what should remain subtext" → "prose states what should remain implicit"
- "Extract scene blueprint" → "Extract section blueprint"

`AuditStage.svelte`:
- Same deep audit tooltip fix
- "No prose generated for this scene yet." → "No prose generated for this section yet."

`EditStage.svelte`:
- "No prose generated for this scene yet. Go back to the Draft stage..." → "...this section..."

`CompleteStage.svelte`:
- "Scene Completion" → "Section Completion"
- "Review scene status, inspect narrative records, and mark scenes as complete." → "Review section status, inspect records, and mark sections as complete."
- "No scenes yet. Create scenes in the Plan stage." → "No sections yet. Create sections in the Plan stage."
- "Reopen to Draft" stays (action-oriented, domain-agnostic)

`ExportStage.svelte`:
- "N/N scenes complete" → "N/N sections complete"
- "No prose to export. Generate and complete scenes first." → "...sections first."

**Patterns to follow:**
- Replace only user-visible strings. Leave variable names (`scenePlan`, `sceneChunks`, etc.) unchanged.

**Test scenarios:**
- Happy path: Scene sequencer cards show "Section N" instead of "Scene N"
- Happy path: Plan stage header says "Section Details" and action buttons say "New Section"
- Happy path: Drafting desk empty state references "brief and section plan"
- Happy path: Complete stage title says "Section Completion"
- Happy path: Export stats say "N/N sections complete"

**Verification:**
- Grep all `.svelte` files for user-visible "scene" (case-insensitive, excluding variable names and CSS classes) and confirm none remain in labels, titles, or tooltips

- [ ] **Unit 3: Atlas Bible tab and character/form relabeling**

**Goal:** Relabel the bible detail view and character-related forms for essay context.

**Requirements:** R9

**Dependencies:** None (can be done in parallel with Units 1 and 2)

**Files:**
- Modify: `src/app/components/AtlasBibleTab.svelte`
- Modify: `src/app/components/BibleGuidedFormTab.svelte`

**Approach:**

`AtlasBibleTab.svelte`:
- "No story bible yet." → "No essay brief yet."
- "Create Bible" → "Create Brief"
- "Bootstrap from Synopsis" → "Bootstrap from Description"
- "Characters" section header → "Author Voice"
- "+ Add Character" → "+ Add Author Voice"
- "Filter characters & locations..." → "Filter entries..."
- "Scene Ending Policy" → "Section Ending Policy"

`BibleGuidedFormTab.svelte`:
- Step "Characters" label → "Author Voice"
- "Add Character" → "Add Voice Profile"
- "No characters yet. Add one to get started." → "No author voice yet. Add one to get started."
- "Genre Template" → "Style Template" (if genre templates are fiction-specific, this may need a follow-up to add essay templates, but the label change is cheap)

**Patterns to follow:**
- Replace only user-visible strings in template markup

**Test scenarios:**
- Happy path: Atlas panel shows "Author Voice" section instead of "Characters"
- Happy path: Empty state says "No essay brief yet" with essay-appropriate action buttons
- Happy path: Bible guided form stepper shows "Author Voice" step instead of "Characters"

**Verification:**
- Open the bible tab with and without data; all labels use essay terminology

- [ ] **Unit 4: Scene bootstrap and guided form relabeling**

**Goal:** Relabel the scene bootstrap tab and scene guided form for essay sections.

**Requirements:** R6, R8

**Dependencies:** None (can be done in parallel)

**Files:**
- Modify: `src/app/components/SceneBootstrapTab.svelte`
- Modify: `src/app/components/SceneGuidedFormTab.svelte`

**Approach:**

`SceneBootstrapTab.svelte`:
- "Chapter Direction" → "Essay Direction"
- Placeholder: "A tense confrontation between Marcus and Elena..." → "An essay exploring why most productivity advice fails knowledge workers, building from personal experience to systemic critique..."
- "Scene Count" → "Section Count"
- "Scene N of M" → "Section N of M"
- "Review Scene N of M" → "Review Section N of M"
- "Also generate Chapter Arc" → "Also generate Essay Arc"
- "Additional Constraints" placeholder: "No violence in the first scene..." → "Save the strongest argument for the final section, open with a personal anecdote..."

`SceneGuidedFormTab.svelte`:
- "Scene title" placeholder → "Section title"
- "POV Character" → "Author Voice"
- "Select character..." → "Select voice..."
- "Character ID or name" → "Voice profile"
- "Narrative Goal" → "Section Goal"
- "What must this scene accomplish?" → "What must this section accomplish?"
- "Emotional Beat" → "Reader Effect" (or keep — it's borderline)
- "Failure Mode to Avoid" stays (domain-agnostic)
- "Sensory Notes" placeholder: "Rain on cobblestones..." → "The fluorescent-lit open office, coffee rings on printouts..."
- "Characters physically in this scene" → "Voices referenced in this section"
- "Present Characters" → "Referenced Voices"

**Patterns to follow:**
- Replace user-visible strings only. Leave variable names unchanged.

**Test scenarios:**
- Happy path: Scene bootstrap form shows "Essay Direction" label and essay-appropriate placeholder
- Happy path: "Section Count" label with correct input binding
- Happy path: Scene guided form shows "Section Goal" instead of "Narrative Goal"
- Happy path: Progress bar shows "Section N of M" during generation

**Verification:**
- Walk through the full scene bootstrap flow; all visible text uses essay terminology
- Walk through the guided form; all labels and hints use essay terminology

- [ ] **Unit 5: App header and miscellaneous labels**

**Goal:** Update the app header and any remaining scattered fiction references.

**Requirements:** Origin scope

**Dependencies:** None

**Files:**
- Modify: `src/app/App.svelte`

**Approach:**

The app header shows "Word Compiler" — this is the product name and should stay. The project title ("Ai Essay Series" in the screenshot) is user-editable and already correct.

Check for any remaining fiction-specific welcome text:
- "Welcome to Word Compiler. Create your first project to get started." — this is domain-agnostic, keep as-is

No changes needed in `App.svelte`. This unit is a verification sweep.

**Test expectation:** none — verification sweep only, no behavioral change expected

**Verification:**
- Grep all `.svelte` and gate `.ts` files for remaining fiction-specific user-visible strings: "story bible", "synopsis" (in labels, not variables), "character" (in labels, not variables), "scene" (in labels, not variables), "chapter" (in labels, not variables)
- Confirm the app header is domain-agnostic

## System-Wide Impact

- **Interaction graph:** Changes are purely presentational. No callbacks, middleware, or data flow affected.
- **Error propagation:** Gate messages change text but not logic. Same conditions trigger the same gates.
- **State lifecycle risks:** None. No state changes.
- **API surface parity:** No API changes. Server endpoints are untouched.
- **Integration coverage:** No cross-layer interactions changed.
- **Unchanged invariants:** All TypeScript interfaces, SQLite schema, component props, CSS classes, variable names, and gate logic remain identical. Only user-visible string literals change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Missing a fiction-specific string | Final verification sweep (Unit 5) greps all files for residual fiction terms |
| Breaking test assertions that check for specific strings | Grep test files for any hardcoded fiction strings that match changed labels; update if found |
| Genre templates in BibleGuidedFormTab are fiction-specific | Out of scope for this plan — genre templates are a separate concern that can be addressed later with essay-specific templates |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md](docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)
- Related learning: [docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md](docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md)
- Related PR: #1 (essay writer adaptation — merged)
