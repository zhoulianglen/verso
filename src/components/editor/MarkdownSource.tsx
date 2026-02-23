import { useEffect, useRef } from "react";
import { Compartment, EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { EditorView, keymap, Decoration, WidgetType, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  syntaxHighlighting,
  syntaxTree,
  HighlightStyle,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import { tags, Tag } from "@lezer/highlight";
import { GFM, MarkdownConfig } from "@lezer/markdown";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { readText as readClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import { useT } from "../../i18n";

// Custom tag for ==highlight== content
const highlightTag = Tag.define();
const highlightMarkerTag = Tag.define();

// Lezer markdown extension for ==highlight== syntax
const highlightExtension: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", style: highlightTag },
    { name: "HighlightMark", style: highlightMarkerTag },
  ],
  parseInline: [
    {
      name: "Highlight",
      parse(cx, next, pos) {
        // Look for ==
        if (next !== 61 /* = */ || cx.char(pos + 1) !== 61) return -1;
        // Search for closing ==
        let end = pos + 2;
        while (end < cx.end - 1) {
          if (cx.char(end) === 61 && cx.char(end + 1) === 61) {
            const content = cx.elt("Highlight", pos, end + 2, [
              cx.elt("HighlightMark", pos, pos + 2),
              cx.elt("HighlightMark", end, end + 2),
            ]);
            return cx.addElement(content);
          }
          end++;
        }
        return -1;
      },
    },
  ],
};

// Minimalist grayscale syntax highlighting using CSS variables
const versoHighlightStyle = HighlightStyle.define([
  // Headings: bold
  {
    tag: tags.heading,
    fontWeight: "var(--editor-bold-weight, 700)",
  },
  // Markdown markers (#, *, -, ```, >, etc.): muted
  {
    tag: [tags.processingInstruction, tags.meta],
    color: "var(--color-text-muted)",
  },
  // Emphasis markers (*, _, ~~)
  {
    tag: tags.emphasis,
    fontStyle: "italic",
  },
  {
    tag: tags.strong,
    fontWeight: "var(--editor-bold-weight, 700)",
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
  },
  // Links: underline
  {
    tag: tags.link,
    textDecoration: "underline",
  },
  // URL part of links: muted
  {
    tag: tags.url,
    color: "var(--color-text-muted)",
  },
  // Inline code and code blocks: muted background via class
  {
    tag: [tags.monospace],
    fontFamily:
      "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, 'Courier New', monospace",
  },
  // Blockquote text: italic + muted
  {
    tag: tags.quote,
    fontStyle: "italic",
    color: "var(--color-text-muted)",
  },
  // ==highlight== content: background emphasis
  {
    tag: highlightTag,
    backgroundColor: "var(--color-bg-emphasis)",
    borderRadius: "2px",
  },
  // ==highlight== markers (==): muted
  {
    tag: highlightMarkerTag,
    color: "var(--color-text-muted)",
  },
]);

// Base theme using CSS variables — auto-adapts to light/dark
const versoBaseTheme = EditorView.theme({
  "&": {
    color: "var(--color-text)",
    backgroundColor: "transparent",
    fontSize: "var(--editor-base-font-size, 17px)",
    fontFamily: "var(--editor-font-family)",
  },
  ".cm-content": {
    caretColor: "var(--color-text)",
    lineHeight: "var(--editor-line-height, 1.6)",
    padding: "2rem 1.5rem 6rem",
    maxWidth: "var(--editor-max-width, 48rem)",
    margin: "0 auto",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--color-text)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-selection)",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

// --- Source-mode visual table widget ---

// Module-level ref so widgets can dispatch changes back to the editor
let activeSourceView: EditorView | null = null;

interface ParsedTable {
  headers: string[];
  alignments: ("left" | "center" | "right" | "none")[];
  rows: string[][];
}

function parseSourceTable(text: string): ParsedTable | null {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const parseLine = (line: string): string[] => {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|").map((c) => c.trim());
  };

  const headers = parseLine(lines[0]);

  // Validate separator row
  const sepCells = parseLine(lines[1]);
  const alignments: ParsedTable["alignments"] = [];
  for (const sep of sepCells) {
    const s = sep.trim();
    if (!/^:?-+:?$/.test(s)) return null;
    const left = s.startsWith(":");
    const right = s.endsWith(":");
    if (left && right) alignments.push("center");
    else if (right) alignments.push("right");
    else if (left) alignments.push("left");
    else alignments.push("none");
  }

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    rows.push(parseLine(lines[i]));
  }

  return { headers, alignments, rows };
}

function serializeSourceTable(table: ParsedTable): string {
  const colCount = table.headers.length;
  const escape = (s: string) => s.replace(/\|/g, "\\|");
  const headerLine = "| " + table.headers.map(escape).join(" | ") + " |";
  const sepLine =
    "| " +
    table.alignments
      .map((a) => {
        if (a === "center") return ":---:";
        if (a === "right") return "---:";
        if (a === "left") return ":---";
        return "---";
      })
      .join(" | ") +
    " |";
  const rowLines = table.rows.map((row) => {
    const cells = Array.from({ length: colCount }, (_, i) => escape(row[i] ?? ""));
    return "| " + cells.join(" | ") + " |";
  });
  return [headerLine, sepLine, ...rowLines].join("\n");
}

class SourceTableWidget extends WidgetType {
  constructor(
    readonly table: ParsedTable,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: SourceTableWidget) {
    return this.from === other.from && this.to === other.to &&
      JSON.stringify(this.table) === JSON.stringify(other.table);
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-source-table-wrapper";
    wrapper.setAttribute("contenteditable", "false");

    const tbl = document.createElement("table");
    tbl.className = "not-prose";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    this.table.headers.forEach((h, ci) => {
      const th = document.createElement("th");
      th.textContent = h;
      th.setAttribute("contenteditable", "true");
      th.style.textAlign = this.table.alignments[ci] === "none" ? "left" : this.table.alignments[ci];
      th.addEventListener("keydown", (e) => this.handleCellKey(e, 0, ci));
      th.addEventListener("blur", () => this.syncToDoc());
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    this.table.rows.forEach((row, ri) => {
      const tr = document.createElement("tr");
      this.table.headers.forEach((_, ci) => {
        const td = document.createElement("td");
        td.textContent = row[ci] ?? "";
        td.setAttribute("contenteditable", "true");
        td.style.textAlign = this.table.alignments[ci] === "none" ? "left" : this.table.alignments[ci];
        td.addEventListener("keydown", (e) => this.handleCellKey(e, ri + 1, ci));
        td.addEventListener("blur", () => this.syncToDoc());
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);

    // Add row "+" button container
    const rowControls = document.createElement("div");
    rowControls.className = "table-row-controls";
    rowControls.setAttribute("contenteditable", "false");
    wrapper.appendChild(rowControls);

    // Add col "+" button container
    const colControls = document.createElement("div");
    colControls.className = "table-col-controls";
    colControls.setAttribute("contenteditable", "false");
    wrapper.appendChild(colControls);

    // Hover logic for "+" buttons
    let activeColBtn: HTMLElement | null = null;
    let activeRowBtn: HTMLElement | null = null;

    wrapper.addEventListener("mousemove", (e) => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const allRows = tbl.querySelectorAll("tr");
      const firstRow = allRows[0];
      if (!firstRow) return;
      const cells = firstRow.querySelectorAll<HTMLElement>("th, td");
      const THRESHOLD = 15;
      const mx = e.clientX;
      const my = e.clientY;

      // Column "+" button
      let bestColIdx = -1, bestColDist = Infinity, bestColX = 0;
      cells.forEach((cell, i) => {
        const rect = cell.getBoundingClientRect();
        const dist = Math.abs(mx - rect.right);
        if (dist < THRESHOLD && dist < bestColDist) {
          bestColDist = dist; bestColIdx = i;
          bestColX = rect.right - wrapperRect.left;
        }
      });

      if (bestColIdx >= 0) {
        if (!activeColBtn) {
          activeColBtn = this.createBtn();
          colControls.appendChild(activeColBtn);
        }
        activeColBtn.style.left = `${bestColX - 9}px`;
        activeColBtn.classList.add("visible");
        const idx = bestColIdx;
        activeColBtn.onmousedown = (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          this.addColumn(wrapper, idx);
        };
      } else if (activeColBtn) {
        activeColBtn.classList.remove("visible");
      }

      // Row "+" button
      let bestRowIdx = -1, bestRowDist = Infinity, bestRowY = 0;
      allRows.forEach((row, i) => {
        const rect = row.getBoundingClientRect();
        const dist = Math.abs(my - rect.bottom);
        if (dist < THRESHOLD && dist < bestRowDist) {
          bestRowDist = dist; bestRowIdx = i;
          bestRowY = rect.bottom - wrapperRect.top;
        }
      });

      if (bestRowIdx >= 0) {
        if (!activeRowBtn) {
          activeRowBtn = this.createBtn();
          rowControls.appendChild(activeRowBtn);
        }
        activeRowBtn.style.top = `${bestRowY - 9}px`;
        activeRowBtn.classList.add("visible");
        const idx = bestRowIdx;
        activeRowBtn.onmousedown = (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          this.addRow(wrapper, idx);
        };
      } else if (activeRowBtn) {
        activeRowBtn.classList.remove("visible");
      }
    });

    wrapper.addEventListener("mouseleave", () => {
      if (activeColBtn) activeColBtn.classList.remove("visible");
      if (activeRowBtn) activeRowBtn.classList.remove("visible");
    });

    return wrapper;
  }

  private createBtn(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "table-add-btn";
    btn.type = "button";
    btn.textContent = "+";
    btn.tabIndex = -1;
    btn.setAttribute("contenteditable", "false");
    return btn;
  }

  private handleCellKey(e: KeyboardEvent, _rowIdx: number, _colIdx: number) {
    const target = e.target as HTMLElement;
    const wrapper = target.closest(".cm-source-table-wrapper");
    if (!wrapper) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const allCells = wrapper.querySelectorAll<HTMLElement>("th[contenteditable], td[contenteditable]");
      const cells = Array.from(allCells);
      const currentIdx = cells.indexOf(target);
      const nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1;
      if (nextIdx >= 0 && nextIdx < cells.length) {
        cells[nextIdx].focus();
        // Select all text in the cell
        const range = document.createRange();
        range.selectNodeContents(cells[nextIdx]);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Move to same column in next row
      const allCells = wrapper.querySelectorAll<HTMLElement>("th[contenteditable], td[contenteditable]");
      const cells = Array.from(allCells);
      const cols = this.table.headers.length;
      const currentIdx = cells.indexOf(target);
      const nextIdx = currentIdx + cols;
      if (nextIdx < cells.length) {
        cells[nextIdx].focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      target.blur();
      activeSourceView?.focus();
    }
  }

  private readTableFromDOM(wrapper: Element): ParsedTable {
    const headers: string[] = [];
    const rows: string[][] = [];
    const ths = wrapper.querySelectorAll("thead th");
    ths.forEach((th) => headers.push(th.textContent ?? ""));
    const trs = wrapper.querySelectorAll("tbody tr");
    trs.forEach((tr) => {
      const row: string[] = [];
      tr.querySelectorAll("td").forEach((td) => row.push(td.textContent ?? ""));
      rows.push(row);
    });
    return { headers, alignments: this.table.alignments, rows };
  }

  private syncToDoc() {
    const view = activeSourceView;
    if (!view) return;
    // Find the wrapper DOM element from the focused cell
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    const wrapper = (node instanceof HTMLElement ? node : node?.parentElement)?.closest(".cm-source-table-wrapper");
    if (!wrapper) {
      // Try to find wrapper by position — fallback: use this.from/to directly
      this.syncFromRange(view);
      return;
    }
    const updated = this.readTableFromDOM(wrapper);
    const newText = serializeSourceTable(updated);
    const oldText = view.state.sliceDoc(this.from, this.to);
    if (newText !== oldText) {
      view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
    }
  }

  private syncFromRange(view: EditorView) {
    // Re-read from the DOM of all source table wrappers and find ours by position
    const cmContent = view.dom.querySelector(".cm-content");
    if (!cmContent) return;
    const wrappers = cmContent.querySelectorAll(".cm-source-table-wrapper");
    for (const w of wrappers) {
      const updated = this.readTableFromDOM(w);
      const newText = serializeSourceTable(updated);
      const oldText = view.state.sliceDoc(this.from, this.to);
      if (newText !== oldText && updated.headers.length === this.table.headers.length) {
        view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
        return;
      }
    }
  }

  private addColumn(wrapper: Element, afterColIdx: number) {
    const updated = this.readTableFromDOM(wrapper);
    const insertAt = afterColIdx + 1;
    updated.headers.splice(insertAt, 0, "");
    updated.alignments.splice(insertAt, 0, "none");
    updated.rows.forEach((row) => row.splice(insertAt, 0, ""));
    const newText = serializeSourceTable(updated);
    const view = activeSourceView;
    if (view) {
      view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
    }
  }

  private addRow(wrapper: Element, afterRowIdx: number) {
    const updated = this.readTableFromDOM(wrapper);
    const colCount = updated.headers.length;
    const newRow = Array.from({ length: colCount }, () => "");
    // afterRowIdx 0 = header row, so insert at rows[0]; otherwise rows[afterRowIdx-1]
    const insertAt = afterRowIdx === 0 ? 0 : afterRowIdx;
    updated.rows.splice(insertAt, 0, newRow);
    const newText = serializeSourceTable(updated);
    const view = activeSourceView;
    if (view) {
      view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
    }
  }

  ignoreEvent() { return true; }
}

// Track active view for widget sync-to-doc
const trackActiveView = EditorView.updateListener.of((update) => {
  activeSourceView = update.view;
});

function buildTableDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);
  tree.iterate({
    enter(node) {
      if (node.name === "Table") {
        const text = state.sliceDoc(node.from, node.to);
        const parsed = parseSourceTable(text);
        if (parsed) {
          const widget = new SourceTableWidget(parsed, node.from, node.to);
          builder.add(
            node.from,
            node.to,
            Decoration.replace({ widget, block: true }),
          );
        }
      }
    },
  });
  return builder.finish();
}

const tableWidgetField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      return buildTableDecorations(tr.state);
    }
    return decorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

interface MarkdownSourceProps {
  value: string;
  onChange: (value: string) => void;
  dir?: string;
}

export function MarkdownSource({ value, onChange, dir }: MarkdownSourceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const dirCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const t = useT();

  // Context menu handler for source mode
  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    const view = viewRef.current;
    if (!view) return;

    try {
      const { from, to } = view.state.selection.main;
      const hasSelection = from !== to;

      const menuItems = [];

      menuItems.push(
        await MenuItem.new({
          text: t("editor.contextCut"),
          enabled: hasSelection,
          action: async () => {
            const text = view.state.sliceDoc(from, to);
            await invoke("copy_to_clipboard", { text });
            view.dispatch({ changes: { from, to, insert: "" } });
            view.focus();
          },
        }),
      );
      menuItems.push(
        await MenuItem.new({
          text: t("editor.contextCopy"),
          enabled: hasSelection,
          action: async () => {
            const text = view.state.sliceDoc(from, to);
            await invoke("copy_to_clipboard", { text });
          },
        }),
      );
      menuItems.push(
        await MenuItem.new({
          text: t("editor.contextPaste"),
          action: async () => {
            try {
              const text = await readClipboard();
              if (text) {
                const { from: curFrom, to: curTo } = view.state.selection.main;
                view.dispatch({ changes: { from: curFrom, to: curTo, insert: text } });
                view.focus();
              }
            } catch {
              // Clipboard read failed - ignore
            }
          },
        }),
      );
      menuItems.push(
        await PredefinedMenuItem.new({ item: "Separator" }),
      );
      menuItems.push(
        await MenuItem.new({
          text: t("editor.contextSelectAll"),
          action: () => {
            view.dispatch({
              selection: { anchor: 0, head: view.state.doc.length },
            });
            view.focus();
          },
        }),
      );

      const menu = await Menu.new({ items: menuItems });
      await menu.popup();
    } catch (err) {
      console.error("Source editor context menu error:", err);
    }
  };

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        versoBaseTheme,
        syntaxHighlighting(versoHighlightStyle),
        markdown({ codeLanguages: languages, extensions: [GFM, highlightExtension] }),
        tableWidgetField,
        trackActiveView,
        indentOnInput(),
        bracketMatching(),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        dirCompartment.current.of(
          EditorView.editorAttributes.of({ dir: dir || "ltr" }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    activeSourceView = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      if (activeSourceView === view) activeSourceView = null;
    };
    // Only run on mount/unmount — value sync handled by the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. reloadCurrentNote)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Sync text direction
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: dirCompartment.current.reconfigure(
        EditorView.editorAttributes.of({ dir: dir || "ltr" }),
      ),
    });
  }, [dir]);

  return (
    <div
      ref={containerRef}
      className="h-full"
      spellCheck={false}
      onContextMenu={handleContextMenu}
    />
  );
}
