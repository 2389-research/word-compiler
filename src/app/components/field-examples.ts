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
      genreTags: ["literary", "thriller"],
      title: "The Altruistic Mentor",
      content:
        "Surface: Two colleagues discuss a promotion over lunch.\nActual: One is testing whether the other knows about the embezzlement.\nEnforcement: Neither can reference money, accounts, or the missing funds directly.",
      explanation:
        "The surface conversation is completely mundane — career advice, restaurant small talk. The tension lives entirely in what ISN'T said. Every word choice carries double weight.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "Common Mistake: Collapsing the Gap",
      content:
        '❌ BAD: "How\'s the project?" she asked, really meaning: are you stealing from us?\n✅ BETTER: "How\'s the project?" She watched his hands around the coffee cup.',
      explanation:
        "Never narrate the subtext directly. The moment you explain what characters 'really mean,' the subtext collapses into text. Let the reader do the work.",
    },
    {
      type: "good_better_best",
      genreTags: ["romance"],
      title: "Graduated Subtext Depth",
      content:
        "GOOD: Surface = arguing about dishes.\nBETTER: Surface = arguing about dishes. Actual = negotiating who has more power in the relationship.\nBEST: Surface = arguing about dishes. Actual = negotiating power. Enforcement = neither can say 'I need you more than you need me.'",
      explanation:
        "The enforcement rule is what creates tension. Without it, characters can just say what they mean and the scene deflates.",
    },
  ],

  subtextActual: [
    {
      type: "technique",
      genreTags: ["thriller", "literary"],
      title: "Mapping the Hidden Conversation",
      content:
        "For each character, answer: What do they WANT from this conversation? What are they AFRAID the other person knows? What would they NEVER say aloud?\n\nExample — a father visiting his estranged daughter:\nWants: Forgiveness.\nAfraid she knows: He chose his career over her mother.\nWould never say: 'I was wrong to leave.'",
      explanation:
        "The actual conversation isn't just 'what they really mean.' It's each character's hidden agenda, fear, and boundary, all operating simultaneously.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "One-Sided Subtext",
      content:
        "❌ BAD: Only one character has hidden motives. The other is just... talking.\n✅ BETTER: BOTH characters have something they're hiding or wanting. The tension comes from two hidden agendas colliding.",
      explanation:
        "Subtext works best as a two-way street. When only one character has depth, the other becomes a prop.",
    },
  ],

  subtextEnforcement: [
    {
      type: "technique",
      genreTags: ["literary", "thriller", "romance"],
      title: "Writing Effective Enforcement Rules",
      content:
        "Strong enforcement rules are specific and testable:\n✅ 'The word cancer cannot be spoken aloud'\n✅ 'Neither character can acknowledge they were once lovers'\n✅ 'No one can mention the empty chair at the table'\n\nWeak rules are vague:\n❌ 'They can't be too direct'\n❌ 'Keep it subtle'",
      explanation:
        "An enforcement rule should be something you can point to in the prose and say 'this line violates the rule' or 'this line respects it.' Vague rules are unenforceable.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  2. Narrative Goal
  // ═══════════════════════════════════════════════════

  narrativeGoal: [
    {
      type: "good_better_best",
      genreTags: ["literary", "thriller"],
      title: "Sharpening the Scene's Job",
      content:
        "GOOD: 'Introduce the antagonist.'\nBETTER: 'Reveal that the antagonist has a legitimate grievance.'\nBEST: 'Force the reader to agree with the antagonist's reasoning while dreading what they'll do about it.'",
      explanation:
        "Vague goals produce vague scenes. The best narrative goals describe a specific shift in the reader's understanding or emotion — not just what happens, but what changes.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "Activity vs. Purpose",
      content:
        "❌ 'The characters have dinner and catch up.'\n❌ 'Action sequence in the warehouse.'\n\n✅ 'During dinner, the protagonist realizes their friend has been lying for months.'\n✅ 'The warehouse chase forces the protagonist to abandon someone they promised to protect.'",
      explanation:
        "Activities (dinner, chase) aren't goals. Goals answer: what is DIFFERENT after this scene that wasn't true before?",
    },
    {
      type: "technique",
      genreTags: ["thriller", "romance", "scifi"],
      title: "The Irreversibility Test",
      content:
        "After writing your narrative goal, ask: Can the characters go back to how things were before this scene?\n\nIf YES → your goal is too weak. Raise the stakes.\nIf NO → you have a real scene.\n\nExample: 'She discovers the letter' is reversible (she could forget it). 'She reads the letter aloud to the room' is not.",
      explanation:
        "The best scenes create irreversible change. The narrative goal should point toward a moment that can't be undone.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  3. Vocabulary Notes (Voice Fingerprint)
  // ═══════════════════════════════════════════════════

  vocabularyNotes: [
    {
      type: "good_better_best",
      genreTags: ["literary"],
      title: "From Generic to Specific Voice",
      content:
        "GOOD: 'Speaks formally.'\nBETTER: 'Uses complete sentences, never contractions. Prefers Latinate words over Anglo-Saxon.'\nBEST: 'Never contractions. Prefers Latinate words (illuminate, not light up). Sentences average 20+ words. Asks questions instead of making demands. Uses \"one\" instead of \"you\" for generalizations.'",
      explanation:
        "The AI can't act on 'speaks formally.' It CAN replicate specific patterns: no contractions, Latinate vocabulary, question-framing, and sentence length.",
    },
    {
      type: "surface_subtext",
      genreTags: ["thriller", "literary"],
      title: "Two Characters, Same Line",
      content:
        "Same information, different voices:\n\nDetective: 'The blood pattern says he was standing when it happened. Left-handed. Knew the victim.'\n\nProfessor: 'One observes a distribution consistent with an upright assailant — left-dominant, and almost certainly acquainted with the deceased.'",
      explanation:
        "Voice notes should make characters distinguishable even without dialogue tags. If you can swap voices and nobody notices, the notes aren't specific enough.",
    },
    {
      type: "pitfall",
      genreTags: ["literary", "romance"],
      title: "Describing Emotion Instead of Pattern",
      content:
        "❌ 'She speaks warmly and with empathy.'\n✅ 'Short sentences. Repeats the other person's words back to them. Uses \"we\" even when she means \"you.\" Leaves pauses for the other person to fill.'",
      explanation:
        "Emotions change scene to scene, but speech patterns are consistent. Describe the HOW, not the FEELING — the AI handles feeling through context.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  4. Reader State — Wrong About
  // ═══════════════════════════════════════════════════

  readerStateWrongAbout: [
    {
      type: "surface_subtext",
      genreTags: ["thriller"],
      title: "Managing Dramatic Irony",
      content:
        "Reader believes: The detective's partner is reliable.\nReality: The partner is the leak.\n\nEvery scene with the partner must maintain this false belief. The reader should feel safe around the partner — use warmth, competence, small favors. Build trust so the reveal devastates.",
      explanation:
        "Tracking 'Wrong About' prevents accidental reveals. If you know the reader falsely trusts the partner, you can actively reinforce that trust.",
    },
    {
      type: "pitfall",
      genreTags: ["literary", "thriller"],
      title: "Accidental Spoilers Through Narrator Tone",
      content:
        "❌ BAD: 'Marcus offered to help, his smile not quite reaching his eyes.' (telegraphs distrust)\n✅ BETTER: 'Marcus offered to help.' (neutral — preserves the false belief)\n\nThe narrator should reflect the POV character's beliefs, not the author's knowledge.",
      explanation:
        "When you list what the reader is wrong about, you create a checklist of beliefs to protect. Any prose that undermines a listed false belief is a bug.",
    },
    {
      type: "technique",
      genreTags: ["literary", "romance", "scifi"],
      title: "Layered False Beliefs",
      content:
        "Level 1: Reader thinks A is true (simple misdirection).\nLevel 2: Reader thinks they've figured out A is false — but their 'correct' conclusion B is ALSO wrong.\nLevel 3: The truth C recontextualizes everything.\n\nExample:\nL1: 'The corporation is the enemy.' L2: 'Wait — the resistance leader IS the corporation.' L3: 'There is no resistance. There never was.'",
      explanation:
        "Track each layer separately. When a scene dismantles Level 1, make sure Level 2 is already planted and protected.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  5. Emotion Physicality
  // ═══════════════════════════════════════════════════

  emotionPhysicality: [
    {
      type: "good_better_best",
      genreTags: ["literary"],
      title: "From Telling to Showing",
      content:
        "GOOD: 'Anger → clenched fists'\nBETTER: 'Anger → jaw tightens, speaks more slowly, sets objects down with excessive care'\nBEST: 'Anger → jaw tightens, speaks more slowly, sets objects down with excessive care. DISTINCT FROM anxiety, where he talks faster and can't keep his hands still.'",
      explanation:
        "The best physicality notes distinguish between emotions. If anger and anxiety produce the same body language, the reader can't tell them apart.",
    },
    {
      type: "pitfall",
      genreTags: ["literary", "romance"],
      title: "Universal Body Language",
      content:
        "❌ GENERIC: 'Heart pounded. Palms sweated. Breath caught.'\nThese work for ANY character feeling ANY strong emotion.\n\n✅ SPECIFIC: 'She reorganizes whatever's in front of her — papers, cutlery, her own fingers. The more upset, the more precise the arranging.'",
      explanation:
        "Generic physicality (heart pounding, breath catching) is the body-language equivalent of 'suddenly.' Character-specific reactions make each person's emotions feel real.",
    },
    {
      type: "technique",
      genreTags: ["literary", "thriller"],
      title: "The Three-Channel Approach",
      content:
        "For each key emotion, define three channels:\n1. BODY: What happens physically (jaw, hands, posture)\n2. SPEECH: How talking changes (speed, volume, word choice)\n3. BEHAVIOR: What they do differently (routines, habits, avoidance)\n\nExample — Grief:\nBody: Moves slowly, touches throat.\nSpeech: Starts sentences, doesn't finish them.\nBehavior: Cleans obsessively.",
      explanation:
        "Three channels give the AI enough variety to show emotion without repeating the same gesture. The AI will mix and match from these channels.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  6. Pacing
  // ═══════════════════════════════════════════════════

  pacing: [
    {
      type: "good_better_best",
      genreTags: ["thriller", "literary"],
      title: "Describing Scene Tempo",
      content:
        "GOOD: 'Fast-paced.'\nBETTER: 'Starts slow, accelerates after the midpoint reveal.'\nBEST: 'First third: languid domestic routine, long sentences, rich sensory detail. At the phone call (midpoint), sentences shorten. Final third: staccato dialogue, minimal description, every line drives toward the door.'",
      explanation:
        "The AI responds to specific tempo shapes. 'Fast-paced' gives it nothing to work with. A tempo arc with transitions gives it a score to follow.",
    },
    {
      type: "technique",
      genreTags: ["literary", "thriller", "romance"],
      title: "Sentence Length as Pacing Control",
      content:
        "Slow scenes → longer sentences, more subordinate clauses, sensory detail.\nFast scenes → short sentences. Fragments. Action verbs.\nTransition → one long sentence followed by a short punch.\n\nExample transition: 'She had been sitting in the garden for what felt like hours, watching the light move across the wall, when the phone rang.' Then: 'She answered. Silence.'",
      explanation:
        "Pacing isn't just about what happens — it's about how sentences physically feel. This field should describe the SHAPE of the prose, not just the plot speed.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "Constant Tempo",
      content:
        "❌ BAD: 'Moderate pace throughout.'\nThis produces monotone prose where everything feels the same weight.\n\n✅ BETTER: Name at least TWO tempos and WHERE the shift happens.\n'Slow build → sudden acceleration at the discovery → slow aftermath.'",
      explanation:
        "Even quiet literary scenes need internal pacing variation. A scene with one tempo is like music with one note.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  7. Failure Mode to Avoid
  // ═══════════════════════════════════════════════════

  failureModeToAvoid: [
    {
      type: "good_better_best",
      genreTags: ["literary", "thriller"],
      title: "Naming the Worst Version",
      content:
        "GOOD: 'Don't make it boring.'\nBETTER: 'Don't let the confrontation become an exposition dump.'\nBEST: 'The worst version of this scene is two characters stating their feelings directly to each other in complete sentences, resolving the conflict through rational discussion like adults in therapy. Prevent: direct emotional statements, conflict resolution without cost, and any sentence starting with \"I feel.\"'",
      explanation:
        "Specific failure modes give the AI concrete patterns to avoid. 'Don't be boring' is useless. 'No sentences starting with I feel' is actionable.",
    },
    {
      type: "technique",
      genreTags: ["literary", "romance", "scifi"],
      title: "The Genre-Specific Failure",
      content:
        "Each genre has default failure modes:\n\nRomance: Characters state attraction directly too early.\nThriller: Chase scenes with no stakes or consequences.\nLiterary: Navel-gazing internal monologue that replaces action.\nSci-fi: World-building exposition disguised as dialogue.\n\nName YOUR scene's likely failure based on its genre and content.",
      explanation:
        "The AI has been trained on millions of scenes. It knows the common patterns — including the bad ones. Naming the specific failure activates avoidance.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "Too Many Failure Modes",
      content:
        "❌ Listing 10 things to avoid paralyzes generation.\n✅ Name the ONE most likely failure for THIS specific scene.\n\nAsk: 'If I handed this scene to a mediocre writer, what would they do wrong?' That's your failure mode.",
      explanation:
        "One strong negative constraint is more effective than a list of weak ones. The failure mode should be the single most probable way the scene goes wrong.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  8. Emotional Beat
  // ═══════════════════════════════════════════════════

  emotionalBeat: [
    {
      type: "good_better_best",
      genreTags: ["literary", "romance"],
      title: "Precision in Emotion",
      content:
        "GOOD: 'Sadness.'\nBETTER: 'Quiet devastation — the kind that doesn't announce itself.'\nBEST: 'The reader should feel the specific sadness of watching someone pretend to be fine when the pretense is visibly cracking. Not grief — something smaller and more corrosive.'",
      explanation:
        "Broad emotions produce broad prose. The more precisely you name the feeling, the more specifically the AI can craft the scene's tone and word choice.",
    },
    {
      type: "technique",
      genreTags: ["literary", "thriller", "romance"],
      title: "Reader Emotion vs. Character Emotion",
      content:
        "These are different and often opposite:\n\nCharacter feels: Confident and in control.\nReader should feel: Dread, because they know what the character doesn't.\n\nCharacter feels: Devastated.\nReader should feel: Relief, because the devastating thing was actually the right outcome.",
      explanation:
        "The emotional beat is about the READER's experience, not the character's. A scene where the character is happy can make the reader terrified (dramatic irony).",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
      title: "Emotional Whiplash",
      content:
        "❌ 'This scene should feel heartbreaking AND funny AND suspenseful.'\n\nPick ONE primary beat. You can have secondary notes (humor in grief), but the base tone must be clear.\n\n✅ 'Primary: Grief. Secondary note: dark humor as defense mechanism.'",
      explanation:
        "Trying to hit three emotional targets produces a scene that hits none. One clear beat with a secondary flavor is the strongest formula.",
    },
  ],

  // ═══════════════════════════════════════════════════
  //  9. Kill List (Avoid List)
  // ═══════════════════════════════════════════════════

  killList: [
    {
      type: "good_better_best",
      genreTags: ["literary"],
      title: "Building an Effective Avoid List",
      content:
        "GOOD: 'suddenly' (exact match)\nBETTER: 'suddenly', 'began to', 'started to', 'seemed to' (common filler)\nBEST: All of the above PLUS structural patterns:\n- 'couldn't help but [verb]' (structural)\n- 'it was as if' (structural)\n- 'little did they know' (structural)\n- Opening a paragraph with weather (structural)",
      explanation:
        "Exact matches catch specific words. Structural matches catch patterns. The most effective avoid lists combine both types.",
    },
    {
      type: "technique",
      genreTags: ["literary", "thriller", "romance", "scifi"],
      title: "Building Your List Iteratively",
      content:
        "Don't try to list everything upfront. Instead:\n1. Start with 3-5 obvious pet peeves.\n2. Generate a chunk.\n3. Highlight any phrase that makes you cringe.\n4. Add those to the avoid list.\n5. Regenerate and repeat.\n\nAfter 3-4 rounds, your list will catch 90% of the AI's bad habits for YOUR project's voice.",
      explanation:
        "The avoid list is a living document. The best lists are built through iteration with the AI, not designed in advance.",
    },
    {
      type: "pitfall",
      genreTags: ["literary"],
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
      genreTags: ["literary"],
      title: "From Random to Cohesive Metaphors",
      content:
        "GOOD: 'Use metaphors.'\nBETTER: 'Draw metaphors from machinery and decay.'\nBEST: 'Approved: machinery, rust, corrosion, mechanical failure. Every comparison should feel industrial — relationships as gears, emotions as pressure gauges, trust as structural integrity.'",
      explanation:
        "Consistent metaphor domains create a cohesive voice. When every comparison draws from the same world, the prose develops an unmistakable identity.",
    },
    {
      type: "surface_subtext",
      genreTags: ["literary", "thriller"],
      title: "Metaphor Domains as Character Voice",
      content:
        "A marine biologist character: 'His anger was tidal — it receded before it surged.'\nA carpenter character: 'She measured her words the way she measured twice before cutting.'\n\nThe metaphoric domain should match the character's world. The character voice fields and metaphor domain should reinforce each other.",
      explanation:
        "Metaphor domains work at two levels: project-wide (the novel's overall feel) and character-specific (each character's register). Both should be consistent.",
    },
    {
      type: "pitfall",
      genreTags: ["literary", "romance"],
      title: "Domain Collision",
      content:
        "❌ 'His love bloomed like a flower in the cold machinery of the factory.'\nThis mixes organic growth (flowers) with industrial (machinery) — tonal whiplash.\n\n✅ 'His love was a slow corrosion — invisible until the structure couldn't hold.'\nSingle domain (industrial decay) maintained throughout.",
      explanation:
        "When you define approved domains, you're also implicitly defining what's prohibited. If 'machinery and decay' is your domain, botanical metaphors become off-limits.",
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
