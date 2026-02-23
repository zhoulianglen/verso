import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

const tableControlsKey = new PluginKey("tableControls");

export const TableControls = Extension.create({
  name: "tableControls",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: tableControlsKey,
        view() {
          return new TableControlsView(editor);
        },
      }),
    ];
  },
});

class TableControlsView {
  private editor: Editor;
  private activeWrapper: HTMLElement | null = null;
  private colContainer: HTMLElement | null = null;
  private rowContainer: HTMLElement | null = null;
  private activeColBtn: HTMLElement | null = null;
  private activeRowBtn: HTMLElement | null = null;
  private listeners = new Map<
    HTMLElement,
    { enter: () => void; leave: () => void; move: (e: MouseEvent) => void }
  >();

  constructor(editor: Editor) {
    this.editor = editor;
    requestAnimationFrame(() => this.scan());
  }

  update() {
    if (this.activeWrapper && !this.activeWrapper.isConnected) {
      this.removeControls();
      this.activeWrapper = null;
    }
    if (
      this.activeWrapper &&
      this.colContainer &&
      !this.colContainer.isConnected
    ) {
      this.createControls(this.activeWrapper);
    }
    this.scan();
  }

  destroy() {
    for (const [el, handlers] of this.listeners) {
      el.removeEventListener("mouseenter", handlers.enter);
      el.removeEventListener("mouseleave", handlers.leave);
      el.removeEventListener("mousemove", handlers.move);
    }
    this.listeners.clear();
    this.removeControls();
  }

  private scan() {
    const root = this.editor.view.dom;
    if (!root) return;

    const wrappers = root.querySelectorAll<HTMLElement>(".tableWrapper");

    // Unbind disconnected wrappers
    for (const [el, handlers] of this.listeners) {
      if (!el.isConnected) {
        el.removeEventListener("mouseenter", handlers.enter);
        el.removeEventListener("mouseleave", handlers.leave);
        el.removeEventListener("mousemove", handlers.move);
        this.listeners.delete(el);
      }
    }

    // Bind new wrappers
    wrappers.forEach((w) => {
      if (!this.listeners.has(w)) {
        const enter = () => this.onEnter(w);
        const leave = () => this.onLeave(w);
        const move = (e: MouseEvent) => this.onMove(w, e);
        w.addEventListener("mouseenter", enter);
        w.addEventListener("mouseleave", leave);
        w.addEventListener("mousemove", move);
        this.listeners.set(w, { enter, leave, move });
      }
    });
  }

  private onEnter(wrapper: HTMLElement) {
    if (this.activeWrapper && this.activeWrapper !== wrapper) {
      this.removeControls();
    }
    this.activeWrapper = wrapper;
    this.createControls(wrapper);
  }

  private onLeave(wrapper: HTMLElement) {
    if (this.activeWrapper === wrapper) {
      this.removeControls();
      this.activeWrapper = null;
    }
  }

  private onMove(wrapper: HTMLElement, e: MouseEvent) {
    if (this.activeWrapper !== wrapper) return;

    const table = wrapper.querySelector("table");
    if (!table) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return;

    const firstRow = rows[0];
    const cells = firstRow.querySelectorAll<HTMLElement>("th, td");

    const THRESHOLD = 15;
    const mx = e.clientX;
    const my = e.clientY;

    // --- Column "+" button ---
    let bestColIdx = -1;
    let bestColDist = Infinity;
    let bestColX = 0;

    cells.forEach((cell, i) => {
      const rect = cell.getBoundingClientRect();
      const dist = Math.abs(mx - rect.right);
      if (dist < THRESHOLD && dist < bestColDist) {
        bestColDist = dist;
        bestColIdx = i;
        bestColX = rect.right - wrapperRect.left;
      }
    });

    if (bestColIdx >= 0 && this.colContainer) {
      if (!this.activeColBtn) {
        this.activeColBtn = this.createBtn();
        this.colContainer.appendChild(this.activeColBtn);
      }
      this.activeColBtn.style.left = `${bestColX - 9}px`;
      this.activeColBtn.classList.add("visible");

      const idx = bestColIdx;
      this.activeColBtn.onmousedown = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.insertColumnAfter(wrapper, idx);
      };
    } else if (this.activeColBtn) {
      this.activeColBtn.classList.remove("visible");
    }

    // --- Row "+" button ---
    let bestRowIdx = -1;
    let bestRowDist = Infinity;
    let bestRowY = 0;

    rows.forEach((row, i) => {
      const rect = row.getBoundingClientRect();
      const dist = Math.abs(my - rect.bottom);
      if (dist < THRESHOLD && dist < bestRowDist) {
        bestRowDist = dist;
        bestRowIdx = i;
        bestRowY = rect.bottom - wrapperRect.top;
      }
    });

    if (bestRowIdx >= 0 && this.rowContainer) {
      if (!this.activeRowBtn) {
        this.activeRowBtn = this.createBtn();
        this.rowContainer.appendChild(this.activeRowBtn);
      }
      this.activeRowBtn.style.top = `${bestRowY - 9}px`;
      this.activeRowBtn.classList.add("visible");

      const idx = bestRowIdx;
      this.activeRowBtn.onmousedown = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.insertRowAfter(wrapper, idx);
      };
    } else if (this.activeRowBtn) {
      this.activeRowBtn.classList.remove("visible");
    }
  }

  private createControls(wrapper: HTMLElement) {
    this.removeControls();

    this.colContainer = document.createElement("div");
    this.colContainer.className = "table-col-controls";
    this.colContainer.contentEditable = "false";
    wrapper.appendChild(this.colContainer);

    this.rowContainer = document.createElement("div");
    this.rowContainer.className = "table-row-controls";
    this.rowContainer.contentEditable = "false";
    wrapper.appendChild(this.rowContainer);
  }

  private removeControls() {
    this.colContainer?.remove();
    this.rowContainer?.remove();
    this.colContainer = null;
    this.rowContainer = null;
    this.activeColBtn = null;
    this.activeRowBtn = null;
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

  private insertColumnAfter(wrapper: HTMLElement, colIdx: number) {
    const table = wrapper.querySelector("table");
    if (!table) return;

    const firstRow = table.querySelector("tr");
    if (!firstRow) return;

    const cells = firstRow.querySelectorAll("th, td");
    const cell = cells[colIdx];
    if (!cell) return;

    try {
      const pos = this.editor.view.posAtDOM(cell, 0);
      this.editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
    } catch (err) {
      console.error("TableControls: failed to insert column", err);
    }
  }

  private insertRowAfter(wrapper: HTMLElement, rowIdx: number) {
    const table = wrapper.querySelector("table");
    if (!table) return;

    const rows = table.querySelectorAll("tr");
    const row = rows[rowIdx];
    if (!row) return;

    const firstCell = row.querySelector("th, td");
    if (!firstCell) return;

    try {
      const pos = this.editor.view.posAtDOM(firstCell, 0);
      this.editor.chain().focus().setTextSelection(pos).addRowAfter().run();
    } catch (err) {
      console.error("TableControls: failed to insert row", err);
    }
  }
}
