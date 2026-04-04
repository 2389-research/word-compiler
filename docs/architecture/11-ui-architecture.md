# UI Architecture

The UI is built with Svelte 5, using its runes-based reactivity system (`$state`, `$derived`, `$effect`) instead of the older store-based patterns.

## Svelte 5 Reactivity

| Rune | Purpose | React Equivalent |
|------|---------|-----------------|
| `$state` | Reactive state declaration | `useState` |
| `$derived` / `$derived.by()` | Computed values | `useMemo` |
| `$effect` | Side effects on dependency change | `useEffect` |
| `$props()` | Component props | function parameters |
| `{#snippet}` / `{@render}` | Render delegation | render props / children |

## ProjectStore (`src/app/store/project.svelte.ts`)

The central state container is a class-based store using `$state` fields:

```typescript
class ProjectStore {
  // Reactive fields
  project = $state<Project | null>(null);
  chapterArc = $state<ChapterArc | null>(null);
  scenes = $state<SceneEntry[]>([]);
  activeSceneIndex = $state(0);
  sceneChunks = $state<Record<string, Chunk[]>>({});
  bible = $state<Bible | null>(null);
  // ... 20+ fields

  // Derived getters
  get activeScene(): SceneEntry | null { ... }
  get activeScenePlan(): ScenePlan | null { ... }
  get activeSceneChunks(): Chunk[] { ... }
  get previousSceneLastChunk(): Chunk | null { ... }
}
```

### State Categories

- **Project-level**: project, chapterArc, scenes, bible, bibleVersions
- **Config**: compilationConfig, availableModels
- **Active scene derived**: compiledPayload, compilationLog, lintResult, auditFlags, metrics
- **UI state**: isGenerating, isAutopilot, extractingIRSceneId, selectedChunkIndex, modal open flags, error

### Key Methods (~30)

The store provides methods for all state mutations: scene management, chunk operations, Bible updates, IR handling, audit flag resolution, modal control, and project switching.

## Reactive Effects

### Auto-Recompile (`src/app/store/compiler.svelte.ts`)

An `$effect` watches the active scene plan, Bible, compilation config, and prior scene chunks. When any dependency changes, it synchronously recompiles the prompt payload:

```
scenePlan + bible + config + priorChunks ──$effect──▶ compiledPayload + lintResult
```

This is instant because compilation is pure and synchronous (no network calls).

### Async Generation (`src/app/store/generation.svelte.ts`)

Manages SSE streaming for chunk generation:
- Connects to `/api/generate/stream`
- Accumulates `delta` events into chunk text
- Handles `done` and `error` events
- Supports autopilot mode (automatic sequential chunk generation)
- Abort controller for cancellation

## Component Architecture

### 40 Components (`src/app/components/`)

| Component | Purpose |
|-----------|---------|
| `App.svelte` | Root: project list, workspace, modals |
| `ProjectList.svelte` | Multi-project selector |
| `DraftingDesk.svelte` | Main editing workspace |
| `SceneSequencer.svelte` | Scene list with status indicators |
| `ChunkCard.svelte` | Individual chunk display + editing |
| `CompilerView.svelte` | Ring inspector (compiled payload) |
| `AuditPanel.svelte` | Audit flag list with resolution |
| `IRInspector.svelte` | Narrative IR viewer |
| `AtlasPane.svelte` | Project Atlas — Bible, Scene Plan, Chapter Arc editors |
| `LearnerPanel.svelte` | Edit patterns + proposals + tuning |
| `SetupPayoffPanel.svelte` | Cross-scene setup/payoff tracker |
| `StyleDriftPanel.svelte` | Style drift metrics |
| `VoiceSeparabilityView.svelte` | Voice separability analysis |
| `ForwardSimulator.svelte` | Reader state projection |
| `ChapterArcEditor.svelte` | Chapter arc form |
| `BootstrapModal.svelte` | AI Bible bootstrap |
| `BibleAuthoringModal.svelte` | Guided Bible editing with stepper |
| `SceneAuthoringModal.svelte` | AI scene plan bootstrap |
| `ExportModal.svelte` | Export with format selection |
| `GlossaryPanel.svelte` | Glossary management |
| `CharacterCard.svelte` | Character display card |
| `CharacterFormFields.svelte` | Character editing form fields |
| `LocationCard.svelte` | Location display card |
| `LocationFormFields.svelte` | Location editing form fields |
| `ProseEditor.svelte` | Rich prose editing |
| `AnnotatedEditor.svelte` | Editor with inline annotations |
| `AnnotationTooltip.svelte` | Tooltip for annotations |
| `ReaderStateCard.svelte` | Reader epistemic state display |
| `ReaderStateFields.svelte` | Reader state form fields |
| `RefinementPopover.svelte` | Inline refinement popover |
| `AtlasArcTab.svelte` | Atlas pane — chapter arc tab |
| `AtlasBibleTab.svelte` | Atlas pane — Bible tab |
| `AtlasJsonTab.svelte` | Atlas pane — JSON inspector tab |
| `AtlasSceneTab.svelte` | Atlas pane — scene tab |
| `BibleBootstrapTab.svelte` | Bible bootstrap tab |
| `BibleGuidedFormTab.svelte` | Bible guided form tab |
| `SceneBootstrapTab.svelte` | Scene bootstrap tab |
| `SceneGuidedFormTab.svelte` | Scene guided form tab |
| `StageCTA.svelte` | Stage call-to-action |
| `VoiceProfilePanel.svelte` | Voice profile display and editing |
| `WorkflowRail.svelte` | Workflow stage navigation rail |

### 26 Primitives (`src/app/primitives/`)

Reusable UI building blocks:

- **Layout**: Pane, SectionPanel, CollapsibleSection, Modal, Tabs
- **Input**: Button, Input, TextArea, Select, RadioGroup, TagInput, NumberRange, FormField, AdvancedToggle
- **Display**: Badge, MetricCard, Table, DiagnosticItem, ProgressBar, SegmentedBar, Spinner, CardList, ErrorBanner, ExamplesDrawer, TruncatedProse
- **Navigation**: Stepper

### Styling

Global CSS variables and shared classes in `src/app/styles/index.css` (~250 lines). Component-specific styles use Svelte's scoped `<style>` blocks.

## Startup Flow (`src/app/store/startup.ts`)

```
initializeApp()
  ├── fetch available models
  ├── list projects
  │   ├── single project → loadProject(id)
  │   └── multiple → show ProjectList
  └── loadProject(id)
        ├── fetch project, chapter arcs, bible, bible versions
        ├── fetch scenes for first chapter
        └── for each scene: fetch chunks, audit flags, audit stats, IR, edit patterns
```

## Key Files

| File | Purpose |
|------|---------|
| `src/app/store/project.svelte.ts` | ProjectStore: 20+ `$state` fields, 30 methods |
| `src/app/store/compiler.svelte.ts` | Auto-recompile `$effect` |
| `src/app/store/generation.svelte.ts` | SSE streaming + autopilot |
| `src/app/store/startup.ts` | `initializeApp`, `loadProject` |
| `src/app/App.svelte` | Root component |
| `src/app/components/` | 40 feature components |
| `src/app/primitives/` | 26 reusable UI primitives |
| `src/app/styles/index.css` | Global CSS variables and shared classes |
