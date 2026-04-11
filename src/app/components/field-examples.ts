/**
 * Rich examples for the most complex form fields.
 *
 * Each example set targets a single fieldId and contains 2–4 examples
 * mixing genres, example types, and failure modes.
 *
 * Example types:
 * - "surface_subtext" — shows the field in action across layers
 * - "pitfall"         — common mistake and how to fix it
 * - "good_better_best"— graduated quality comparison
 * - "technique"       — a specific craft technique for the field
 */

export interface FieldExample {
  type: "surface_subtext" | "pitfall" | "good_better_best" | "technique";
  genreTags?: string[];
  title: string;
  content: string;
  explanation: string;
}

export const FIELD_EXAMPLES: Record<string, FieldExample[]> = {
  // ═══════════════════════════════════════════════════
  //  1. Subtext — Surface / Actual / Enforcement
  // ═══════════════════════════════════════════════════

  subtextSurface: [
    {
      type: "surface_subtext",
      genreTags: ["personal essay", "op-ed"],
      title: "The Diplomatic Critique",
      content:
        "Surface: The author praises a policy initiative's ambition and scope.\nActual: The author is building the case that the initiative will fail.\nEnforcement: The essay cannot use the word 'failure' or 'impossible' until the final section.",
      explanation:
        "The surface argument is generous and fair-minded. The tension lives entirely in what ISN'T stated. Every compliment carries the weight of the coming reversal.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Common Mistake: Collapsing the Gap",
      content:
        '❌ BAD: "The policy sounds promising," the author writes, really meaning: this will never work.\n✅ BETTER: "The policy sounds promising." Then a paragraph of quietly devastating evidence.',
      explanation:
        "Never narrate the subtext directly. The moment you explain what you 'really mean,' the subtext collapses into text. Let the reader do the work.",
    },
    {
      type: "good_better_best",
      genreTags: ["personal essay"],
      title: "Graduated Subtext Depth",
      content:
        "GOOD: Surface = reflecting on a childhood memory.\nBETTER: Surface = reflecting on a childhood memory. Actual = processing a recent loss through the lens of the past.\nBEST: Surface = reflecting on a childhood memory. Actual = processing a recent loss. Enforcement = the loss cannot be named until the final paragraph.",
      explanation:
        "The enforcement rule is what creates tension. Without it, the author can just state the real point and the section deflates.",
    },
  ],

  subtextActual: [
    {
      type: "technique",
      genreTags: ["op-ed", "personal essay"],
      title: "Mapping the Hidden Argument",
      content:
        "For each section, answer: What is the author ACTUALLY arguing? What evidence are they AFRAID undermines their point? What would they NEVER state outright?\n\nExample -- an essay praising remote work:\nActually arguing: The office was always about control, not productivity.\nAfraid of: Data showing some teams do better in person.\nWould never state: 'Managers who want return-to-office are insecure.'",
      explanation:
        "The actual argument isn't just 'what you really mean.' It's the hidden thesis, the inconvenient evidence, and the rhetorical boundary, all operating simultaneously.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "One-Sided Subtext",
      content:
        "❌ BAD: Only the author has a hidden argument. The counterargument is just... stated flatly.\n✅ BETTER: BOTH the author's position and the counterargument have depth and nuance. The tension comes from two valid perspectives colliding.",
      explanation:
        "Subtext works best when both sides have substance. When only the author's view has depth, the counterargument becomes a strawman.",
    },
  ],

  subtextEnforcement: [
    {
      type: "technique",
      genreTags: ["personal essay", "op-ed", "analytical"],
      title: "Writing Effective Enforcement Rules",
      content:
        "Strong enforcement rules are specific and testable:\n✅ 'The real subject of criticism cannot be named until the third section'\n✅ 'The personal stake cannot be stated outright'\n✅ 'No direct comparison to the competitor until evidence is laid'\n\nWeak rules are vague:\n❌ 'Don't be too on-the-nose'\n❌ 'Keep it subtle'",
      explanation:
        "An enforcement rule should be something you can point to in the prose and say 'this line violates the rule' or 'this line respects it.' Vague rules are unenforceable.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  2. Section Goal
  // ═══════════════════════════════════════════════════

  narrativeGoal: [
    {
      type: "good_better_best",
      genreTags: ["personal essay", "op-ed"],
      title: "Sharpening the Section's Job",
      content:
        "GOOD: 'Introduce the counterargument.'\nBETTER: 'Reveal that the counterargument has a legitimate basis the reader probably agrees with.'\nBEST: 'Force the reader to agree with the counterargument's reasoning while sensing it's about to be reframed.'",
      explanation:
        "Vague goals produce vague sections. The best section goals describe a specific shift in the reader's understanding or emotion -- not just what's covered, but what changes.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Activity vs. Purpose",
      content:
        "❌ 'Review the history of the policy.'\n❌ 'Present some data about the trend.'\n\n✅ 'The historical review reveals that the policy was designed to solve a problem that no longer exists.'\n✅ 'The data section forces the reader to abandon their assumption that the trend is slowing.'",
      explanation:
        "Activities (reviewing history, presenting data) aren't goals. Goals answer: what is DIFFERENT in the reader's understanding after this section that wasn't true before?",
    },
    {
      type: "technique",
      genreTags: ["op-ed", "analytical", "personal essay"],
      title: "The Irreversibility Test",
      content:
        "After writing your section goal, ask: Can the reader go back to their prior understanding after reading this section?\n\nIf YES --> your goal is too weak. Raise the stakes.\nIf NO --> you have a real section.\n\nExample: 'Present the data' is reversible (the reader can ignore it). 'Force the reader to confront what the data means for them personally' is not.",
      explanation:
        "The best sections create irreversible shifts in understanding. The section goal should point toward a realization that can't be un-had.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  3. Vocabulary Notes (Voice Fingerprint)
  // ═══════════════════════════════════════════════════

  vocabularyNotes: [
    {
      type: "good_better_best",
      genreTags: ["personal essay"],
      title: "From Generic to Specific Voice",
      content:
        "GOOD: 'Writes formally.'\nBETTER: 'Uses complete sentences, never contractions. Prefers Latinate words over Anglo-Saxon.'\nBEST: 'Never contractions. Prefers Latinate words (illuminate, not light up). Sentences average 20+ words. Poses questions instead of making declarations. Uses \"one\" instead of \"you\" for generalizations.'",
      explanation:
        "The AI can't act on 'writes formally.' It CAN replicate specific patterns: no contractions, Latinate vocabulary, question-framing, and sentence length.",
    },
    {
      type: "surface_subtext",
      genreTags: ["op-ed", "personal essay"],
      title: "Two Voices, Same Point",
      content:
        "Same argument, different voices:\n\nJournalist: 'The numbers don't lie. Enrollment dropped 30% in two years. Nobody in the administration will say why.'\n\nAcademic: 'One observes a statistically significant decline in enrollment -- approximately 30% over a two-year period -- the institutional response to which merits further scrutiny.'",
      explanation:
        "Voice notes should make writers distinguishable even without bylines. If you can swap voices and nobody notices, the notes aren't specific enough.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay", "analytical"],
      title: "Describing Tone Instead of Pattern",
      content:
        "❌ 'She writes warmly and with empathy.'\n✅ 'Short sentences. Echoes the reader's likely objections before answering them. Uses \"we\" even when she means \"you.\" Leaves space between assertions for the reader to catch up.'",
      explanation:
        "Tone changes section to section, but writing patterns are consistent. Describe the HOW, not the FEELING -- the AI handles feeling through context.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  4. Reader State — Wrong About
  // ═══════════════════════════════════════════════════

  readerStateWrongAbout: [
    {
      type: "surface_subtext",
      genreTags: ["op-ed"],
      title: "Managing Reader Assumptions",
      content:
        "Reader believes: The policy failed because of poor implementation.\nReality: The policy succeeded at its actual (unstated) goal.\n\nEvery section about the policy must maintain the reader's assumption about failure. Build sympathy for the implementers so the reveal -- that the policy was never meant to help -- hits harder.",
      explanation:
        "Tracking 'Wrong About' prevents premature reveals. If you know the reader falsely assumes good intentions, you can actively reinforce that assumption until the pivot.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay", "op-ed"],
      title: "Accidental Spoilers Through Author Tone",
      content:
        "❌ BAD: 'The initiative launched with fanfare, though the fine print told a different story.' (telegraphs the twist)\n✅ BETTER: 'The initiative launched with fanfare.' (neutral -- preserves the false belief)\n\nThe prose should reflect what the reader is meant to believe at this point, not what the author knows.",
      explanation:
        "When you list what the reader is wrong about, you create a checklist of beliefs to protect. Any prose that undermines a listed false belief is a bug.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "analytical", "op-ed"],
      title: "Layered False Beliefs",
      content:
        "Level 1: Reader thinks A is true (accepts the common framing).\nLevel 2: Reader thinks they've seen through A -- but their 'correct' reframing B is ALSO incomplete.\nLevel 3: The full picture C recontextualizes everything.\n\nExample:\nL1: 'Remote work is about flexibility.' L2: 'Wait -- it's really about cost-cutting.' L3: 'It's about neither. It's about who gets to define productivity.'",
      explanation:
        "Track each layer separately. When a section dismantles Level 1, make sure Level 2 is already planted and protected.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  5. Concrete Detail Style
  // ═══════════════════════════════════════════════════

  emotionPhysicality: [
    {
      type: "good_better_best",
      genreTags: ["personal essay"],
      title: "From Abstract to Concrete",
      content:
        "GOOD: 'Conviction --> cites evidence'\nBETTER: 'Conviction --> specific data, named sources, precise dates'\nBEST: 'Conviction --> specific data, named sources, precise dates. DISTINCT FROM doubt, where the prose shifts to hypotheticals and conditional phrasing.'",
      explanation:
        "The best concrete detail notes distinguish between rhetorical modes. If conviction and doubt produce the same kind of evidence, the reader can't feel the shift.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay", "analytical"],
      title: "Generic Grounding Details",
      content:
        "❌ GENERIC: 'The data was compelling. The evidence was clear. The trend was obvious.'\nThese work for ANY argument making ANY point.\n\n✅ SPECIFIC: 'The spreadsheet showed enrollment dropping 12% each quarter. By spring, three departments had frozen hiring.'",
      explanation:
        "Generic assertions (compelling data, clear evidence) are the nonfiction equivalent of 'suddenly.' Specific, named details make each argument feel grounded.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "op-ed"],
      title: "The Three-Channel Approach",
      content:
        "For each rhetorical mode, define three channels:\n1. DATA: What numbers or facts ground it (statistics, dates, measurements)\n2. VOICE: How the prose shifts (sentence length, hedging, directness)\n3. SCENE: What concrete details anchor it (settings, objects, sensory moments)\n\nExample -- Urgency:\nData: Present-tense statistics, recent dates.\nVoice: Short declaratives, no qualifiers.\nScene: The sound of the clock, the empty chairs in the meeting room.",
      explanation:
        "Three channels give the AI enough variety to ground arguments without repeating the same pattern. The AI will mix and match from these channels.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  6. Pacing
  // ═══════════════════════════════════════════════════

  pacing: [
    {
      type: "good_better_best",
      genreTags: ["op-ed", "personal essay"],
      title: "Describing Section Tempo",
      content:
        "GOOD: 'Fast-paced.'\nBETTER: 'Starts slow with context, accelerates after the key evidence.'\nBEST: 'First third: measured background, long sentences, rich context-setting. At the data reveal (midpoint), sentences shorten. Final third: direct assertions, minimal qualification, every line drives toward the conclusion.'",
      explanation:
        "The AI responds to specific tempo shapes. 'Fast-paced' gives it nothing to work with. A tempo arc with transitions gives it a score to follow.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "op-ed", "analytical"],
      title: "Sentence Length as Pacing Control",
      content:
        "Reflective sections --> longer sentences, more subordinate clauses, contextual detail.\nUrgent sections --> short sentences. Fragments. Active verbs.\nTransition --> one long sentence followed by a short punch.\n\nExample transition: 'I had spent the better part of a year studying the data, reading the reports, interviewing the people who'd been there.' Then: 'None of it mattered. The decision was already made.'",
      explanation:
        "Pacing isn't just about what's argued -- it's about how sentences physically feel. This field should describe the SHAPE of the prose, not just the argument speed.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Constant Tempo",
      content:
        "❌ BAD: 'Moderate pace throughout.'\nThis produces monotone prose where every point feels the same weight.\n\n✅ BETTER: Name at least TWO tempos and WHERE the shift happens.\n'Slow context-setting --> sudden acceleration at the key finding --> reflective aftermath.'",
      explanation:
        "Even quiet reflective sections need internal pacing variation. A section with one tempo is like music with one note.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  7. Failure Mode to Avoid
  // ═══════════════════════════════════════════════════

  failureModeToAvoid: [
    {
      type: "good_better_best",
      genreTags: ["personal essay", "op-ed"],
      title: "Naming the Worst Version",
      content:
        "GOOD: 'Don't make it boring.'\nBETTER: 'Don't let the argument become a listicle of obvious points.'\nBEST: 'The worst version of this section is a series of assertions without evidence, each restating the thesis in slightly different words, concluding with a call to action that adds nothing. Prevent: unsupported claims, circular reasoning, and any paragraph that starts with \"It is important to note.\"'",
      explanation:
        "Specific failure modes give the AI concrete patterns to avoid. 'Don't be boring' is useless. 'No paragraphs starting with It is important to note' is actionable.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "analytical", "op-ed"],
      title: "The Essay-Type-Specific Failure",
      content:
        "Each essay type has default failure modes:\n\nPersonal essay: Self-indulgent reflection that never arrives at insight.\nOp-ed: Preaching to the choir without engaging counterarguments.\nAnalytical piece: Data dump without interpretation or so-what.\nExplainer: Oversimplifying to the point of inaccuracy.\n\nName YOUR section's likely failure based on its type and content.",
      explanation:
        "The AI has been trained on millions of essays. It knows the common patterns -- including the bad ones. Naming the specific failure activates avoidance.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Too Many Failure Modes",
      content:
        "❌ Listing 10 things to avoid paralyzes generation.\n✅ Name the ONE most likely failure for THIS specific section.\n\nAsk: 'If I handed this section to a mediocre writer, what would they do wrong?' That's your failure mode.",
      explanation:
        "One strong negative constraint is more effective than a list of weak ones. The failure mode should be the single most probable way the section goes wrong.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  8. Emotional Beat
  // ═══════════════════════════════════════════════════

  emotionalBeat: [
    {
      type: "good_better_best",
      genreTags: ["personal essay", "analytical"],
      title: "Precision in Emotion",
      content:
        "GOOD: 'Sadness.'\nBETTER: 'Quiet disillusionment -- the kind that doesn't announce itself.'\nBEST: 'The reader should feel the specific unease of realizing that something they trusted was never what it claimed to be. Not outrage -- something smaller and more corrosive.'",
      explanation:
        "Broad emotions produce broad prose. The more precisely you name the feeling, the more specifically the AI can craft the section's tone and word choice.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "op-ed", "analytical"],
      title: "Reader Emotion vs. Author's Stated Emotion",
      content:
        "These are different and often intentionally mismatched:\n\nAuthor's tone: Measured and fair-minded.\nReader should feel: Growing unease, because the evidence keeps pointing somewhere the author hasn't gone yet.\n\nAuthor's tone: Outraged.\nReader should feel: Sympathy tempered by skepticism -- the outrage seems justified but maybe too convenient.",
      explanation:
        "The emotional beat is about the READER's experience, not the author's stated position. A section where the author is calm can make the reader anxious.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Emotional Whiplash",
      content:
        "❌ 'This section should feel devastating AND funny AND intellectually rigorous.'\n\nPick ONE primary beat. You can have secondary notes (dark humor in disillusionment), but the base tone must be clear.\n\n✅ 'Primary: Disillusionment. Secondary note: dry humor as coping mechanism.'",
      explanation:
        "Trying to hit three emotional targets produces a section that hits none. One clear beat with a secondary flavor is the strongest formula.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  9. Kill List (Avoid List)
  // ═══════════════════════════════════════════════════

  killList: [
    {
      type: "good_better_best",
      genreTags: ["personal essay"],
      title: "Building an Effective Avoid List",
      content:
        "GOOD: 'delve' (exact match)\nBETTER: 'delve', 'landscape', 'robust', 'leverage', 'utilize' (common AI slop)\nBEST: All of the above PLUS structural patterns:\n- 'it is worth noting that' (structural)\n- 'in today's [noun] landscape' (structural)\n- 'at the end of the day' (structural)\n- Opening a paragraph with 'In conclusion' (structural)",
      explanation:
        "Exact matches catch specific words. Structural matches catch patterns. The most effective avoid lists combine both -- targeting both AI-generated filler and common essay clichés.",
    },
    {
      type: "technique",
      genreTags: ["personal essay", "op-ed", "analytical"],
      title: "Building Your List Iteratively",
      content:
        "Don't try to list everything upfront. Instead:\n1. Start with 3-5 obvious AI slop words (delve, landscape, robust, nuanced, multifaceted).\n2. Generate a chunk.\n3. Highlight any phrase that sounds like AI wrote it.\n4. Add those to the avoid list.\n5. Regenerate and repeat.\n\nAfter 3-4 rounds, your list will catch 90% of the AI's bad habits for YOUR essay's voice.",
      explanation:
        "The avoid list is a living document. The best lists are built through iteration with the AI, not designed in advance.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay"],
      title: "Over-Constraining",
      content:
        "❌ A 50-entry avoid list that bans common English words.\nThis forces the AI into unnatural prose and reduces quality.\n\n✅ 10-20 targeted entries that address real tendencies.\n\nTest: If removing an entry wouldn't noticeably change output quality, it doesn't belong on the list.",
      explanation:
        "Each avoid-list entry narrows the AI's vocabulary. Too many constraints produce stilted, awkward prose. Quality over quantity.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  10. Approved Metaphoric Domains
  // ═══════════════════════════════════════════════════

  approvedMetaphoricDomains: [
    {
      type: "good_better_best",
      genreTags: ["personal essay"],
      title: "From Random to Cohesive Metaphors",
      content:
        "GOOD: 'Use metaphors.'\nBETTER: 'Draw metaphors from architecture and construction.'\nBEST: 'Approved: architecture, foundations, load-bearing walls, structural integrity. Every comparison should feel architectural -- arguments as blueprints, evidence as foundations, conclusions as keystones.'",
      explanation:
        "Consistent metaphor domains create a cohesive voice. When every comparison draws from the same world, the prose develops an unmistakable identity.",
    },
    {
      type: "surface_subtext",
      genreTags: ["personal essay", "op-ed"],
      title: "Metaphor Domains as Author Voice",
      content:
        "A technology writer: 'The policy was a patch -- it fixed the visible bug but introduced three regressions nobody tested for.'\nAn economist: 'She invested her credibility the way traders invest in options -- hedging every position, never fully exposed.'\n\nThe metaphoric domain should match the author's world. The voice profile fields and metaphor domain should reinforce each other.",
      explanation:
        "Metaphor domains work at two levels: project-wide (the essay's overall feel) and voice-specific (each author's register). Both should be consistent.",
    },
    {
      type: "pitfall",
      genreTags: ["personal essay", "analytical"],
      title: "Domain Collision",
      content:
        "❌ 'The argument bloomed like a flower in the cold machinery of the economy.'\nThis mixes organic growth (flowers) with industrial (machinery) -- tonal whiplash.\n\n✅ 'The argument corroded slowly -- invisible until the entire framework couldn't hold.'\nSingle domain (industrial decay) maintained throughout.",
      explanation:
        "When you define approved domains, you're also implicitly defining what's prohibited. If 'architecture and construction' is your domain, botanical metaphors become off-limits.",
    },
  ],
};

/**
 * Get examples for a specific field.
 * Returns an empty array for fields without examples.
 */
export function getExamples(fieldId: string): FieldExample[] {
  return FIELD_EXAMPLES[fieldId] ?? [];
}
