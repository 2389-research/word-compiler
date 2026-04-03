import type { AuditFlag, ScenePlan } from "../types/index.js";
import { DEFAULT_FAST_MODEL, generateId } from "../types/index.js";

// ─── Subtext Compliance ──────────────────────────────────
//
// LLM-assisted check: does any character explicitly state the subtext?
// "Does not make subtext into text" is one of the most important style rules.

export interface SubtextClient {
  call(systemMessage: string, userMessage: string, model: string, maxTokens: number): Promise<string>;
}

interface SubtextCheckResult {
  violated: boolean;
  violations: string[];
  reasoning: string;
}

function parseSubtextResponse(text: string): SubtextCheckResult {
  // Try to parse JSON
  try {
    const parsed = JSON.parse(text) as SubtextCheckResult;
    if (typeof parsed.violated === "boolean") return parsed;
  } catch {
    // continue
  }

  // Markdown fence fallback
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1]) as SubtextCheckResult;
      if (typeof parsed.violated === "boolean") return parsed;
    } catch {
      // continue
    }
  }

  // Heuristic fallback: look for "violated": true
  const violated = /violated.*true/i.test(text) || /explicit.*subtext/i.test(text);
  return {
    violated,
    violations: violated ? ["Potential subtext violation detected (heuristic parse)"] : [],
    reasoning: text.slice(0, 200),
  };
}

const SUBTEXT_SYSTEM = `You are a literary editor specializing in subtext and implication. Your job is to identify whether characters explicitly state emotional truths that should remain unstated.`;

export async function checkSubtext(
  prose: string,
  plan: ScenePlan,
  client: SubtextClient,
  model = DEFAULT_FAST_MODEL,
): Promise<AuditFlag[]> {
  if (!plan.subtext) return [];

  const { actualConversation, enforcementRule } = plan.subtext;

  const userMessage = `ACTUAL CONVERSATION (what's really happening beneath the surface):
${actualConversation}

ENFORCEMENT RULE:
${enforcementRule}

PROSE TO CHECK:
${prose}

---

Does any character or narrator explicitly state the subtext ("${actualConversation.slice(0, 100)}")?
Explicit statements include: direct declarations of feeling, characters saying exactly what they mean, narrator explaining what the scene is "really" about.

Return JSON:
{
  "violated": true or false,
  "violations": ["Quote the exact offending line if violated"],
  "reasoning": "Brief explanation"
}`;

  const responseText = await client.call(SUBTEXT_SYSTEM, userMessage, model, 500);
  const result = parseSubtextResponse(responseText);

  if (!result.violated) return [];

  const sceneId = plan.id;
  return result.violations.map((v) => ({
    id: generateId(),
    sceneId,
    severity: "warning" as const,
    category: "subtext_violation",
    message: `Subtext stated explicitly: ${v || actualConversation.slice(0, 80)}`,
    lineReference: null,
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
  }));
}
