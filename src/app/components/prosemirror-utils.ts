import type { Editor } from "@tiptap/core";

/**
 * Convert plain text (paragraphs separated by \n\n) into a ProseMirror JSON doc.
 * TipTap treats string content as HTML by default, which can drop
 * paragraph boundaries and interpret <...> sequences.
 */
export function textToDoc(plainText: string): Record<string, unknown> {
  const paragraphs = plainText.split("\n\n");
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    })),
  };
}

/**
 * Convert a character offset (from plain text with \n\n separators) to a
 * ProseMirror doc position. ProseMirror uses node-based positions where
 * paragraph boundaries add gaps.
 */
export function offsetToPos(ed: Editor, offset: number): number {
  const doc = ed.state.doc;
  let acc = 0;
  let found: number | null = null;
  doc.descendants((node, pos, parent) => {
    if (found !== null) return false;
    if (node.isText) {
      const next = acc + node.text!.length;
      if (offset <= next) {
        found = pos + (offset - acc);
        return false;
      }
      acc = next;
    } else if (node.isBlock && parent) {
      if (acc > 0) acc += 2; // mirrors getText "\n\n" separator
    }
    return true;
  });
  return found ?? doc.content.size;
}

/**
 * Convert a ProseMirror doc position back to a character offset in
 * plain text (paragraphs separated by \n\n).
 */
export function posToOffset(ed: Editor, targetPos: number): number {
  const doc = ed.state.doc;
  let acc = 0;
  let found: number | null = null;
  doc.descendants((node, pos, parent) => {
    if (found !== null) return false;
    if (node.isText) {
      const textStart = pos;
      const textEnd = pos + node.text!.length;
      if (targetPos >= textStart && targetPos <= textEnd) {
        found = acc + (targetPos - textStart);
        return false;
      }
      acc += node.text!.length;
    } else if (node.isBlock && parent) {
      if (acc > 0) acc += 2; // mirrors getText "\n\n" separator
    }
    return true;
  });
  return found ?? acc;
}
