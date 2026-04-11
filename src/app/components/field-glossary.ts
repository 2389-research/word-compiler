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
  //  BRIEF — Foundations
  // ═══════════════════════════════════════════════════

  povDefault: {
    technical: "POV Default",
    plain: "Writing Perspective",
    tooltip:
      "The default perspective for your essay. First person uses 'I' for personal essays. Analytical perspective maintains distance. Personal narrative blends reflection with story.",
    whyItMatters: "Sets the baseline voice for every section. Individual sections can override this.",
    examples: ["First person", "Close analytical", "Distant analytical", "Omniscient survey"],
  },

  povDistance: {
    technical: "POV Distance",
    plain: "Perspective Distance",
    tooltip:
      "How close the writing sits to the author's personal experience. Intimate reads like confession; distant reads like analysis.",
    whyItMatters:
      "Controls emotional intensity. Intimate creates connection, distant creates authority or objectivity.",
    examples: [
      "Intimate — reader shares the author's inner experience",
      "Close — reader follows the author's reasoning",
      "Distant — reader observes from an analytical vantage point",
    ],
    relatedConcepts: ["povDefault", "povInteriority"],
  },

  povInteriority: {
    technical: "POV Interiority",
    plain: "Inner Thoughts Access",
    tooltip:
      "How much of the author's internal reasoning the reader experiences. Stream is raw thought; behavioral-only shows only evidence and actions.",
    whyItMatters: "Stream risks self-indulgence. Evidence-only forces argument-driven prose.",
    examples: [
      "Stream — 'I couldn't stop thinking about what went wrong'",
      "Filtered — 'The pattern was hard to ignore'",
      "Evidence only — 'The data pointed in one direction'",
    ],
    relatedConcepts: ["povDistance"],
  },

  povReliability: {
    technical: "POV Reliability",
    plain: "Author Trustworthiness",
    tooltip:
      "Can the reader trust the author's account? Self-aware essays acknowledge biases; unreliable accounts omit inconvenient evidence.",
    whyItMatters:
      "An author who acknowledges limitations builds credibility. One who doesn't risks losing the reader's trust.",
    examples: ["Reliable — author is transparent about biases", "Unreliable — author omits contradictory evidence"],
  },

  // ═══════════════════════════════════════════════════
  //  BRIEF — Voice Profiles
  // ═══════════════════════════════════════════════════

  characterName: {
    technical: "Name",
    plain: "Voice Profile Name",
    tooltip: "The name for this voice profile as it appears in the essay.",
    whyItMatters: "Used to track this voice across sections and in generated prose.",
  },

  characterRole: {
    technical: "Role",
    plain: "Voice Role",
    tooltip:
      "Is this the primary author voice, a counterpoint, supporting perspective, or background reference? Affects how much context the compiler allocates.",
    whyItMatters: "Primary voices get more token budget. Minor voices get compressed first when space is tight.",
    examples: ["Primary Author", "Counterpoint Voice", "Supporting", "Minor"],
  },

  physicalDescription: {
    technical: "Author Bio",
    plain: "Who This Writer Is",
    tooltip:
      "Key details about this voice's background, expertise, or credentials. Focus on what shapes their perspective.",
    whyItMatters: "Prevents the AI from inventing conflicting credentials or backgrounds across sections.",
    examples: [
      "Former policy analyst, now independent journalist",
      "Academic researcher with field experience in urban planning",
    ],
  },

  backstory: {
    technical: "Background",
    plain: "Their Context",
    tooltip: "Key experiences or expertise that shape how this voice approaches the subject. Brief but specific.",
    whyItMatters: "Gives the AI perspective context -- voices with background write more consistently.",
    examples: [
      "Spent a decade in corporate consulting before becoming a critic of the industry",
      "Self-taught programmer who learned by building, distrusts formal credentials",
    ],
  },

  vocabularyNotes: {
    technical: "Vocabulary Notes",
    plain: "How They Write",
    tooltip: "The word choices, sentence patterns, and stylistic habits that make this voice distinctive.",
    whyItMatters:
      "Without voice notes, all writing sounds the same. This is the single biggest lever for distinct prose.",
    examples: [
      "Uses technical jargon even when explaining to general audiences",
      "Short sentences, never uses adverbs",
      "Writes in questions, hedges everything",
    ],
    relatedConcepts: ["verbalTics", "dialogueSamples"],
  },

  verbalTics: {
    technical: "Verbal Tics",
    plain: "Writing Habits",
    tooltip: "Repeated words, transitional phrases, or patterns this voice falls back on.",
    whyItMatters: "Makes the voice instantly recognizable. Readers learn to identify the writer's rhythm.",
    examples: ["'the thing is,'", "'honestly,'", "Starting paragraphs with 'Look,'"],
    relatedConcepts: ["vocabularyNotes"],
  },

  metaphoricRegister: {
    technical: "Metaphoric Register",
    plain: "Their Comparison Style",
    tooltip: "What kinds of metaphors and analogies this voice naturally reaches for, based on their background.",
    whyItMatters:
      "A technologist thinks in systems metaphors. An economist thinks in market metaphors. This keeps voice authentic.",
    examples: ["Technology/systems", "Natural/organic", "Architecture/construction", "Economic/market"],
  },

  prohibitedLanguage: {
    technical: "Prohibited Language",
    plain: "Words They'd Never Use",
    tooltip: "Specific words or phrases that would break voice if this writer used them.",
    whyItMatters:
      "Prevents the AI from inserting language that clashes with the voice. A terse essayist should never write 'delightfully nuanced.'",
    examples: ["'delve', 'landscape', 'robust'", "'whom', 'nevertheless'", "Corporate buzzwords"],
  },

  dialogueSamples: {
    technical: "Writing Samples",
    plain: "Example Passages",
    tooltip: "2-5 example passages that capture how this voice writes. The AI uses these as style templates.",
    whyItMatters:
      "Examples teach better than descriptions. One good sample passage is worth a paragraph of voice notes.",
    examples: [
      "\"The problem isn't that we lack data. The problem is we've stopped asking what the data means.\"",
      '"I suppose one could argue the opposite. But then one would have to ignore everything that happened next."',
    ],
    relatedConcepts: ["vocabularyNotes", "verbalTics"],
  },

  sentenceLengthRange: {
    technical: "Sentence Length Range",
    plain: "Sentence Rhythm",
    tooltip: "The typical range of sentence lengths for this voice's prose, in words.",
    whyItMatters:
      "Short sentences create urgency. Long sentences create flow. The range defines this voice's prose rhythm.",
    relatedConcepts: ["vocabularyNotes"],
  },

  stressResponse: {
    technical: "Stress Response",
    plain: "Under Pressure",
    tooltip: "How this voice shifts when addressing contentious or high-stakes topics.",
    whyItMatters: "Voices that handle every topic identically feel flat. This keeps high-stakes sections authentic.",
    examples: [
      "Gets more precise and measured",
      "Writes faster, deploys sarcasm",
      "Becomes hyper-organized, enumerates counterarguments",
    ],
  },

  socialPosture: {
    technical: "Social Posture",
    plain: "Rhetorical Stance",
    tooltip:
      "How this voice positions itself relative to the reader -- authority, collaborator, provocateur, mediator.",
    whyItMatters:
      "Determines how the voice engages with opposing viewpoints. Prevents every section sounding the same.",
    examples: [
      "Asserts authority immediately",
      "Invites the reader to reason alongside",
      "Mediates between competing positions",
    ],
  },

  noticesFirst: {
    technical: "Notices First",
    plain: "What They Focus On",
    tooltip: "When approaching a new topic, what does this voice pay attention to first?",
    whyItMatters:
      "Reveals perspective through attention. An economist notices incentives. A designer notices user experience.",
    examples: [
      "Structural incentives -- who benefits, who pays",
      "Human impact and lived experience",
      "Aesthetic details -- form, craft, composition",
    ],
  },

  lyingStyle: {
    technical: "Evasion Style",
    plain: "How They Hedge",
    tooltip: "How this voice behaves when addressing uncomfortable evidence or weak points in their argument.",
    whyItMatters: "Creates transparency when readers can spot the hedging. Authentic voices acknowledge weak points.",
    examples: [
      "Over-qualifies, adds excessive caveats",
      "Pivots to a stronger related point",
      "Acknowledges the weakness head-on, then reframes",
    ],
  },

  emotionPhysicality: {
    technical: "Emotion Physicality",
    plain: "Concrete Detail Style",
    tooltip:
      "How this voice grounds abstract arguments in physical, concrete detail -- avoiding 'it felt important' in favor of tangible evidence.",
    whyItMatters:
      "Turns abstraction into persuasion. 'It was significant' becomes 'The spreadsheet showed a 40% drop in three months.'",
    examples: [
      "Conviction --> precise data, specific dates",
      "Doubt --> hypotheticals, conditional phrasing",
      "Urgency --> short declaratives, present tense",
    ],
    relatedConcepts: ["stressResponse"],
  },

  // ═══════════════════════════════════════════════════
  //  BRIEF — Reference Contexts
  // ═══════════════════════════════════════════════════

  locationName: {
    technical: "Name",
    plain: "Reference Context Name",
    tooltip: "A recognizable name for this reference context or setting.",
    whyItMatters: "Used to link sections to reference contexts and pull in sensory details automatically.",
  },

  locationDescription: {
    technical: "Description",
    plain: "What Makes It Distinctive",
    tooltip:
      "The defining quality of this context -- not a catalog, but the feeling of being there or engaging with it.",
    whyItMatters: "Gives the AI a foundation for grounding prose. Without this, references get generic descriptions.",
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
    tooltip: "Scents that anchor the reader in this context. Smell triggers memory more than any other sense.",
    whyItMatters:
      "Concrete details ground abstract arguments. One specific sensory detail can anchor an entire section.",
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
    tooltip: "The quality of illumination in this space -- color, intensity, direction, movement.",
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
    tooltip: "The emotional quality of being in this space, independent of what's happening in the argument.",
    whyItMatters:
      "Sets reader expectations. A section grounded in 'a waiting room that feels like an apology' reads differently than 'a sun-drenched café.'",
    examples: ["Oppressive stillness", "Chaotic warmth", "Elegant neglect"],
  },

  prohibitedDefaults: {
    technical: "Prohibited Defaults",
    plain: "Clichés to Avoid Here",
    tooltip: "Generic sensory details that should never be used for this specific context.",
    whyItMatters: "Prevents the AI from falling back on 'the room was dimly lit' or 'birds chirped outside.'",
    examples: ["'musty smell'", "'dim lighting'", "'bustling sounds'"],
  },

  // ═══════════════════════════════════════════════════
  //  BRIEF — Style Guide
  // ═══════════════════════════════════════════════════

  approvedMetaphoricDomains: {
    technical: "Approved Metaphoric Domains",
    plain: "Allowed Metaphor Sources",
    tooltip:
      "Conceptual territories your prose can draw metaphors from. Consistent metaphor domains create cohesive voice.",
    whyItMatters:
      "A tech essay using nature metaphors feels scattered. Keeping domains consistent reinforces voice and subject authority.",
    examples: ["Technology, systems, networks", "Architecture, foundations, collapse", "Economics, markets, flows"],
    relatedConcepts: ["prohibitedMetaphoricDomains", "metaphoricRegister"],
  },

  prohibitedMetaphoricDomains: {
    technical: "Prohibited Metaphoric Domains",
    plain: "Forbidden Metaphor Sources",
    tooltip: "Conceptual territories your prose should never draw metaphors from.",
    whyItMatters:
      "Prevents tonal breaks. A serious policy essay shouldn't suddenly compare something to 'a field of wildflowers.'",
    examples: ["Flowers, sunshine, rainbows", "Sports, games, competition", "Food, cooking, recipes"],
    relatedConcepts: ["approvedMetaphoricDomains"],
  },

  killList: {
    technical: "Avoid List",
    plain: "Banned Words & Phrases",
    tooltip:
      "Words, phrases, or patterns that should never appear in generated prose. Exact matches catch specific words; structural matches catch patterns.",
    whyItMatters:
      "The single most effective quality control. Catches AI slop, filler, and pet peeves before they reach your draft.",
    examples: ['"delve" (exact)', '"it is worth noting that" (structural)', '"in conclusion" (structural)'],
  },

  vocabularyPreferences: {
    technical: "Vocabulary Preferences",
    plain: "Word Substitutions",
    tooltip:
      "Preferred terms and what they replace. Use 'shows' instead of 'demonstrates.' Use 'but' instead of 'however.'",
    whyItMatters: "Enforces consistent word choice across the entire project without manual editing.",
  },

  structuralBans: {
    technical: "Structural Bans",
    plain: "Banned Sentence Patterns",
    tooltip:
      "Structural patterns that should never appear -- throat-clearing openers, rhetorical questions, em-dash abuse, etc.",
    whyItMatters:
      "Prevents prose habits that weaken writing. Structural patterns are harder to catch than individual words.",
    examples: [
      "Throat-clearing openers",
      "Restating the conclusion in each paragraph",
      "Sentences starting with 'It is important to note'",
    ],
  },

  // ═══════════════════════════════════════════════════
  //  SECTION — Core Identity
  // ═══════════════════════════════════════════════════

  sceneTitle: {
    technical: "Title",
    plain: "Section Name",
    tooltip: "A working title for this section. It's for your reference, not necessarily published.",
    whyItMatters: "Helps you track sections in the project. Good titles summarize the section's purpose.",
  },

  povCharacterId: {
    technical: "Author Voice",
    plain: "Whose Section Is This",
    tooltip: "Which voice profile drives this section? Their style, perspective, and expertise shape everything.",
    whyItMatters: "Determines which voice profile's fingerprint, style rules, and perspective constraints apply.",
    relatedConcepts: ["scenePovDistance"],
  },

  scenePovDistance: {
    technical: "Perspective Distance",
    plain: "Perspective Distance",
    tooltip:
      "How close the writing sits to the author's personal experience for this specific section. Can override the project default.",
    whyItMatters:
      "Pulling closer creates intimacy for personal sections. Pulling back creates authority for analytical sections.",
    relatedConcepts: ["povDistance"],
  },

  narrativeGoal: {
    technical: "Section Goal",
    plain: "What This Section Must Do",
    tooltip:
      "The one thing this section must accomplish for the essay. If it doesn't achieve this, the section has failed.",
    whyItMatters: "Prevents meandering. Every section needs a job. This is the section's contract with the essay.",
    examples: [
      "Establish that the conventional wisdom is wrong",
      "Present the strongest counterargument and address it",
      "Force the reader to reconsider their assumptions",
    ],
  },

  emotionalBeat: {
    technical: "Emotional Beat",
    plain: "What the Reader Should Feel",
    tooltip: "The primary emotion you want the reader to experience during this section.",
    whyItMatters:
      "Guides tone, pacing, and word choice. A section meant to unsettle reads differently than one meant to reassure.",
    examples: ["Growing unease", "Reluctant agreement", "Surprise at contradictory evidence", "Quiet conviction"],
  },

  readerEffect: {
    technical: "Reader Effect",
    plain: "How Understanding Shifts",
    tooltip: "What changes in the reader's understanding of the argument after this section ends.",
    whyItMatters:
      "If nothing shifts, the section might not be earning its place. Even quiet sections should move understanding forward.",
    examples: [
      "Reader realizes the common explanation is insufficient",
      "Reader begins to see the author's reasoning as more nuanced than expected",
    ],
    relatedConcepts: ["narrativeGoal"],
  },

  failureModeToAvoid: {
    technical: "Failure Mode to Avoid",
    plain: "The Worst Version of This Section",
    tooltip: "What's the most likely way this section could go wrong? Name it so the AI can avoid it.",
    whyItMatters:
      "Negative constraints are surprisingly effective. Telling the AI what NOT to do often works better than positive instructions.",
    examples: [
      "Becomes a listicle restating obvious points without analysis",
      "Devolves into abstract generalities without concrete evidence",
    ],
  },

  // ═══════════════════════════════════════════════════
  //  SECTION — Reader Knowledge
  // ═══════════════════════════════════════════════════

  readerStateKnows: {
    technical: "Knows",
    plain: "Facts the Reader Has",
    tooltip: "Information the reader has already absorbed from previous sections. These are established truths.",
    whyItMatters:
      "Prevents re-explaining things the reader already knows. Avoids redundant re-statements of earlier points.",
    relatedConcepts: ["readerStateSuspects", "readerStateWrongAbout"],
  },

  readerStateSuspects: {
    technical: "Suspects",
    plain: "What the Reader Guesses",
    tooltip: "Things the reader probably suspects but hasn't seen confirmed. These create anticipation.",
    whyItMatters:
      "Suspicion creates engagement. Confirming or denying suspicions at the right moment creates satisfying reveals.",
    relatedConcepts: ["readerStateKnows", "readerStateWrongAbout"],
  },

  readerStateWrongAbout: {
    technical: "Wrong About",
    plain: "Reader's False Beliefs",
    tooltip: "What the reader currently believes that isn't true. This is the setup for future reveals or reframings.",
    whyItMatters:
      "Argumentative power depends on managing what the reader gets wrong. This prevents premature conclusions.",
    examples: ["Reader thinks the conventional explanation is sufficient", "Reader believes the trend is recent"],
    relatedConcepts: ["readerStateKnows", "readerStateSuspects"],
  },

  readerStateActiveTensions: {
    technical: "Active Tensions",
    plain: "Open Questions",
    tooltip: "Unresolved questions or tensions that are pulling the reader forward through the essay.",
    whyItMatters:
      "Tension is what keeps readers engaged. Tracking it ensures you don't accidentally resolve everything too early.",
    examples: [
      "Will the proposed solution actually work at scale?",
      "Is the author's optimism justified by the evidence?",
    ],
  },

  // Exiting state mirrors entering but with "after section" framing
  readerStateExitingKnows: {
    technical: "Knows",
    plain: "Facts the Reader Has After",
    tooltip: "Information the reader will definitively know after this section resolves.",
    whyItMatters: "Clarifies what the section actually delivered versus what it set up.",
    relatedConcepts: ["readerStateKnows", "readerStateExitingSuspects"],
  },

  readerStateExitingSuspects: {
    technical: "Suspects",
    plain: "What the Reader Guesses After",
    tooltip: "New suspicions planted by this section that the reader hasn't confirmed yet.",
    whyItMatters: "New suspicions create forward momentum into the next section.",
    relatedConcepts: ["readerStateSuspects", "readerStateExitingKnows"],
  },

  readerStateExitingWrongAbout: {
    technical: "Wrong About",
    plain: "New False Beliefs After",
    tooltip: "Beliefs the reader now holds that aren't true -- newly planted or reinforced by this section.",
    whyItMatters:
      "Tracks misdirection. If the reader reaches the right conclusion too early, you've lost argumentative tension.",
    relatedConcepts: ["readerStateWrongAbout", "readerStateExitingKnows"],
  },

  readerStateExitingActiveTensions: {
    technical: "Active Tensions",
    plain: "Open Questions After",
    tooltip:
      "Unresolved questions still pulling the reader forward after this section -- some old, some newly created.",
    whyItMatters:
      "Ensures the section doesn't accidentally close all tension. Readers need unanswered questions to keep reading.",
    relatedConcepts: ["readerStateActiveTensions", "readerStateExitingKnows"],
  },

  // ═══════════════════════════════════════════════════
  //  SECTION — Texture
  // ═══════════════════════════════════════════════════

  pacing: {
    technical: "Pacing",
    plain: "Section Tempo",
    tooltip: "The rhythm and speed of this section. Describe the shape -- slow build, rapid-fire, steady crawl.",
    whyItMatters:
      "Pacing controls reader experience more than argument does. A slow build to a key insight is more persuasive than rushing.",
    examples: [
      "Slow build to decisive argument",
      "Relentless, no pauses",
      "Reflective opening, sharp acceleration at the key evidence",
    ],
  },

  density: {
    technical: "Density",
    plain: "Detail Level",
    tooltip: "How much evidence and descriptive detail to include. Sparse sections move fast; dense sections immerse.",
    whyItMatters:
      "Dense prose in a transitional section slows it down. Sparse prose in a key argument feels unsubstantiated.",
    examples: [
      "Sparse -- assertions, evidence, minimal elaboration",
      "Moderate -- balanced",
      "Dense -- rich evidence layering and analysis",
    ],
  },

  sensoryNotes: {
    technical: "Sensory Notes",
    plain: "Physical Details to Include",
    tooltip:
      "Specific concrete details that should appear in this section. These anchor abstract arguments in the physical world.",
    whyItMatters:
      "Concrete details prevent generic prose. 'The spreadsheet showed a 40% drop' beats 'things were declining.'",
    examples: [
      "The sound of the factory floor during the interview",
      "Smell of burnt coffee in the newsroom",
      "Cold metal railing outside the courthouse",
    ],
  },

  sceneLocationId: {
    technical: "Reference Context",
    plain: "Where This Happens",
    tooltip:
      "The setting or context for this section. Links to a reference context from your brief for automatic sensory details.",
    whyItMatters:
      "Linked contexts automatically pull in sounds, smells, textures, and atmosphere you've already defined.",
  },

  sceneSpecificProhibitions: {
    technical: "Prohibitions",
    plain: "Off-Limits for This Section",
    tooltip: "Things that must not appear in this specific section, beyond the global avoid list.",
    whyItMatters: "Section-specific control. Maybe anecdotes are fine globally but wrong for this analytical section.",
    examples: ["No personal anecdotes", "No statistics without sources", "No rhetorical questions"],
  },

  subtextSurface: {
    technical: "Surface Argument",
    plain: "What's Being Said",
    tooltip: "The explicit, stated argument happening on the page.",
    whyItMatters: "Defines the gap between what's stated and what's implied. The bigger the gap, the more tension.",
    relatedConcepts: ["subtextActual", "subtextEnforcement"],
  },

  subtextActual: {
    technical: "Actual Argument",
    plain: "What's Really Being Argued",
    tooltip: "The real point being made beneath the surface argument. What the author is actually trying to achieve.",
    whyItMatters: "Subtext is what separates compelling essays from on-the-nose writing.",
    relatedConcepts: ["subtextSurface", "subtextEnforcement"],
  },

  subtextEnforcement: {
    technical: "Enforcement Rule",
    plain: "Subtext Boundary",
    tooltip: "The rule that maintains the gap between surface and meaning. What must NOT be stated directly.",
    whyItMatters: "Without enforcement, the AI tends to collapse subtext into direct statement. This prevents that.",
    examples: [
      "The real target of criticism cannot be named explicitly",
      "The personal stake cannot be stated outright",
    ],
    relatedConcepts: ["subtextSurface", "subtextActual"],
  },

  anchorLines: {
    technical: "Anchor Lines",
    plain: "Must-Include Lines",
    tooltip: "Specific lines or phrases that should appear in the generated section. Can be verbatim or paraphrased.",
    whyItMatters: "Guarantees key moments land exactly as you envision them. The AI builds around these anchors.",
  },

  // ═══════════════════════════════════════════════════
  //  SECTION — Structure
  // ═══════════════════════════════════════════════════

  estimatedWordCount: {
    technical: "Estimated Word Count",
    plain: "Section Length",
    tooltip: "Target word count range for this section. A range lets the AI expand or compress naturally.",
    whyItMatters: "Prevents sections from running too long or ending too short. The range gives natural flexibility.",
  },

  chunkCount: {
    technical: "Chunk Count",
    plain: "Generation Passes",
    tooltip: "How many separate generation passes to break this section into. More chunks = more control points.",
    whyItMatters:
      "Each chunk is a checkpoint where you can review, edit, or redirect. More chunks = finer control, but slower.",
  },

  chunkDescriptions: {
    technical: "Chunk Descriptions",
    plain: "What Happens in Each Chunk",
    tooltip: "Brief description of what each generation pass should cover. Like a mini-outline within the section.",
    whyItMatters:
      "Gives the AI a roadmap for each pass. Prevents front-loading all the key points into the first chunk.",
    examples: [
      "Chunk 1: Context and setup",
      "Chunk 2: Core argument with evidence",
      "Chunk 3: Implications and transition",
    ],
  },
} satisfies Record<string, GlossaryEntry>;
