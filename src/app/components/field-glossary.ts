/**
 * Plain-language glossary for every form field.
 *
 * Each entry provides:
 * - technical: The formal label (shown primary)
 * - plain:     Conversational alternative (shown in parentheses)
 * - tooltip:   1-2 sentence actionable explanation
 * - whyItMatters: Concrete consequence of filling/skipping this field
 * - examples:  2-3 concrete instances (optional)
 * - relatedConcepts: Links to other glossary entries (optional)
 */

export interface GlossaryEntry {
  technical: string;
  plain: string;
  tooltip: string;
  whyItMatters: string;
  examples?: string[];
  relatedConcepts?: string[];
}

export const FIELD_GLOSSARY = {
  // ═══════════════════════════════════════════════════
  //  BIBLE — Foundations
  // ═══════════════════════════════════════════════════

  povDefault: {
    technical: "POV Default",
    plain: "Who Tells the Story",
    tooltip:
      "The default narrative perspective for your project. First person uses 'I', close third stays near one character's thoughts, omniscient can dip into anyone.",
    whyItMatters: "Sets the baseline voice for every scene. Individual scenes can override this.",
    examples: ["First person", "Close third", "Distant third", "Omniscient"],
  },

  povDistance: {
    technical: "POV Distance",
    plain: "Camera Distance",
    tooltip:
      "How close the narration sits to the character's inner experience. Intimate reads like thoughts; distant reads like observation.",
    whyItMatters: "Controls emotional intensity. Intimate creates empathy, distant creates suspense or irony.",
    examples: [
      "Intimate — reader IS the character",
      "Close — reader rides alongside",
      "Distant — reader watches from across the room",
    ],
    relatedConcepts: ["povDefault", "povInteriority"],
  },

  povInteriority: {
    technical: "POV Interiority",
    plain: "Inner Thoughts Access",
    tooltip:
      "How much of the character's internal monologue the reader experiences. Stream is raw thought; behavioral-only shows only actions.",
    whyItMatters: "Stream risks overwriting show-don't-tell. Behavioral-only forces action-driven prose.",
    examples: [
      "Stream — 'God, not her again'",
      "Filtered — 'He dreaded seeing her'",
      "Behavioral only — 'He turned away'",
    ],
    relatedConcepts: ["povDistance"],
  },

  povReliability: {
    technical: "POV Reliability",
    plain: "Narrator Trustworthiness",
    tooltip: "Can the reader trust what the narrator says? Unreliable narrators show distorted versions of events.",
    whyItMatters:
      "Unreliable narrators need careful management to maintain the deception without confusing the reader.",
    examples: ["Reliable — narrator tells it straight", "Unreliable — narrator's account contradicts reality"],
  },

  // ═══════════════════════════════════════════════════
  //  BIBLE — Characters
  // ═══════════════════════════════════════════════════

  characterName: {
    technical: "Name",
    plain: "Character Name",
    tooltip: "The character's name as it appears in prose.",
    whyItMatters: "Used to track this character across scenes and in generated dialogue.",
  },

  characterRole: {
    technical: "Role",
    plain: "Story Role",
    tooltip:
      "Is this character the lead, the rival, support, or background? Affects how much context the compiler allocates.",
    whyItMatters: "Protagonists get more token budget. Minor characters get compressed first when space is tight.",
    examples: ["Protagonist", "Antagonist", "Supporting", "Minor"],
  },

  physicalDescription: {
    technical: "Physical Description",
    plain: "What They Look Like",
    tooltip: "The visual details the reader notices. Focus on distinctive traits, not a police sketch.",
    whyItMatters: "Prevents the AI from inventing conflicting appearances across scenes.",
    examples: ["Crooked nose, always in a lab coat", "Tall, moves like she's apologizing for taking up space"],
  },

  backstory: {
    technical: "Backstory",
    plain: "Their History",
    tooltip: "Key past events that shape how this character behaves now. Brief but specific.",
    whyItMatters: "Gives the AI motivation context — characters with backstory act more consistently.",
    examples: [
      "Grew up in foster care, trusts systems more than people",
      "Former surgeon who lost a patient — now avoids responsibility",
    ],
  },

  vocabularyNotes: {
    technical: "Vocabulary Notes",
    plain: "How They Talk",
    tooltip: "The word choices, sentence patterns, and verbal habits that make this character's voice distinctive.",
    whyItMatters:
      "Without voice notes, all characters sound alike. This is the single biggest lever for distinct dialogue.",
    examples: [
      "Uses technical jargon even in casual speech",
      "Short sentences, never uses adverbs",
      "Speaks in questions, hedges everything",
    ],
    relatedConcepts: ["verbalTics", "dialogueSamples"],
  },

  verbalTics: {
    technical: "Verbal Tics",
    plain: "Speech Habits",
    tooltip: "Repeated words, filler phrases, or patterns this character falls back on.",
    whyItMatters: "Makes dialogue instantly recognizable. Readers learn to 'hear' the character.",
    examples: ["'you know what I mean?'", "'honestly,'", "Starting sentences with 'Look,'"],
    relatedConcepts: ["vocabularyNotes"],
  },

  metaphoricRegister: {
    technical: "Metaphoric Register",
    plain: "Their Comparison Style",
    tooltip: "What kinds of metaphors and similes this character naturally reaches for, based on their background.",
    whyItMatters:
      "A mechanic thinks in engine metaphors. A gardener thinks in growth metaphors. This keeps voice authentic.",
    examples: ["Mechanical/engineering", "Natural/organic", "Military/strategic", "Culinary/sensory"],
  },

  prohibitedLanguage: {
    technical: "Prohibited Language",
    plain: "Words They'd Never Say",
    tooltip: "Specific words or phrases that would break character if this person used them.",
    whyItMatters:
      "Prevents the AI from putting your words in their mouth. A gruff detective shouldn't say 'delightful.'",
    examples: ["'awesome', 'totally'", "'whom', 'nevertheless'", "Any profanity"],
  },

  dialogueSamples: {
    technical: "Dialogue Samples",
    plain: "Example Lines",
    tooltip: "2-5 example dialogue lines that capture how this character speaks. The AI uses these as voice templates.",
    whyItMatters: "Examples teach better than descriptions. One good sample line is worth a paragraph of voice notes.",
    examples: [
      '"Look, I don\'t care what the manual says. Does it work?"',
      '"I suppose one could argue... no, never mind."',
    ],
    relatedConcepts: ["vocabularyNotes", "verbalTics"],
  },

  sentenceLengthRange: {
    technical: "Sentence Length Range",
    plain: "Sentence Rhythm",
    tooltip: "The typical range of sentence lengths for this character's narration or dialogue, in words.",
    whyItMatters:
      "Short sentences create tension. Long sentences create flow. The range defines this character's prose rhythm.",
    relatedConcepts: ["vocabularyNotes"],
  },

  stressResponse: {
    technical: "Stress Response",
    plain: "Under Pressure",
    tooltip: "How this character behaves when cornered, threatened, or overwhelmed.",
    whyItMatters: "Characters who react identically to stress feel flat. This keeps high-tension scenes authentic.",
    examples: [
      "Gets very still and quiet",
      "Talks faster, deflects with humor",
      "Becomes hyper-organized, lists next steps",
    ],
  },

  socialPosture: {
    technical: "Social Posture",
    plain: "Group Dynamics",
    tooltip:
      "How this character positions themselves in social situations — leader, observer, provocateur, peacemaker.",
    whyItMatters:
      "Determines how they interact in multi-character scenes. Prevents everyone acting the same in groups.",
    examples: ["Takes charge immediately", "Hangs back, observes, then acts", "Mediates between others"],
  },

  noticesFirst: {
    technical: "Notices First",
    plain: "What Catches Their Eye",
    tooltip: "When entering a new space or meeting someone, what does this character pay attention to first?",
    whyItMatters: "Reveals character through perception. A cop notices exits. A chef notices what people are eating.",
    examples: [
      "Threat assessment — exits, weapons, positions",
      "People's hands and body language",
      "Aesthetic details — color, light, composition",
    ],
  },

  lyingStyle: {
    technical: "Lying Style",
    plain: "How They Deceive",
    tooltip: "How this character behaves when being dishonest — tells, habits, or strategies.",
    whyItMatters: "Creates dramatic irony when readers can spot the lie before other characters do.",
    examples: [
      "Over-explains, adds unnecessary detail",
      "Gets very still, maintains eye contact too long",
      "Changes the subject with a question",
    ],
  },

  emotionPhysicality: {
    technical: "Emotion Physicality",
    plain: "Body Language for Feelings",
    tooltip:
      "How this character's body expresses emotion — avoiding 'she felt sad' in favor of physical manifestation.",
    whyItMatters:
      "Turns telling into showing. 'She felt angry' becomes 'Her jaw tightened and she set down the glass very carefully.'",
    examples: [
      "Anger → jaw clenches, speaks slowly",
      "Anxiety → picks at cuticles, won't sit still",
      "Joy → talks too fast, gestures expand",
    ],
    relatedConcepts: ["stressResponse"],
  },

  // ═══════════════════════════════════════════════════
  //  BIBLE — Locations
  // ═══════════════════════════════════════════════════

  locationName: {
    technical: "Name",
    plain: "Location Name",
    tooltip: "A recognizable name for this setting.",
    whyItMatters: "Used to link scenes to locations and pull in sensory details automatically.",
  },

  locationDescription: {
    technical: "Description",
    plain: "What Makes It Distinctive",
    tooltip: "The defining character of this place — not a catalog, but the feeling of being there.",
    whyItMatters: "Gives the AI a foundation for scene-setting. Without this, locations get generic descriptions.",
    examples: [
      "A cramped apartment where every surface holds stacked books and cold cups of tea",
      "A brutalist office tower lobby that amplifies every footstep",
    ],
  },

  sounds: {
    technical: "Sounds",
    plain: "What You Hear",
    tooltip: "The ambient noises that define this place. Specific is better than generic.",
    whyItMatters: "Sound grounds the reader in space before visual details do. Specific sounds prevent clichés.",
    examples: ["Fluorescent hum", "Distant highway", "Clock ticking unevenly"],
  },

  smells: {
    technical: "Smells",
    plain: "What You Smell",
    tooltip: "Scents that anchor the reader in this location. Smell triggers memory more than any other sense.",
    whyItMatters:
      "Smell is the most underused and most powerful sense in fiction. One specific scent can set a whole scene.",
    examples: ["Old paper and dust", "Pine cleaner over mildew", "Burnt coffee and ozone"],
  },

  textures: {
    technical: "Textures",
    plain: "What Skin Feels",
    tooltip: "What surfaces and air feel like here. Temperature, humidity, roughness, smoothness.",
    whyItMatters: "Tactile details create physical immersion. Readers unconsciously 'feel' textures as they read.",
    examples: ["Sticky vinyl seats", "Cold tile underfoot", "Gritty wind"],
  },

  lightQuality: {
    technical: "Light Quality",
    plain: "How the Light Behaves",
    tooltip: "The character of illumination in this space — color, intensity, direction, movement.",
    whyItMatters:
      "Light shapes mood more than any decoration. The same room feels different under fluorescent vs. candlelight.",
    examples: [
      "Harsh overhead fluorescent, no shadows",
      "Golden hour through dusty blinds",
      "Blue-white screen glow in darkness",
    ],
  },

  atmosphere: {
    technical: "Atmosphere",
    plain: "The Mood of This Place",
    tooltip: "The emotional quality of being in this space, independent of what's happening in the plot.",
    whyItMatters:
      "Sets reader expectations. A scene in a 'waiting room that feels like an apology' reads differently than 'a sun-drenched café.'",
    examples: ["Oppressive stillness", "Chaotic warmth", "Elegant neglect"],
  },

  prohibitedDefaults: {
    technical: "Prohibited Defaults",
    plain: "Clichés to Avoid Here",
    tooltip: "Generic sensory details that should never be used for this specific location.",
    whyItMatters: "Prevents the AI from falling back on 'the room was dimly lit' or 'birds chirped outside.'",
    examples: ["'musty smell'", "'dim lighting'", "'bustling sounds'"],
  },

  // ═══════════════════════════════════════════════════
  //  BIBLE — Style Guide
  // ═══════════════════════════════════════════════════

  approvedMetaphoricDomains: {
    technical: "Approved Metaphoric Domains",
    plain: "Allowed Metaphor Sources",
    tooltip:
      "Conceptual territories your prose can draw metaphors from. Consistent metaphor domains create cohesive voice.",
    whyItMatters:
      "A noir novel using nature metaphors feels wrong. Keeping domains consistent reinforces genre and tone.",
    examples: ["Machinery, rust, decay", "Water, tides, drowning", "Architecture, foundations, collapse"],
    relatedConcepts: ["prohibitedMetaphoricDomains", "metaphoricRegister"],
  },

  prohibitedMetaphoricDomains: {
    technical: "Prohibited Metaphoric Domains",
    plain: "Forbidden Metaphor Sources",
    tooltip: "Conceptual territories your prose should never draw metaphors from.",
    whyItMatters:
      "Prevents tonal breaks. A grim thriller shouldn't suddenly compare something to 'a field of wildflowers.'",
    examples: ["Flowers, sunshine, rainbows", "Sports, games, competition", "Food, cooking, recipes"],
    relatedConcepts: ["approvedMetaphoricDomains"],
  },

  killList: {
    technical: "Avoid List",
    plain: "Banned Words & Phrases",
    tooltip:
      "Words, phrases, or patterns that should never appear in generated prose. Exact matches catch specific words; structural matches catch patterns.",
    whyItMatters:
      "The single most effective quality control. Catches clichés, filler, and pet peeves before they reach your draft.",
    examples: ['"suddenly" (exact)', '"[character] couldn\'t help but" (structural)', '"it was as if" (structural)'],
  },

  vocabularyPreferences: {
    technical: "Vocabulary Preferences",
    plain: "Word Substitutions",
    tooltip:
      "Preferred terms and what they replace. Use 'said' instead of 'exclaimed.' Use 'walked' instead of 'ambled.'",
    whyItMatters: "Enforces consistent word choice across the entire project without manual editing.",
  },

  structuralBans: {
    technical: "Structural Bans",
    plain: "Banned Sentence Patterns",
    tooltip:
      "Structural patterns that should never appear — rhetorical questions, sentence fragments, em-dash abuse, etc.",
    whyItMatters:
      "Prevents prose habits that weaken writing. Structural patterns are harder to catch than individual words.",
    examples: ["Rhetorical questions", "Em-dash fragments", "Sentences starting with 'It was'"],
  },

  // ═══════════════════════════════════════════════════
  //  SCENE — Core Identity
  // ═══════════════════════════════════════════════════

  sceneTitle: {
    technical: "Title",
    plain: "Scene Name",
    tooltip: "A working title for this scene. It's for your reference, not published.",
    whyItMatters: "Helps you track scenes in the project. Good titles summarize the scene's purpose.",
  },

  povCharacterId: {
    technical: "POV Character",
    plain: "Whose Scene Is This",
    tooltip: "Which character experiences this scene? Their voice, perceptions, and knowledge shape everything.",
    whyItMatters: "Determines which character's voice fingerprint, behavior, and knowledge constraints apply.",
    relatedConcepts: ["scenePovDistance"],
  },

  scenePovDistance: {
    technical: "POV Distance",
    plain: "Camera Distance",
    tooltip:
      "How close the narration sits to this character for this specific scene. Can override the project default.",
    whyItMatters: "Pulling closer creates intimacy for emotional scenes. Pulling back creates suspense for action.",
    relatedConcepts: ["povDistance"],
  },

  narrativeGoal: {
    technical: "Narrative Goal",
    plain: "What This Scene Must Do",
    tooltip:
      "The one thing this scene must accomplish for the story. If it doesn't achieve this, the scene has failed.",
    whyItMatters: "Prevents meandering. Every scene needs a job. This is the scene's contract with the story.",
    examples: [
      "Establish that the protagonist has been lying to themselves",
      "Reveal the antagonist's actual motive",
      "Force an irreversible choice",
    ],
  },

  emotionalBeat: {
    technical: "Emotional Beat",
    plain: "What the Reader Should Feel",
    tooltip: "The primary emotion you want the reader to experience during this scene.",
    whyItMatters:
      "Guides tone, pacing, and word choice. A scene meant to unsettle reads differently than one meant to comfort.",
    examples: ["Growing dread", "Reluctant hope", "Betrayal sinking in", "Quiet devastation"],
  },

  readerEffect: {
    technical: "Reader Effect",
    plain: "How Understanding Shifts",
    tooltip: "What changes in the reader's understanding of the story after this scene ends.",
    whyItMatters:
      "If nothing shifts, the scene might not be earning its place. Even quiet scenes should move understanding forward.",
    examples: [
      "Reader realizes the ally has been compromised",
      "Reader begins to doubt the narrator's version of events",
    ],
    relatedConcepts: ["narrativeGoal"],
  },

  failureModeToAvoid: {
    technical: "Failure Mode to Avoid",
    plain: "The Worst Version of This Scene",
    tooltip: "What's the most likely way this scene could go wrong? Name it so the AI can avoid it.",
    whyItMatters:
      "Negative constraints are surprisingly effective. Telling the AI what NOT to do often works better than positive instructions.",
    examples: [
      "Becomes a therapy session with characters stating feelings directly",
      "Devolves into exposition dump disguised as dialogue",
    ],
  },

  // ═══════════════════════════════════════════════════
  //  SCENE — Reader Knowledge
  // ═══════════════════════════════════════════════════

  readerStateKnows: {
    technical: "Knows",
    plain: "Facts the Reader Has",
    tooltip: "Information the reader has already learned from previous scenes. These are established truths.",
    whyItMatters: "Prevents re-explaining things the reader already knows. Avoids 'as you know, Bob' dialogue.",
    relatedConcepts: ["readerStateSuspects", "readerStateWrongAbout"],
  },

  readerStateSuspects: {
    technical: "Suspects",
    plain: "What the Reader Guesses",
    tooltip: "Things the reader probably suspects but hasn't confirmed. These create anticipation.",
    whyItMatters:
      "Suspicion creates engagement. Confirming or denying suspicions at the right moment creates satisfying reveals.",
    relatedConcepts: ["readerStateKnows", "readerStateWrongAbout"],
  },

  readerStateWrongAbout: {
    technical: "Wrong About",
    plain: "Reader's False Beliefs",
    tooltip: "What the reader currently believes that isn't true. This is the setup for future reveals.",
    whyItMatters: "Dramatic irony depends on managing what the reader gets wrong. This prevents accidental spoilers.",
    examples: ["Reader thinks the mentor is trustworthy", "Reader believes the accident was random"],
    relatedConcepts: ["readerStateKnows", "readerStateSuspects"],
  },

  readerStateActiveTensions: {
    technical: "Active Tensions",
    plain: "Open Questions",
    tooltip: "Unresolved questions or conflicts that are pulling the reader forward through the story.",
    whyItMatters:
      "Tension is what makes readers turn pages. Tracking it ensures you don't accidentally resolve everything too early.",
    examples: ["Will she discover the letter before the wedding?", "Can he maintain the lie under interrogation?"],
  },

  // Exiting state mirrors entering but with "after scene" framing
  readerStateExitingKnows: {
    technical: "Knows",
    plain: "Facts the Reader Has After",
    tooltip: "Information the reader will definitively know after this scene resolves.",
    whyItMatters: "Clarifies what the scene actually delivered versus what it set up.",
    relatedConcepts: ["readerStateKnows", "readerStateExitingSuspects"],
  },

  readerStateExitingSuspects: {
    technical: "Suspects",
    plain: "What the Reader Guesses After",
    tooltip: "New suspicions planted by this scene that the reader hasn't confirmed yet.",
    whyItMatters: "New suspicions create forward momentum into the next scene.",
    relatedConcepts: ["readerStateSuspects", "readerStateExitingKnows"],
  },

  readerStateExitingWrongAbout: {
    technical: "Wrong About",
    plain: "New False Beliefs After",
    tooltip: "Beliefs the reader now holds that aren't true — newly planted or reinforced by this scene.",
    whyItMatters:
      "Tracks misdirection. If the reader exits with the right conclusion too early, you've lost dramatic tension.",
    relatedConcepts: ["readerStateWrongAbout", "readerStateExitingKnows"],
  },

  readerStateExitingActiveTensions: {
    technical: "Active Tensions",
    plain: "Open Questions After",
    tooltip: "Unresolved questions still pulling the reader forward after this scene — some old, some newly created.",
    whyItMatters:
      "Ensures the scene doesn't accidentally close all tension. Readers need unanswered questions to keep turning pages.",
    relatedConcepts: ["readerStateActiveTensions", "readerStateExitingKnows"],
  },

  // ═══════════════════════════════════════════════════
  //  SCENE — Texture
  // ═══════════════════════════════════════════════════

  pacing: {
    technical: "Pacing",
    plain: "Scene Tempo",
    tooltip: "The rhythm and speed of this scene. Describe the shape — slow build, rapid-fire, steady crawl.",
    whyItMatters:
      "Pacing controls reader experience more than plot does. A slow confrontation is more tense than a fast one.",
    examples: [
      "Slow build to explosive confrontation",
      "Relentless, no pauses",
      "Languid opening, sharp acceleration at midpoint",
    ],
  },

  density: {
    technical: "Density",
    plain: "Detail Level",
    tooltip: "How much sensory and descriptive detail to include. Sparse scenes move fast; dense scenes immerse.",
    whyItMatters: "Dense prose in an action scene slows it down. Sparse prose in an emotional scene feels cold.",
    examples: [
      "Sparse — action, dialogue, minimal description",
      "Moderate — balanced",
      "Dense — rich sensory layering",
    ],
  },

  sensoryNotes: {
    technical: "Sensory Notes",
    plain: "Physical Details to Include",
    tooltip:
      "Specific sensory details that should appear in this scene. These anchor the reader in the physical world.",
    whyItMatters:
      "Concrete details prevent generic prose. 'Rain on cobblestones, neon reflecting in puddles' beats 'it was raining.'",
    examples: [
      "Rain on cobblestones, neon reflecting in puddles",
      "Smell of burnt coffee, fluorescent hum",
      "Cold metal railing under bare hands",
    ],
  },

  sceneLocationId: {
    technical: "Location",
    plain: "Where This Happens",
    tooltip: "The physical setting for this scene. Links to a location from your bible for automatic sensory details.",
    whyItMatters:
      "Linked locations automatically pull in sounds, smells, textures, and atmosphere you've already defined.",
  },

  sceneSpecificProhibitions: {
    technical: "Prohibitions",
    plain: "Off-Limits for This Scene",
    tooltip: "Things that must not appear in this specific scene, beyond the global avoid list.",
    whyItMatters: "Scene-specific control. Maybe flashbacks are fine globally but wrong for this particular scene.",
    examples: ["No flashbacks", "No weather descriptions", "No interior monologue"],
  },

  subtextSurface: {
    technical: "Surface Conversation",
    plain: "What They're Saying",
    tooltip: "The visible, literal conversation happening on the page.",
    whyItMatters: "Defines the gap between what's said and what's meant. The bigger the gap, the more tension.",
    relatedConcepts: ["subtextActual", "subtextEnforcement"],
  },

  subtextActual: {
    technical: "Actual Conversation",
    plain: "What They Really Mean",
    tooltip:
      "The real exchange happening beneath the surface words. What each character is actually trying to achieve.",
    whyItMatters: "Subtext is what separates compelling dialogue from on-the-nose writing.",
    relatedConcepts: ["subtextSurface", "subtextEnforcement"],
  },

  subtextEnforcement: {
    technical: "Enforcement Rule",
    plain: "Subtext Boundary",
    tooltip: "The rule that maintains the gap between surface and meaning. What must NOT be said directly.",
    whyItMatters: "Without enforcement, the AI tends to collapse subtext into direct statement. This prevents that.",
    examples: ["Neither character can acknowledge the affair directly", "The word 'cancer' cannot be spoken aloud"],
    relatedConcepts: ["subtextSurface", "subtextActual"],
  },

  anchorLines: {
    technical: "Anchor Lines",
    plain: "Must-Include Lines",
    tooltip: "Specific lines or phrases that should appear in the generated scene. Can be verbatim or paraphrased.",
    whyItMatters: "Guarantees key moments land exactly as you envision them. The AI builds around these anchors.",
  },

  // ═══════════════════════════════════════════════════
  //  SCENE — Structure
  // ═══════════════════════════════════════════════════

  estimatedWordCount: {
    technical: "Estimated Word Count",
    plain: "Scene Length",
    tooltip: "Target word count range for this scene. A range lets the AI expand or compress naturally.",
    whyItMatters: "Prevents scenes from running too long or ending too short. The range gives natural flexibility.",
  },

  chunkCount: {
    technical: "Chunk Count",
    plain: "Generation Passes",
    tooltip: "How many separate generation passes to break this scene into. More chunks = more control points.",
    whyItMatters:
      "Each chunk is a checkpoint where you can review, edit, or redirect. More chunks = finer control, but slower.",
  },

  chunkDescriptions: {
    technical: "Chunk Descriptions",
    plain: "What Happens in Each Chunk",
    tooltip: "Brief description of what each generation pass should cover. Like a mini-outline within the scene.",
    whyItMatters: "Gives the AI a roadmap for each pass. Prevents front-loading all the action into the first chunk.",
    examples: ["Chunk 1: Setup and arrival", "Chunk 2: The confrontation escalates", "Chunk 3: Aftermath and exit"],
  },
} satisfies Record<string, GlossaryEntry>;
