# Bible & Versioning

The Bible is the single source of style truth. It defines how prose should sound, who the characters are, what the world looks like, and what language to avoid. Every compilation reads from the Bible; every learner proposal writes to it.

## Bible Schema (`src/types/index.ts`)

```typescript
interface Bible {
  id: string;
  projectId: string;
  version: number;
  characters: CharacterDossier[];
  locations: Location[];
  styleGuide: StyleGuide;
  narrativeRules: NarrativeRules;
}
```

### Characters (`CharacterDossier`)

Each character has:
- Identity: name, role (protagonist/antagonist/supporting/minor)
- Physical description, backstory
- **Voice**: vocabulary notes, verbal tics, metaphoric register, prohibited language, dialogue samples, sentence length range
- **Behavior**: stress response, social posture, notices first, lying style, emotion physicality

### Locations (`Location`)

Each location has:
- Name, description
- **Sensory palette**: sounds, smells, textures, light quality, atmosphere, prohibited defaults

### Style Guide (`StyleGuide`)

- **Kill list**: `{ pattern, type: "exact" | "structural" }[]` — words/phrases to avoid
- **Vocabulary preferences**: `{ preferred, insteadOf }[]` — word substitutions
- **Metaphoric register**: approved and prohibited domains
- **Sentence architecture**: target variance, fragment policy
- **Paragraph policy**: max sentences, single-sentence frequency
- **Structural bans**: patterns like "rhetorical questions in narration"
- **Exemplars**: reference prose passages with analysis

### Narrative Rules (`NarrativeRules`)

- **POV**: default, distance, interiority, reliability
- **Subtext policy**: how characters communicate indirectly
- **Exposition policy**: how backstory is revealed
- **Time handling**: flashback policy, temporal markers

## Versioning (`src/bible/versioning.ts`)

Every Bible save increments the version number. The system tracks all versions for comparison and rollback.

### Key Functions

| Function | Purpose |
|----------|---------|
| `createBibleVersion(bible)` | Creates a new version snapshot |
| `diffBibles(oldBible, newBible)` | Returns a structured diff of changes between two Bible versions |

### Diff Output

`diffBibles` returns a `BibleDiff` with:
- Characters added/removed/changed
- Locations added/removed/changed
- Kill list entries added/removed
- Style guide changes
- Narrative rule changes

## Mutation Sources

The Bible can be modified through three channels:

### 1. Author Edits (direct)
The Bible Authoring modal provides a guided form with stepper:
1. **Foundations** — POV settings (default, distance, interiority, reliability)
2. **Characters** — Add/edit character dossiers with voice and behavior sections
3. **Locations** — Add/edit locations with sensory palettes
4. **Style Guide** — Kill list, vocabulary preferences, metaphoric register, structural bans
5. **Review** — Summary counts + full JSON preview

### 2. Learner Proposals (indirect)
The revision learner observes author edits and proposes Bible changes:
- "Add *suddenly* to avoid list" (from repeated CUT_FILLER edits)
- "Update character voice notes" (from consistent voice corrections)

Proposals require explicit author acceptance before modifying the Bible.

### 3. Genre Templates (bootstrap)
Four genre templates provide pre-filled defaults:
- **Literary Fiction**: intimate POV, high sentence variance, subtext-heavy
- **Thriller**: fast pacing, short paragraphs, behavioral POV
- **Romance**: stream-of-consciousness, emotional interiority
- **Science Fiction**: world-building through sensory detail

Templates use fill-blank merge: they only populate empty/default fields, never overwriting author-set values.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Bible, CharacterDossier, Location, StyleGuide types |
| `src/bible/versioning.ts` | `createBibleVersion`, `diffBibles` |
| `src/bootstrap/genres.ts` | Genre templates + `applyGenreTemplate` |
| `src/app/components/BibleAuthoringModal.svelte` | Bible editing UI |
