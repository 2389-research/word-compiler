import { describe, expect, it, vi } from "vitest";
import { checkSubtext, type SubtextClient } from "../../src/auditor/subtext.js";
import { createEmptyScenePlan } from "../../src/types/index.js";

function makePlan(overrides = {}) {
  return {
    ...createEmptyScenePlan("proj-1"),
    id: "scene-1",
    subtext: {
      surfaceConversation: "They discuss the weather",
      actualConversation: "Their relationship is ending",
      enforcementRule: "No character may say they are breaking up or that they don't love each other",
    },
    ...overrides,
  };
}

function makeClient(response: string): SubtextClient {
  return { call: vi.fn().mockResolvedValue(response) };
}

describe("checkSubtext", () => {
  it("returns no flags when subtext is not violated", async () => {
    const client = makeClient(JSON.stringify({ violated: false, violations: [], reasoning: "Subtext maintained" }));
    const flags = await checkSubtext("They talked about clouds.", makePlan(), client);
    expect(flags).toHaveLength(0);
    expect(client.call).toHaveBeenCalledOnce();
  });

  it("returns a flag when subtext is violated", async () => {
    const client = makeClient(
      JSON.stringify({
        violated: true,
        violations: [`"I don't love you anymore," she said.`],
        reasoning: "Character directly states the subtext",
      }),
    );
    const flags = await checkSubtext(`"I don't love you anymore," she said.`, makePlan(), client);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.category).toBe("subtext_violation");
    expect(flags[0]!.severity).toBe("warning");
    expect(flags[0]!.message).toContain("explicitly");
  });

  it("returns no flags when plan has no subtext", async () => {
    const client = makeClient("should not be called");
    const plan = { ...makePlan(), subtext: null };
    const flags = await checkSubtext("Some prose.", plan, client);
    expect(flags).toHaveLength(0);
    expect(client.call).not.toHaveBeenCalled();
  });

  it("handles unparseable LLM response with heuristic fallback — no violation", async () => {
    const client = makeClient("The prose looks fine. No subtext violations detected.");
    const flags = await checkSubtext("Some prose.", makePlan(), client);
    expect(flags).toHaveLength(0);
  });

  it("handles markdown-fenced JSON response", async () => {
    const client = makeClient(
      "```json\n" + JSON.stringify({ violated: false, violations: [], reasoning: "ok" }) + "\n```",
    );
    const flags = await checkSubtext("Some prose.", makePlan(), client);
    expect(flags).toHaveLength(0);
  });

  it("passes subtext content to the LLM call", async () => {
    const client = makeClient(JSON.stringify({ violated: false, violations: [], reasoning: "ok" }));
    await checkSubtext("Some prose.", makePlan(), client);
    const callArgs = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(callArgs[1]).toContain("Their relationship is ending");
    expect(callArgs[1]).toContain("Some prose.");
  });
});
