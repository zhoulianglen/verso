import Highlight from "@tiptap/extension-highlight";
import { markInputRule, markPasteRule } from "@tiptap/core";
import type { JSONContent, MarkdownToken } from "@tiptap/core";

/**
 * Extends the TipTap Highlight extension with ==markdown== syntax support.
 * Adds tokenizer, parser, serializer for @tiptap/markdown integration,
 * plus input/paste rules for live editing.
 */
export const HighlightMark = Highlight.extend({
  markdownTokenName: "highlight",

  markdownTokenizer: {
    name: "highlight",
    level: "inline" as const,
    start(src: string) {
      return src.indexOf("==");
    },
    tokenize(src: string, _tokens: MarkdownToken[], helper: { inlineTokens: (s: string) => MarkdownToken[] }) {
      const match = src.match(/^==((?:[^=]|=[^=])+?)==/);
      if (!match) return undefined;
      return {
        type: "highlight",
        raw: match[0],
        text: match[1],
        tokens: helper.inlineTokens(match[1]),
      };
    },
  },

  parseMarkdown(token: { tokens?: unknown[] }, helpers: { applyMark: Function; parseInline: Function }) {
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
    );
  },

  renderMarkdown(node: JSONContent, h: { renderChildren: (n: JSONContent) => string }) {
    return `==${h.renderChildren(node)}==`;
  },

  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(==((?:[^=]|=[^=])+)==)$/,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: /(?:^|\s)(==((?:[^=]|=[^=])+)==)/g,
        type: this.type,
      }),
    ];
  },
});
