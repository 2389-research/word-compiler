import { describe, expect, it } from "vitest";
import { textToDoc } from "../../src/app/components/prosemirror-utils.js";

describe("textToDoc", () => {
  it("converts single paragraph", () => {
    const doc = textToDoc("Hello world");
    expect(doc.type).toBe("doc");
    const content = doc.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe("paragraph");
    const textNodes = content[0]!.content as Array<Record<string, unknown>>;
    expect(textNodes[0]!.text).toBe("Hello world");
  });

  it("splits on double newlines into paragraphs", () => {
    const doc = textToDoc("First paragraph\n\nSecond paragraph\n\nThird paragraph");
    const content = doc.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(3);
    expect((content[0]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("First paragraph");
    expect((content[1]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("Second paragraph");
    expect((content[2]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("Third paragraph");
  });

  it("handles empty text as single empty paragraph", () => {
    const doc = textToDoc("");
    const content = doc.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe("paragraph");
    // Empty paragraph has empty content array
    expect(content[0]!.content).toEqual([]);
  });

  it("preserves single newlines within paragraphs (not split)", () => {
    const doc = textToDoc("Line one\nLine two");
    const content = doc.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(1);
    expect((content[0]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("Line one\nLine two");
  });

  it("handles consecutive double newlines as empty paragraphs", () => {
    const doc = textToDoc("Before\n\n\n\nAfter");
    const content = doc.content as Array<Record<string, unknown>>;
    // "Before" + "" + "After" = 3 paragraphs
    expect(content).toHaveLength(3);
    expect((content[0]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("Before");
    expect(content[1]!.content).toEqual([]); // empty paragraph
    expect((content[2]!.content as Array<Record<string, unknown>>)[0]!.text).toBe("After");
  });

  it("produces valid ProseMirror doc structure", () => {
    const doc = textToDoc("Test");
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test" }],
        },
      ],
    });
  });
});
