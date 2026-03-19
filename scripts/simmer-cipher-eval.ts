/**
 * Simmer evaluator for CIPHER batch prompt quality.
 *
 * Runs the CIPHER prompt (from cipher.ts) against a fixed set of synthetic
 * edit pairs and outputs the raw preference statements for the judge to assess.
 *
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/simmer-cipher-eval.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { textCall } from "../server/profile/llm.js";
import { CIPHER_SYSTEM, buildBatchCipherPrompt } from "../server/profile/cipher.js";

const CIPHER_MODEL = "claude-haiku-4-5-20251001";

/**
 * Synthetic edit pairs representing an author (Jacqui Cheng's voice profile)
 * correcting generic LLM-generated prose. Each pair tests a different type
 * of stylistic correction.
 *
 * Known voice: conversational-professional register, grounded emotion via
 * physical detail, avoidance of literary flourishes, measured warmth, em-dash
 * heavy, short declarative sentences, humor through deadpan observation.
 */
const EDIT_PAIRS: Array<{ original: string; edited: string; _tag: string }> = [
  {
    _tag: "register_correction",
    original:
      "The ephemeral glow of the monitor cast pallid shadows across her visage as she contemplated the implications of the quarterly earnings report, its numbers dancing like specters of fiscal uncertainty.",
    edited:
      "The monitor lit up her face as she scrolled through the quarterly earnings report. The numbers were bad — not catastrophic, but the kind of bad that makes you close the laptop and stare at the ceiling for a minute.",
  },
  {
    _tag: "emotion_grounding",
    original:
      "Sarah felt an overwhelming wave of nostalgia crash over her as she walked through the old neighborhood. She was deeply saddened by how much had changed, and a profound sense of loss settled into her heart.",
    edited:
      "Sarah stopped at the corner where the bakery used to be. It was a nail salon now. She pulled her jacket tighter and kept walking, but her pace had slowed — she was reading every storefront like a sentence she half-remembered.",
  },
  {
    _tag: "sentence_structure",
    original:
      "The new policy, which had been debated extensively over the course of several months by various stakeholders who held differing opinions on the matter, was finally implemented on Tuesday, bringing with it a host of changes that would affect employees across all departments in ways that many had not fully anticipated.",
    edited:
      "The new policy dropped on Tuesday. It had been in committee for months. Nobody agreed on it, which meant everybody got something they didn't want. HR sent the memo at 4:47 PM — the corporate equivalent of sliding bad news under the door.",
  },
  {
    _tag: "remove_flourish",
    original:
      "Like a phoenix rising from the ashes of its former glory, the startup emerged from bankruptcy with renewed vigor and an indomitable spirit that would carry it through the treacherous waters of the competitive landscape.",
    edited:
      "The startup came back from bankruptcy. Not gracefully — there were layoffs, a pivot nobody believed in, and a Series B that valued them at a third of their peak. But they shipped product again, and that counts for something.",
  },
  {
    _tag: "dialogue_naturalism",
    original:
      '"I must confess," Elena said thoughtfully, "that I find myself deeply conflicted about this situation. On one hand, the ethical implications are troubling. On the other, the practical benefits cannot be denied."',
    edited:
      '"I don\'t know," Elena said. She picked at the label on her beer. "It\'s sketchy. But it works, and I\'m tired of the alternative not working."',
  },
  {
    _tag: "specificity_over_abstraction",
    original:
      "The technology industry continues to evolve at a rapid pace, with innovations in artificial intelligence promising to transform various sectors and reshape the way we interact with digital systems in our daily lives.",
    edited:
      "Apple shipped the M4 in October. By November, third-party benchmarks showed it running local LLMs that would have needed a server rack two years ago. The AI revolution turns out to be a laptop upgrade.",
  },
  {
    _tag: "warmth_calibration",
    original:
      "The community response was heartwarming and deeply inspiring. Volunteers poured in from every corner of the city, their selfless dedication a testament to the unbreakable bonds of human compassion.",
    edited:
      "People showed up. Not just the usual volunteers — the guy who runs the bodega brought sandwiches, the retired teacher across the street organized a signup sheet. It was a lot of quiet competence, which is what a disaster actually needs.",
  },
  {
    _tag: "em_dash_and_asides",
    original:
      "The restaurant had been open for thirty years. It survived the recession, a kitchen fire, and two changes in ownership. Most regulars didn't know any of this history.",
    edited:
      "The restaurant had been open for thirty years — through the recession, a kitchen fire, two ownership changes. Most regulars didn't know any of this. They just knew the pad thai was consistent, which is its own kind of miracle.",
  },
  {
    _tag: "cutting_melodrama",
    original:
      "He stared at the letter with trembling hands, tears streaming down his face as the devastating news shattered his world into a million irreparable pieces. His heart, once so full of hope, now lay broken beyond repair.",
    edited:
      "He read the letter twice, then set it on the counter and made coffee. The machine gurgled. He watched it drip. At some point he'd have to call his sister, but not yet.",
  },
  {
    _tag: "deadpan_humor",
    original:
      "The meeting was extremely long and unproductive. Everyone agreed that the key takeaways were minimal and that most of the discussion had been tangential to the core issues at hand.",
    edited:
      "The meeting ran ninety minutes. The key takeaway was that we need another meeting. Someone suggested a working group, which is what happens when a meeting wants to reproduce.",
  },
];

async function main() {
  const client = new Anthropic();

  // Run the CIPHER prompt against the edit pairs
  console.log(`[eval] Running CIPHER prompt on ${EDIT_PAIRS.length} edit pairs...`);

  const edits = EDIT_PAIRS.map(({ original, edited }) => ({ original, edited }));
  const prompt = buildBatchCipherPrompt(edits);

  const preferences = await textCall(client, CIPHER_MODEL, CIPHER_SYSTEM, prompt);

  // Run it twice more with the same input to check consistency
  console.log("[eval] Running 2 additional passes for consistency check...");
  const preferences2 = await textCall(client, CIPHER_MODEL, CIPHER_SYSTEM, prompt);
  const preferences3 = await textCall(client, CIPHER_MODEL, CIPHER_SYSTEM, prompt);

  const output = {
    editPairCount: EDIT_PAIRS.length,
    editPairTags: EDIT_PAIRS.map((e) => e._tag),
    promptText: prompt,
    promptTokenEstimate: prompt.length / 4, // rough estimate
    systemPrompt: CIPHER_SYSTEM,
    results: {
      run1: preferences,
      run2: preferences2,
      run3: preferences3,
    },
    editPairSummaries: EDIT_PAIRS.map((e) => ({
      tag: e._tag,
      originalExcerpt: e.original.slice(0, 120),
      editedExcerpt: e.edited.slice(0, 120),
    })),
  };

  console.log("---EVAL_OUTPUT---");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
