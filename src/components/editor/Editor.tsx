import { useEffect, useRef, useCallback, useState } from "react";
import {
  useEditor,
  EditorContent,
  ReactRenderer,
  type Editor as TiptapEditor,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";

const lowlight = createLowlight(all);

// lowlight's highlightAuto is unreliable (e.g. detects JS as "ini"),
// so we use pattern-based heuristics for common languages first.
function detectLanguage(code: string): string | null {
  const t = code.trim();
  // HTML/XML
  if (/^<[a-zA-Z!]/.test(t) && /<\/[a-zA-Z]/.test(t)) return "xml";
  // CSS/SCSS
  if (/[.#@]\w[\w-]*\s*\{/.test(t) && /:\s*[^;]+;/.test(t)) return "css";
  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(t) && /\b(FROM|INTO|TABLE|SET|WHERE)\b/i.test(t)) return "sql";
  // Shell/Bash
  if (/^#!\//.test(t) || (/\b(echo|grep|sed|awk|curl|wget|chmod|mkdir|cd|ls)\b/.test(t) && /[\$|;]/.test(t))) return "bash";
  // Python
  if (/\bdef\s+\w+\s*\(/.test(t) && /:$/.test(t.split("\n")[0]?.trim() || "")) return "python";
  if (/\bimport\s+\w+/.test(t) && /\bdef\s+/.test(t)) return "python";
  // Rust
  if (/\bfn\s+\w+/.test(t) && (/\blet\s+(mut\s+)?/.test(t) || /->/.test(t))) return "rust";
  // Go
  if (/\bfunc\s+/.test(t) && /\b:=\b/.test(t)) return "go";
  // Java
  if (/\b(public|private|protected)\s+(static\s+)?(void|int|String|class)\b/.test(t)) return "java";
  // Ruby
  if (/\bdef\s+\w+/.test(t) && /\bend\b/.test(t) && !/;/.test(t)) return "ruby";
  // JSON
  if (/^\s*[\[{]/.test(t) && /[\]}]\s*$/.test(t) && /"[^"]*"\s*:/.test(t)) return "json";
  // YAML
  if (/^\w[\w-]*:\s/.test(t) && !/{/.test(t)) return "yaml";
  // TypeScript (check before JS: type annotations, interfaces)
  if (/\b(interface|type|enum)\s+\w+/.test(t) || /:\s*(string|number|boolean|void)\b/.test(t)) return "typescript";
  // JavaScript/TypeScript (broad match)
  if (/\b(function|const|let|var|=>|import\s+.*\bfrom\b|export\s+(default\s+)?|require\s*\()/.test(t)) return "javascript";
  // C/C++
  if (/\b(#include|printf|scanf|int\s+main)\b/.test(t)) return "c";
  return null;
}

// Patch highlightAuto with smarter detection
const _originalHighlightAuto = lowlight.highlightAuto.bind(lowlight);
lowlight.highlightAuto = (code: string) => {
  const detected = detectLanguage(code);
  if (detected) {
    const result = lowlight.highlight(detected, code);
    (result as any).data = { language: detected };
    return result as any;
  }
  return _originalHighlightAuto(code);
};
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readText as readClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { mod, alt, shift, isMac } from "../../lib/platform";
import { useT, type TranslateFn } from "../../i18n";

// Validate URL scheme for safe opening
function isAllowedUrlScheme(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { useNotes } from "../../context/NotesContext";
import { useTheme } from "../../context/ThemeContext";
import { Frontmatter } from "./Frontmatter";
import { LinkEditor } from "./LinkEditor";
import { SearchToolbar } from "./SearchToolbar";
import { SlashCommand } from "./SlashCommand";
import { HighlightMark } from "./HighlightMark";
import { MarkdownSource } from "./MarkdownSource";
import { TableControls } from "./TableControls";
import { EmptyStateIllustration } from "../illustrations";
import { cn } from "../../lib/utils";
import { plainTextFromMarkdown } from "../../lib/plainText";
import { Button, IconButton, ToolbarButton, Tooltip } from "../ui";
import { downloadPdf, downloadMarkdown } from "../../services/pdf";
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ListIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  QuoteIcon,
  CodeIcon,
  InlineCodeIcon,
  SeparatorIcon,
  LinkIcon,
  ImageIcon,
  TableIcon,
  SpinnerIcon,
  CircleCheckIcon,
  CopyIcon,
  DownloadIcon,
  ShareIcon,
  PanelLeftIcon,
  RefreshCwIcon,
  SearchIcon,
  MarkdownIcon,
  MarkdownOffIcon,
  SettingsIcon,
  HighlightIcon,
} from "../icons";

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Search highlight extension - adds yellow backgrounds to search matches
const searchHighlightPluginKey = new PluginKey("searchHighlight");

interface SearchHighlightOptions {
  matches: Array<{ from: number; to: number }>;
  currentIndex: number;
}

const SearchHighlight = Extension.create<SearchHighlightOptions>({
  name: "searchHighlight",

  addOptions() {
    return {
      matches: [],
      currentIndex: 0,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchHighlightPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, oldSet) => {
            // Map decorations through document changes
            const set = oldSet.map(tr.mapping, tr.doc);

            // Check if we need to update decorations (from transaction meta)
            const meta = tr.getMeta(searchHighlightPluginKey);
            if (meta !== undefined) {
              return meta.decorationSet;
            }

            return set;
          },
        },
        props: {
          decorations: (state) => {
            return searchHighlightPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});

// GridPicker component for table insertion
interface GridPickerProps {
  onSelect: (rows: number, cols: number) => void;
  t: TranslateFn;
}

function GridPicker({ onSelect, t }: GridPickerProps) {
  const [hovered, setHovered] = useState({ row: 3, col: 3 });

  return (
    <>
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 25 }).map((_, i) => {
          const row = Math.floor(i / 5) + 1;
          const col = (i % 5) + 1;
          const isHighlighted = row <= hovered.row && col <= hovered.col;

          return (
            <div
              key={i}
              className={cn(
                "w-5.5 h-5.5 border rounded cursor-pointer transition-colors",
                isHighlighted
                  ? "bg-accent/20 border-accent/50"
                  : "border-border hover:border-accent/50",
              )}
              onMouseEnter={() => setHovered({ row, col })}
              onClick={() => onSelect(row, col)}
            />
          );
        })}
      </div>
      <p className="text-xs text-center mt-2 text-text-muted">
        {t("editor.table", { rows: hovered.row, cols: hovered.col })}
      </p>
    </>
  );
}

interface FormatBarProps {
  editor: TiptapEditor | null;
  onAddLink: () => void;
  onAddImage: () => void;
  t: TranslateFn;
}

// FormatBar must re-render with parent to reflect editor.isActive() state changes
// (editor instance is mutable, so memo would cause stale active states)
function FormatBar({ editor, onAddLink, onAddImage, t }: FormatBarProps) {
  const [tableMenuOpen, setTableMenuOpen] = useState(false);

  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 px-3 pb-2 border-b border-border overflow-x-auto scrollbar-none">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title={t("editor.bold", { shortcut: `${mod}${isMac ? "" : "+"}B` })}
      >
        <BoldIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title={t("editor.italic", { shortcut: `${mod}${isMac ? "" : "+"}I` })}
      >
        <ItalicIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title={t("editor.strikethrough", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}S` })}
      >
        <StrikethroughIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>

      <div className="w-px h-4.5 border-l border-border mx-2" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title={t("editor.heading1", { shortcut: `${mod}${isMac ? "" : "+"}${alt}${isMac ? "" : "+"}1` })}
      >
        <Heading1Icon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title={t("editor.heading2", { shortcut: `${mod}${isMac ? "" : "+"}${alt}${isMac ? "" : "+"}2` })}
      >
        <Heading2Icon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title={t("editor.heading3", { shortcut: `${mod}${isMac ? "" : "+"}${alt}${isMac ? "" : "+"}3` })}
      >
        <Heading3Icon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        isActive={editor.isActive("heading", { level: 4 })}
        title={t("editor.heading4", { shortcut: `${mod}${isMac ? "" : "+"}${alt}${isMac ? "" : "+"}4` })}
      >
        <Heading4Icon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>

      <div className="w-px h-4.5 border-l border-border mx-2" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title={t("editor.bulletList", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}8` })}
      >
        <ListIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title={t("editor.numberedList", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}7` })}
      >
        <ListOrderedIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title={t("editor.taskList")}
      >
        <CheckSquareIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title={t("editor.blockquote", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}B` })}
      >
        <QuoteIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title={t("editor.inlineCode", { shortcut: `${mod}${isMac ? "" : "+"}E` })}
      >
        <InlineCodeIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title={t("editor.codeBlock", { shortcut: `${mod}${isMac ? "" : "+"}${alt}${isMac ? "" : "+"}C` })}
      >
        <CodeIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        isActive={false}
        title={t("editor.horizontalRule")}
      >
        <SeparatorIcon />
      </ToolbarButton>

      <div className="w-px h-4.5 border-l border-border mx-2" />

      <ToolbarButton
        onClick={onAddLink}
        isActive={editor.isActive("link")}
        title={t("editor.addLink", { shortcut: `${mod}${isMac ? "" : "+"}K` })}
      >
        <LinkIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <ToolbarButton onClick={onAddImage} isActive={false} title={t("editor.addImage")}>
        <ImageIcon className="w-4.5 h-4.5 stroke-[1.5]" />
      </ToolbarButton>
      <DropdownMenu.Root open={tableMenuOpen} onOpenChange={setTableMenuOpen}>
        <Tooltip content={t("editor.insertTable")}>
          <DropdownMenu.Trigger asChild>
            <ToolbarButton isActive={editor.isActive("table")}>
              <TableIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </ToolbarButton>
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="p-2.5 bg-bg border border-border rounded-md shadow-lg z-50"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <GridPicker
              t={t}
              onSelect={(rows, cols) => {
                editor
                  .chain()
                  .focus()
                  .insertTable({
                    rows,
                    cols,
                    withHeaderRow: true,
                  })
                  .run();
                setTableMenuOpen(false);
              }}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

interface EditorProps {
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
  sidebarVisible?: boolean;
  focusMode?: boolean;
  onEditorReady?: (editor: TiptapEditor | null) => void;
}

export function Editor({
  onToggleSidebar,
  onOpenSettings,
  sidebarVisible,
  focusMode,
  onEditorReady,
}: EditorProps) {
  const {
    folder,
    currentNote,
    hasExternalChanges,
    reloadCurrentNote,
    reloadVersion,
    saveNote,
    createNote,
  } = useNotes();
  const { textDirection } = useTheme();
  const t = useT();
  const [isSaving, setIsSaving] = useState(false);
  // Force re-render when selection changes to update toolbar active states
  const [, setSelectionKey] = useState(0);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  // Delay transition classes until after initial mount to avoid format bar height animation on note load
  const [hasTransitioned, setHasTransitioned] = useState(false);
  useEffect(() => {
    if (!hasTransitioned && currentNote) {
      const id = requestAnimationFrame(() => setHasTransitioned(true));
      return () => cancelAnimationFrame(id);
    }
  }, [hasTransitioned, currentNote]);
  // Source mode state
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceContent, setSourceContent] = useState("");
  const sourceTimeoutRef = useRef<number | null>(null);
  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<
    Array<{ from: number; to: number }>
  >([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const linkPopupRef = useRef<TippyInstance | null>(null);
  const isLoadingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  // Track if we need to save (use ref to avoid computing markdown on every keystroke)
  const needsSaveRef = useRef(false);

  // Keep ref in sync with current note ID
  currentNoteIdRef.current = currentNote?.id ?? null;

  // Get markdown from editor
  const getMarkdown = useCallback(
    (editorInstance: ReturnType<typeof useEditor>) => {
      if (!editorInstance) return "";
      const manager = editorInstance.storage.markdown?.manager;
      if (manager) {
        let markdown = manager.serialize(editorInstance.getJSON());
        // Clean up nbsp entities that TipTap inserts (especially in table cells)
        markdown = markdown.replace(/&nbsp;|&#160;/g, " ");
        return markdown;
      }
      // Fallback to plain text
      return editorInstance.getText();
    },
    [],
  );

  // Find all matches for search query (case-insensitive)
  const findMatches = useCallback(
    (query: string, editorInstance: TiptapEditor | null) => {
      if (!editorInstance || !query.trim()) return [];

      const doc = editorInstance.state.doc;
      const lowerQuery = query.toLowerCase();
      const matches: Array<{ from: number; to: number }> = [];

      // Search through each text node
      doc.descendants((node, nodePos) => {
        if (node.isText && node.text) {
          const text = node.text;
          const lowerText = text.toLowerCase();

          let searchPos = 0;
          while (searchPos < lowerText.length && matches.length < 500) {
            const index = lowerText.indexOf(lowerQuery, searchPos);
            if (index === -1) break;

            const matchFrom = nodePos + index;
            const matchTo = matchFrom + query.length;

            // Make sure the match doesn't extend beyond valid document bounds
            if (matchTo <= doc.content.size) {
              matches.push({
                from: matchFrom,
                to: matchTo,
              });
            }

            searchPos = index + 1;
          }
        }
      });

      return matches;
    },
    [],
  );

  // Update search decorations - applies yellow backgrounds to all matches
  const updateSearchDecorations = useCallback(
    (
      matches: Array<{ from: number; to: number }>,
      currentIndex: number,
      editorInstance: TiptapEditor | null,
    ) => {
      if (!editorInstance) return;

      try {
        const { state } = editorInstance;
        const decorations: Decoration[] = [];

        // Add decorations for all matches
        matches.forEach((match, index) => {
          const isActive = index === currentIndex;
          decorations.push(
            Decoration.inline(match.from, match.to, {
              class: isActive
                ? "bg-yellow-300/50 dark:bg-yellow-400/40" // Brighter yellow for active match
                : "bg-yellow-300/25 dark:bg-yellow-400/20", // Lighter yellow for inactive matches
            }),
          );
        });

        const decorationSet = DecorationSet.create(state.doc, decorations);

        // Update decorations via transaction
        const tr = state.tr.setMeta(searchHighlightPluginKey, {
          decorationSet,
        });

        editorInstance.view.dispatch(tr);

        // Scroll to current match
        if (matches[currentIndex]) {
          const match = matches[currentIndex];
          const { node } = editorInstance.view.domAtPos(match.from);
          const element =
            node.nodeType === Node.ELEMENT_NODE
              ? (node as HTMLElement)
              : node.parentElement;

          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      } catch (error) {
        console.error("Failed to update search decorations:", error);
      }
    },
    [],
  );

  // Immediate save function (used for flushing)
  const saveImmediately = useCallback(
    async (noteId: string, content: string) => {
      setIsSaving(true);
      try {
        lastSaveRef.current = { noteId, content };
        await saveNote(content, noteId);
      } finally {
        setIsSaving(false);
      }
    },
    [saveNote],
  );

  // Flush any pending save immediately (saves to the note currently loaded in editor)
  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Use loadedNoteIdRef (the note in the editor) not currentNoteIdRef (which may have changed)
    if (needsSaveRef.current && editorRef.current && loadedNoteIdRef.current) {
      needsSaveRef.current = false;
      const markdown = getMarkdown(editorRef.current);
      await saveImmediately(loadedNoteIdRef.current, markdown);
    }
  }, [saveImmediately, getMarkdown]);

  // Schedule a debounced save (markdown computed only when timer fires)
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const savingNoteId = currentNote?.id;
    if (!savingNoteId) return;

    needsSaveRef.current = true;

    saveTimeoutRef.current = window.setTimeout(async () => {
      if (currentNoteIdRef.current !== savingNoteId || !needsSaveRef.current) {
        return;
      }

      // Compute markdown only now, when we actually save
      if (editorRef.current) {
        needsSaveRef.current = false;
        const markdown = getMarkdown(editorRef.current);
        await saveImmediately(savingNoteId, markdown);
      }
    }, 500);
  }, [saveImmediately, getMarkdown, currentNote?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: null,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "underline cursor-pointer",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableKit.configure({
        table: {
          resizable: false,
          HTMLAttributes: {
            class: "not-prose",
          },
        },
      }),
      TableControls,
      HighlightMark,
      Frontmatter,
      Markdown.configure({}),
      SearchHighlight.configure({
        matches: [],
        currentIndex: 0,
      }),
      SlashCommand,
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-lg dark:prose-invert max-w-3xl mx-auto focus:outline-none min-h-full px-6 pt-8 pb-24",
      },
      // Trap Tab key inside the editor
      handleKeyDown: (_view, event) => {
        if (event.key === "Tab") {
          // Allow default tab behavior (indent in lists, etc.)
          // but prevent focus from leaving the editor
          return false;
        }
        return false;
      },
      // Handle markdown and image paste
      handlePaste: (_view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Check for images first
        const items = Array.from(clipboardData.items);
        const imageItem = items.find((item) => item.type.startsWith("image/"));

        if (imageItem) {
          const blob = imageItem.getAsFile();
          if (blob) {
            // Convert blob to base64 and handle async operations
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = (reader.result as string).split(",")[1]; // Remove data:image/...;base64, prefix

              try {
                // Save clipboard image
                const relativePath = await invoke<string>(
                  "save_clipboard_image",
                  { folder, base64Data: base64 },
                );

                // Construct absolute path using Tauri's join
                const absolutePath = await join(folder, relativePath);

                // Convert to Tauri asset URL
                const assetUrl = convertFileSrc(absolutePath);

                // Insert image
                editorRef.current
                  ?.chain()
                  .focus()
                  .setImage({ src: assetUrl })
                  .run();
              } catch (error) {
                console.error("Failed to paste image:", error);
                toast.error(t("editor.failedPasteImage"));
              }
            };
            reader.onerror = () => {
              console.error("Failed to read clipboard image:", reader.error);
              toast.error(t("editor.failedReadImage"));
            };
            reader.readAsDataURL(blob);
            return true; // Handled
          }
        }

        // Handle markdown text paste
        const text = clipboardData.getData("text/plain");
        if (!text) return false;

        // Check if text looks like markdown (has common markdown patterns)
        const markdownPatterns =
          /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s|```|^\s*\[.*\]\(.*\)|^\s*!\[|\*\*.*\*\*|__.*__|~~.*~~|^\s*[-*_]{3,}\s*$|^\|.+\|$/m;
        if (!markdownPatterns.test(text)) {
          // Not markdown, let TipTap handle it normally
          return false;
        }

        // Parse markdown and insert using editor ref
        const currentEditor = editorRef.current;
        if (!currentEditor) return false;

        const manager = currentEditor.storage.markdown?.manager;
        if (manager && typeof manager.parse === "function") {
          try {
            const parsed = manager.parse(text);
            if (parsed) {
              currentEditor.commands.insertContent(parsed);
              return true;
            }
          } catch {
            // Fall back to default paste behavior
          }
        }

        return false;
      },
    },
    onCreate: ({ editor: editorInstance }) => {
      editorRef.current = editorInstance;
    },
    onUpdate: () => {
      if (isLoadingRef.current) return;
      scheduleSave();
    },
    onSelectionUpdate: () => {
      // Trigger re-render to update toolbar active states
      setSelectionKey((k) => k + 1);
    },
    // Prevent flash of unstyled content during initial render
    immediatelyRender: false,
  });

  // Track which note's content is currently loaded in the editor
  const loadedNoteIdRef = useRef<string | null>(null);
  // Track the modified timestamp of the loaded content
  const loadedModifiedRef = useRef<number | null>(null);
  // Track the last save (note ID and content) to detect our own saves vs external changes
  const lastSaveRef = useRef<{ noteId: string; content: string } | null>(null);
  // Track reloadVersion to detect manual refreshes
  const lastReloadVersionRef = useRef(0);

  // Notify parent component when editor is ready
  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  // Store translation function in editor storage for SlashCommand
  useEffect(() => {
    if (editor) {
      (editor.storage as any).slashCommand = { ...(editor.storage as any).slashCommand, t };
    }
  }, [editor, t]);

  // Search navigation functions (defined after editor is created)
  const goToNextMatch = useCallback(() => {
    if (searchMatches.length === 0 || !editor) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    updateSearchDecorations(searchMatches, nextIndex, editor);
  }, [searchMatches, currentMatchIndex, editor, updateSearchDecorations]);

  const goToPreviousMatch = useCallback(() => {
    if (searchMatches.length === 0 || !editor) return;
    const prevIndex =
      (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    updateSearchDecorations(searchMatches, prevIndex, editor);
  }, [searchMatches, currentMatchIndex, editor, updateSearchDecorations]);

  // Handle search query change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      // Clear decorations when search is empty
      if (editor) {
        updateSearchDecorations([], 0, editor);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!editor) return;
      const matches = findMatches(searchQuery, editor);
      setSearchMatches(matches);
      setCurrentMatchIndex(0);
      // Always update decorations (clears old highlights when no matches)
      updateSearchDecorations(matches, 0, editor);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, editor, findMatches, updateSearchDecorations]);

  // Prevent links from opening unless Cmd/Ctrl+Click
  useEffect(() => {
    if (!editor) return;

    const handleLinkClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");

      if (link) {
        e.preventDefault(); // Always prevent default link behavior

        // If Cmd/Ctrl is pressed, open in browser
        if ((e.metaKey || e.ctrlKey) && link.href) {
          if (isAllowedUrlScheme(link.href)) {
            openUrl(link.href).catch((error) =>
              console.error("Failed to open link:", error),
            );
          } else {
            toast.error(t("editor.cannotOpenLink"));
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("click", handleLinkClick);

    return () => {
      editorElement.removeEventListener("click", handleLinkClick);
    };
  }, [editor]);

  // Load note content when the current note changes
  useEffect(() => {
    // Skip if no note or editor
    if (!currentNote || !editor) {
      return;
    }

    const isSameNote = currentNote.id === loadedNoteIdRef.current;

    // Detect rename BEFORE flush to prevent stale-ID saves from creating duplicates.
    // When a save renames the file (title changed), the ID changes but we're still
    // editing the same note. Update loadedNoteIdRef first so any flush uses the new ID.
    if (!isSameNote) {
      const lastSave = lastSaveRef.current;
      if (
        lastSave?.noteId === loadedNoteIdRef.current &&
        lastSave?.content === currentNote.content
      ) {
        loadedNoteIdRef.current = currentNote.id;
        loadedModifiedRef.current = currentNote.modified;
        lastSaveRef.current = null;
        // If user typed during the rename, flush with the now-correct ID
        if (needsSaveRef.current) {
          flushPendingSave();
        }
        return;
      }
    }

    // Flush any pending save before switching to a different note
    if (!isSameNote && needsSaveRef.current) {
      flushPendingSave();
    }
    // Reset source mode when genuinely switching notes (renames return early above)
    if (!isSameNote) {
      setSourceMode(false);
      if (sourceTimeoutRef.current) {
        clearTimeout(sourceTimeoutRef.current);
        sourceTimeoutRef.current = null;
      }
    }
    // Check if this is a manual reload (user clicked Refresh button or pressed Cmd+R)
    const isManualReload = reloadVersion !== lastReloadVersionRef.current;

    if (isSameNote) {
      if (isManualReload) {
        // Manual reload - update the editor content
        lastReloadVersionRef.current = reloadVersion;
        loadedModifiedRef.current = currentNote.modified;
        isLoadingRef.current = true;
        const manager = editor.storage.markdown?.manager;
        if (manager) {
          try {
            const parsed = manager.parse(currentNote.content);
            editor.commands.setContent(parsed);
          } catch {
            editor.commands.setContent(currentNote.content);
          }
        } else {
          editor.commands.setContent(currentNote.content);
        }
        isLoadingRef.current = false;
        return;
      }
      // Just a save - update refs but don't reload content
      loadedModifiedRef.current = currentNote.modified;
      return;
    }

    const isNewNote = loadedNoteIdRef.current === null;
    const wasEmpty = !isNewNote && currentNote.content?.trim() === "";
    const loadingNoteId = currentNote.id;

    loadedNoteIdRef.current = loadingNoteId;
    loadedModifiedRef.current = currentNote.modified;

    isLoadingRef.current = true;

    // Blur editor before setting content to prevent ghost cursor
    editor.commands.blur();

    // Parse markdown and set content
    const manager = editor.storage.markdown?.manager;
    if (manager) {
      try {
        const parsed = manager.parse(currentNote.content);
        editor.commands.setContent(parsed);
      } catch {
        // Fallback to plain text if parsing fails
        editor.commands.setContent(currentNote.content);
      }
    } else {
      editor.commands.setContent(currentNote.content);
    }

    // Scroll to top after content is set (must be after setContent to work reliably)
    scrollContainerRef.current?.scrollTo(0, 0);

    // Capture note ID to check in RAF callback - prevents race condition
    // if user switches notes quickly before RAF fires
    requestAnimationFrame(() => {
      // Bail if a different note started loading
      if (loadedNoteIdRef.current !== loadingNoteId) {
        return;
      }

      // Scroll again in RAF to ensure it takes effect after DOM updates
      scrollContainerRef.current?.scrollTo(0, 0);

      isLoadingRef.current = false;

      // For brand new empty notes, focus and select all so user can start typing
      if ((isNewNote || wasEmpty) && currentNote.content.trim() === "") {
        editor.commands.focus("start");
        editor.commands.selectAll();
      }
      // For existing notes, don't auto-focus - let user click where they want
    });
  }, [currentNote, editor, flushPendingSave, reloadVersion]);

  // Scroll to top on mount (e.g., when returning from settings)
  useEffect(() => {
    scrollContainerRef.current?.scrollTo(0, 0);
  }, []);

  // Cleanup on unmount - flush pending saves
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Flush any pending save before unmounting
      if (needsSaveRef.current && editorRef.current) {
        needsSaveRef.current = false;
        const manager = editorRef.current.storage.markdown?.manager;
        const markdown = manager
          ? manager.serialize(editorRef.current.getJSON())
          : editorRef.current.getText();
        // Fire and forget - save will complete in background
        saveNote(markdown);
      }
      if (linkPopupRef.current) {
        linkPopupRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run cleanup on unmount, not when saveNote changes

  // Link handlers - show inline popup at cursor position
  const handleAddLink = useCallback(() => {
    if (!editor) return;

    // Destroy existing popup if any
    if (linkPopupRef.current) {
      linkPopupRef.current.destroy();
      linkPopupRef.current = null;
    }

    // Get existing link URL if cursor is on a link
    const existingUrl = editor.getAttributes("link").href || "";

    // Get selection bounds for popup placement using DOM Range for accurate multi-line support
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    // Create a virtual element at the selection for tippy to anchor to
    const virtualElement = {
      getBoundingClientRect: () => {
        // For selections with text, use DOM Range for accurate bounds
        if (hasSelection) {
          const startPos = editor.view.domAtPos(from);
          const endPos = editor.view.domAtPos(to);

          if (startPos && endPos) {
            try {
              const range = document.createRange();
              range.setStart(startPos.node, startPos.offset);
              range.setEnd(endPos.node, endPos.offset);
              return range.getBoundingClientRect();
            } catch (e) {
              // Fallback if range creation fails
              console.error("Range creation failed:", e);
            }
          }
        }

        // For collapsed cursor, use coordsAtPos with proper viewport positioning
        const coords = editor.view.coordsAtPos(from);

        // Create a DOMRect-like object with proper positioning
        return {
          width: 2,
          height: 20,
          top: coords.top,
          left: coords.left,
          right: coords.right,
          bottom: coords.bottom,
          x: coords.left,
          y: coords.top,
          toJSON: () => ({}),
        } as DOMRect;
      },
    };

    // Create the link editor component
    const component = new ReactRenderer(LinkEditor, {
      props: {
        initialUrl: existingUrl,
        // Only show text input if there's no selection AND not editing an existing link
        initialText: hasSelection || existingUrl ? undefined : "",
        onSubmit: (url: string, text?: string) => {
          if (url.trim()) {
            if (text !== undefined) {
              // No selection case - insert new link with text
              if (text.trim()) {
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: text.trim(),
                    marks: [{ type: "link", attrs: { href: url.trim() } }],
                  })
                  .run();
              }
            } else {
              // Has selection - apply link to selection
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url.trim() })
                .run();
            }
          } else {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          }
          linkPopupRef.current?.destroy();
          linkPopupRef.current = null;
        },
        onRemove: () => {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          linkPopupRef.current?.destroy();
          linkPopupRef.current = null;
        },
        onCancel: () => {
          editor.commands.focus();
          linkPopupRef.current?.destroy();
          linkPopupRef.current = null;
        },
      },
      editor,
    });

    // Create tippy popup
    linkPopupRef.current = tippy(document.body, {
      getReferenceClientRect: () =>
        virtualElement.getBoundingClientRect() as DOMRect,
      appendTo: () => document.body,
      content: component.element,
      showOnCreate: true,
      interactive: true,
      trigger: "manual",
      placement: "bottom-start",
      offset: [0, 8],
      onDestroy: () => {
        component.destroy();
      },
    });
  }, [editor]);

  // Image handler
  const handleAddImage = useCallback(async () => {
    if (!editor) return;
    const selected = await openDialog({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
        },
      ],
    });
    if (selected) {
      try {
        // Copy image to assets folder and get relative path (assets/filename.ext)
        const relativePath = await invoke<string>("copy_image_to_assets", {
          folder,
          sourcePath: selected as string,
        });

        // Construct absolute path using Tauri's join
        const absolutePath = await join(folder, relativePath);

        // Convert to Tauri asset URL
        const assetUrl = convertFileSrc(absolutePath);

        // Insert image with asset URL
        editor.chain().focus().setImage({ src: assetUrl }).run();
      } catch (error) {
        console.error("Failed to add image:", error);
      }
    }
  }, [editor]);

  // Listen for slash command image insertion
  useEffect(() => {
    const handler = () => handleAddImage();
    window.addEventListener("slash-command-image", handler);
    return () => window.removeEventListener("slash-command-image", handler);
  }, [handleAddImage]);

  // Keyboard shortcut for Cmd+K to add link (only when editor is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Only handle if we're in the editor
        const target = e.target as HTMLElement;
        const isInEditor = target.closest(".ProseMirror");
        if (isInEditor && editor) {
          e.preventDefault();
          handleAddLink();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleAddLink, editor]);

  // Keyboard shortcut for Cmd+Shift+C to open copy menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        setCopyMenuOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cmd+F to open search (works when document/editor area is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        if (!currentNote || !editor) return;

        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();

        // Don't intercept if user is in an input/textarea (except the editor itself)
        if (
          (tagName === "input" || tagName === "textarea") &&
          !target.closest(".ProseMirror")
        ) {
          return;
        }

        // Don't intercept if in sidebar
        if (target.closest('[class*="sidebar"]')) {
          return;
        }

        // Open search for the editor
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, currentNote]);

  // Clear search on note switch
  useEffect(() => {
    if (currentNote?.id) {
      setSearchOpen(false);
      setSearchQuery("");
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      // Clear decorations
      if (editor) {
        updateSearchDecorations([], 0, editor);
      }
    }
  }, [currentNote?.id, editor, updateSearchDecorations]);

  // Copy handlers
  const handleCopyMarkdown = useCallback(async () => {
    if (!editor) return;
    try {
      const markdown = getMarkdown(editor);
      await invoke("copy_to_clipboard", { text: markdown });
      toast.success(t("toast.copiedMarkdown"));
    } catch (error) {
      console.error("Failed to copy markdown:", error);
      toast.error(t("toast.copyFailed"));
    }
  }, [editor, getMarkdown]);

  const handleCopyPlainText = useCallback(async () => {
    if (!editor) return;
    try {
      const markdown = getMarkdown(editor);
      const plainText = plainTextFromMarkdown(markdown);
      await invoke("copy_to_clipboard", { text: plainText });
      toast.success(t("toast.copiedPlainText"));
    } catch (error) {
      console.error("Failed to copy plain text:", error);
      toast.error(t("toast.copyFailed"));
    }
  }, [editor, getMarkdown]);

  const handleCopyHtml = useCallback(async () => {
    if (!editor) return;
    try {
      const html = editor.getHTML();
      await invoke("copy_to_clipboard", { text: html });
      toast.success(t("toast.copiedHtml"));
    } catch (error) {
      console.error("Failed to copy HTML:", error);
      toast.error(t("toast.copyFailed"));
    }
  }, [editor]);

  // Download handlers
  const handleDownloadPdf = useCallback(async () => {
    if (!editor || !currentNote) return;
    try {
      await downloadPdf(editor, currentNote.title);
      // Note: window.print() opens the print dialog but doesn't wait for user action
      // No success toast needed - the print dialog provides its own feedback
    } catch (error) {
      console.error("Failed to open print dialog:", error);
      toast.error(t("toast.printFailed"));
    }
  }, [editor, currentNote]);

  const handleDownloadMarkdown = useCallback(async () => {
    if (!editor || !currentNote) return;
    try {
      const markdown = getMarkdown(editor);
      const saved = await downloadMarkdown(markdown, currentNote.title);
      if (saved) {
        toast.success(t("toast.markdownSaved"));
      }
    } catch (error) {
      console.error("Failed to download markdown:", error);
      toast.error(t("toast.markdownSaveFailed"));
    }
  }, [editor, currentNote, getMarkdown]);

  // Toggle source mode
  const toggleSourceMode = useCallback(() => {
    if (!editor) return;
    try {
      if (!sourceMode) {
        // Entering source mode: get markdown from editor
        const md = getMarkdown(editor);
        console.log("[source-mode] entering, md length:", md.length);
        setSourceContent(md);
        setSourceMode(true);
      } else {
        // Exiting source mode: parse markdown back to TipTap JSON, then set content
        const manager = editor.storage.markdown?.manager;
        if (manager) {
          try {
            const parsed = manager.parse(sourceContent);
            editor.commands.setContent(parsed);
          } catch {
            editor.commands.setContent(sourceContent);
          }
        } else {
          editor.commands.setContent(sourceContent);
        }
        setSourceMode(false);
      }
    } catch (err) {
      console.error("[source-mode] toggleSourceMode error:", err);
    }
  }, [editor, sourceMode, sourceContent, getMarkdown]);

  // Listen for toggle-source-mode custom event (from App.tsx shortcut / command palette)
  useEffect(() => {
    const handler = () => toggleSourceMode();
    window.addEventListener("toggle-source-mode", handler);
    return () => window.removeEventListener("toggle-source-mode", handler);
  }, [toggleSourceMode]);

  // Auto-save in source mode with debounce
  const handleSourceChange = useCallback(
    (value: string) => {
      setSourceContent(value);
      if (sourceTimeoutRef.current) {
        clearTimeout(sourceTimeoutRef.current);
      }
      sourceTimeoutRef.current = window.setTimeout(async () => {
        if (currentNote) {
          setIsSaving(true);
          try {
            lastSaveRef.current = { noteId: currentNote.id, content: value };
            await saveNote(value, currentNote.id);
          } catch (error) {
            console.error("Failed to save note:", error);
            toast.error(t("toast.saveFailed"));
          } finally {
            setIsSaving(false);
          }
        }
      }, 300);
    },
    [currentNote, saveNote],
  );

  // Pangu spacing: add spaces between CJK and Latin/number characters
  useEffect(() => {
    const handler = () => {
      const addPanguSpacing = (text: string): string => {
        // Split by code blocks and inline code to skip them
        const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
        return parts
          .map((part, i) => {
            if (i % 2 === 1) return part; // code block/inline code, skip
            return part
              .replace(/([\u2e80-\u9fff\uf900-\ufaff\ufe30-\ufe4f])([A-Za-z0-9])/g, "$1 $2")
              .replace(/([A-Za-z0-9])([\u2e80-\u9fff\uf900-\ufaff\ufe30-\ufe4f])/g, "$1 $2");
          })
          .join("");
      };

      if (sourceMode) {
        const formatted = addPanguSpacing(sourceContent);
        if (formatted !== sourceContent) {
          handleSourceChange(formatted);
          toast.success(t("toast.panguSpacing"));
        } else {
          toast(t("toast.panguNoChange"));
        }
      } else if (editor) {
        const markdown = getMarkdown(editor);
        const formatted = addPanguSpacing(markdown);
        if (formatted !== markdown) {
          const manager = editor.storage.markdown?.manager;
          if (manager) {
            try {
              const parsed = manager.parse(formatted);
              editor.commands.setContent(parsed);
            } catch {
              editor.commands.setContent(formatted);
            }
          } else {
            editor.commands.setContent(formatted);
          }
          scheduleSave();
          toast.success(t("toast.panguSpacing"));
        } else {
          toast(t("toast.panguNoChange"));
        }
      }
    };

    window.addEventListener("format-pangu-spacing", handler);
    return () => window.removeEventListener("format-pangu-spacing", handler);
  }, [sourceMode, sourceContent, handleSourceChange, editor, getMarkdown, scheduleSave, t]);

  if (!currentNote) {
    // Show empty state with "New Note" button
    return (
      <div className="flex-1 flex flex-col bg-bg">
        {/* Drag region */}
        <div
          className="h-10 shrink-0 flex items-end px-4 pb-1"
          data-tauri-drag-region
        ></div>
        <div className="flex-1 flex items-center justify-center pb-8">
          <div className="text-center text-text-muted select-none">
            <EmptyStateIllustration
              className="w-42 h-auto mx-auto mb-1 text-text"
            />
            <h1 className="text-2xl text-text font-sans font-semibold mb-1 tracking-[-0.01em]">
              {t("editor.emptyTitle")}
            </h1>
            <p className="text-sm">
              {t("editor.emptySubtitle")}
            </p>
            {createNote && (
              <Button
                onClick={createNote}
                variant="secondary"
                size="md"
                className="mt-4"
              >
                {t("editor.newNote")}{" "}
                <span className="text-text-muted ml-1">
                  {mod}
                  {isMac ? "" : "+"}N
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* Drag region with sidebar toggle, date and save status */}
      <div
        className={cn(
          "h-11 shrink-0 flex items-center justify-between px-3",
          focusMode && "pl-22",
        )}
        data-tauri-drag-region
      >
        <div
          className={`titlebar-no-drag flex items-center gap-1 min-w-0 transition-opacity duration-1000 delay-500 ${focusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          {onToggleSidebar && (
            <IconButton
              onClick={onToggleSidebar}
              title={
                sidebarVisible
                  ? t("editor.hideSidebar", { shortcut: `${mod}${isMac ? "" : "+"}\\` })
                  : t("editor.showSidebar", { shortcut: `${mod}${isMac ? "" : "+"}\\` })
              }
              className="shrink-0"
            >
              <PanelLeftIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </IconButton>
          )}
          <span className="text-xs text-text-muted mb-px truncate">
            {formatDateTime(currentNote.modified)}
          </span>
        </div>
        <div
          className={`titlebar-no-drag flex items-center gap-px shrink-0 transition-opacity duration-1000 delay-500 ${focusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          {hasExternalChanges ? (
            <Tooltip
              content={t("editor.externalChanges", { shortcut: `${mod}${isMac ? "" : "+"}R` })}
            >
              <button
                onClick={reloadCurrentNote}
                className="h-7 px-2 flex items-center gap-1 text-xs text-text-muted hover:bg-bg-emphasis rounded transition-colors font-medium"
              >
                <RefreshCwIcon className="w-4 h-4 stroke-[1.6]" />
                <span>{t("editor.refresh")}</span>
              </button>
            </Tooltip>
          ) : isSaving ? (
            <Tooltip content={t("editor.saving")}>
              <div className="h-7 w-7 flex items-center justify-center">
                <SpinnerIcon className="w-4.5 h-4.5 text-text-muted/40 stroke-[1.5] animate-spin" />
              </div>
            </Tooltip>
          ) : (
            <Tooltip content={t("editor.allSaved")}>
              <div className="h-7 w-7 flex items-center justify-center rounded-full">
                <CircleCheckIcon className="w-4.5 h-4.5 mt-px stroke-[1.5] text-text-muted/40" />
              </div>
            </Tooltip>
          )}
          {currentNote && (
            <Tooltip content={t("editor.findInNote", { shortcut: `${mod}${isMac ? "" : "+"}F` })}>
              <IconButton onClick={() => setSearchOpen(true)}>
                <SearchIcon className="w-4.25 h-4.25 stroke-[1.6]" />
              </IconButton>
            </Tooltip>
          )}
          {currentNote && (
            <Tooltip
              content={
                sourceMode
                  ? t("editor.viewFormatted", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}M` })
                  : t("editor.viewSource", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}M` })
              }
            >
              <IconButton onClick={toggleSourceMode}>
                {sourceMode ? (
                  <MarkdownOffIcon className="w-4.75 h-4.75 stroke-[1.4]" />
                ) : (
                  <MarkdownIcon className="w-4.75 h-4.75 stroke-[1.4]" />
                )}
              </IconButton>
            </Tooltip>
          )}
          <DropdownMenu.Root open={copyMenuOpen} onOpenChange={setCopyMenuOpen}>
            <Tooltip
              content={t("editor.export", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}C` })}
            >
              <DropdownMenu.Trigger asChild>
                <IconButton>
                  <ShareIcon className="w-4.25 h-4.25 stroke-[1.6]" />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-35 bg-bg border border-border rounded-md shadow-lg py-1 z-50"
                sideOffset={5}
                align="end"
                onCloseAutoFocus={(e) => {
                  // Prevent focus returning to trigger button
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  // Stop arrow keys from bubbling to note list navigation
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.stopPropagation();
                  }
                }}
              >
                <DropdownMenu.Item
                  className="px-3 py-1.5 text-sm text-text cursor-pointer outline-none hover:bg-bg-muted focus:bg-bg-muted flex items-center gap-2"
                  onSelect={handleCopyMarkdown}
                >
                  <CopyIcon className="w-4 h-4 stroke-[1.6]" />
                  {t("editor.copyMarkdown")}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-1.5 text-sm text-text cursor-pointer outline-none hover:bg-bg-muted focus:bg-bg-muted flex items-center gap-2"
                  onSelect={handleCopyPlainText}
                >
                  <CopyIcon className="w-4 h-4 stroke-[1.6]" />
                  {t("editor.copyPlainText")}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-1.5 text-sm text-text cursor-pointer outline-none hover:bg-bg-muted focus:bg-bg-muted flex items-center gap-2"
                  onSelect={handleCopyHtml}
                >
                  <CopyIcon className="w-4 h-4 stroke-[1.6]" />
                  {t("editor.copyHtml")}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  className="px-3 py-1.5 text-sm text-text cursor-pointer outline-none hover:bg-bg-muted focus:bg-bg-muted flex items-center gap-2"
                  onSelect={handleDownloadPdf}
                >
                  <DownloadIcon className="w-4 h-4 stroke-[1.6]" />
                  {t("editor.printPdf")}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-1.5 text-sm text-text cursor-pointer outline-none hover:bg-bg-muted focus:bg-bg-muted flex items-center gap-2"
                  onSelect={handleDownloadMarkdown}
                >
                  <DownloadIcon className="w-4 h-4 stroke-[1.6]" />
                  {t("editor.exportMarkdown")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {!sidebarVisible && onOpenSettings && (
            <Tooltip content={t("editor.settings", { shortcut: `${mod}${isMac ? "" : "+"},` })}>
              <IconButton onClick={onOpenSettings}>
                <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Format Bar – transition only after initial mount to avoid height animation on note load */}
      <div
        className={`${focusMode || sourceMode ? "opacity-0 max-h-0 overflow-hidden pointer-events-none" : "opacity-100 max-h-20"} ${hasTransitioned ? "transition-all duration-1000 delay-500" : ""}`}
      >
        <FormatBar
          editor={editor}
          onAddLink={handleAddLink}
          onAddImage={handleAddImage}
          t={t}
        />
      </div>

      {/* Editor content area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-editor"
        dir={textDirection}
      >
        {sourceMode ? (
          /* CodeMirror 6 source editor — absolute fill to guarantee height for CM */
          <div className="absolute inset-0">
            <MarkdownSource
              value={sourceContent}
              onChange={handleSourceChange}
              dir={textDirection}
            />
          </div>
        ) : (
          <>
            {searchOpen && (
              <div className="sticky top-2 z-10 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none pr-2 flex justify-end">
                <div className="pointer-events-auto">
                  <SearchToolbar
                    query={searchQuery}
                    onChange={handleSearchChange}
                    onNext={goToNextMatch}
                    onPrevious={goToPreviousMatch}
                    onClose={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      setSearchMatches([]);
                      setCurrentMatchIndex(0);
                      // Clear decorations and refocus editor
                      if (editor) {
                        updateSearchDecorations([], 0, editor);
                        editor.commands.focus();
                      }
                    }}
                    currentMatch={
                      searchMatches.length === 0 ? 0 : currentMatchIndex + 1
                    }
                    totalMatches={searchMatches.length}
                  />
                </div>
              </div>
            )}
            <div
              className="h-full"
              onContextMenu={async (e) => {
                if (!editor) return;

                // Non-table area: show editor context menu (Cut/Copy/Paste/Select All)
                if (!editor.isActive("table")) {
                  e.preventDefault();
                  try {
                    const { from, to } = editor.state.selection;
                    const hasSelection = from !== to;

                    const menuItems = [];

                    menuItems.push(
                      await MenuItem.new({
                        text: t("editor.contextCut"),
                        enabled: hasSelection,
                        action: async () => {
                          const text = editor.state.doc.textBetween(from, to, "\n");
                          await invoke("copy_to_clipboard", { text });
                          editor.chain().focus().deleteSelection().run();
                        },
                      }),
                    );
                    menuItems.push(
                      await MenuItem.new({
                        text: t("editor.contextCopy"),
                        enabled: hasSelection,
                        action: async () => {
                          const text = editor.state.doc.textBetween(from, to, "\n");
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
                              editor.chain().focus().command(({ tr }) => {
                                tr.insertText(text);
                                return true;
                              }).run();
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
                          editor.chain().focus().selectAll().run();
                        },
                      }),
                    );

                    const menu = await Menu.new({ items: menuItems });
                    await menu.popup();
                  } catch (err) {
                    console.error("Editor context menu error:", err);
                  }
                  return;
                }

                e.preventDefault();

                try {
                  // Get the position at the click coordinates
                  const clickPos = editor.view.posAtCoords({
                    left: e.clientX,
                    top: e.clientY,
                  });

                  if (!clickPos) return;

                  // Set the selection to the clicked position
                  editor.chain().focus().setTextSelection(clickPos.pos).run();

                  // Now work with the updated selection
                  const { state } = editor;
                  const { selection } = state;
                  const { $anchor } = selection;

                  // Find the table cell/header node
                  let cellDepth = $anchor.depth;
                  while (
                    cellDepth > 0 &&
                    state.doc.resolve($anchor.pos).node(cellDepth).type.name !==
                      "tableCell" &&
                    state.doc.resolve($anchor.pos).node(cellDepth).type.name !==
                      "tableHeader"
                  ) {
                    cellDepth--;
                  }

                  // Guard: if we didn't find a table cell, bail out
                  if (cellDepth <= 0) return;

                  const resolvedNode = state.doc
                    .resolve($anchor.pos)
                    .node(cellDepth);
                  if (
                    resolvedNode.type.name !== "tableCell" &&
                    resolvedNode.type.name !== "tableHeader"
                  ) {
                    return;
                  }

                  // Get the cell position
                  const cellPos = $anchor.before(cellDepth);

                  // Check if we're in the first column (index 0 in parent row)
                  const rowNode = state.doc
                    .resolve(cellPos)
                    .node(cellDepth - 1);
                  let cellIndex = 0;
                  rowNode.forEach((_node, offset) => {
                    if (offset < cellPos - $anchor.before(cellDepth - 1) - 1) {
                      cellIndex++;
                    }
                  });
                  const isFirstColumn = cellIndex === 0;

                  // Check if we're in the first row (index 0 in parent table)
                  const tableNode = state.doc
                    .resolve(cellPos)
                    .node(cellDepth - 2);
                  let rowIndex = 0;
                  tableNode.forEach((_node, offset) => {
                    if (
                      offset <
                      $anchor.before(cellDepth - 1) -
                        $anchor.before(cellDepth - 2) -
                        1
                    ) {
                      rowIndex++;
                    }
                  });
                  const isFirstRow = rowIndex === 0;

                  const menuItems = [];

                  // Only show "Add Column Before" if not in first column
                  if (!isFirstColumn) {
                    menuItems.push(
                      await MenuItem.new({
                        text: t("table.addColumnBefore"),
                        action: () =>
                          editor.chain().focus().addColumnBefore().run(),
                      }),
                    );
                  }
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.addColumnAfter"),
                      action: () =>
                        editor.chain().focus().addColumnAfter().run(),
                    }),
                  );
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.deleteColumn"),
                      action: () => editor.chain().focus().deleteColumn().run(),
                    }),
                  );
                  menuItems.push(
                    await PredefinedMenuItem.new({ item: "Separator" }),
                  );

                  // Only show "Add Row Above" if not in first row
                  if (!isFirstRow) {
                    menuItems.push(
                      await MenuItem.new({
                        text: t("table.addRowAbove"),
                        action: () =>
                          editor.chain().focus().addRowBefore().run(),
                      }),
                    );
                  }
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.addRowBelow"),
                      action: () => editor.chain().focus().addRowAfter().run(),
                    }),
                  );
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.deleteRow"),
                      action: () => editor.chain().focus().deleteRow().run(),
                    }),
                  );
                  menuItems.push(
                    await PredefinedMenuItem.new({ item: "Separator" }),
                  );
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.toggleHeaderRow"),
                      action: () =>
                        editor.chain().focus().toggleHeaderRow().run(),
                    }),
                  );
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.toggleHeaderColumn"),
                      action: () =>
                        editor.chain().focus().toggleHeaderColumn().run(),
                    }),
                  );
                  menuItems.push(
                    await PredefinedMenuItem.new({ item: "Separator" }),
                  );
                  menuItems.push(
                    await MenuItem.new({
                      text: t("table.deleteTable"),
                      action: () => editor.chain().focus().deleteTable().run(),
                    }),
                  );

                  const menu = await Menu.new({ items: menuItems });

                  await menu.popup();
                } catch (err) {
                  console.error("Table context menu error:", err);
                }
              }}
            >
              {editor && (
                <BubbleMenu
                  editor={editor}
                  options={{ placement: "top", offset: 8 }}
                >
                  <div className="bubble-toolbar">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={editor.isActive("bold") ? "is-active" : ""}
                      title={t("editor.bold", { shortcut: `${mod}${isMac ? "" : "+"}B` })}
                    >
                      <BoldIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={editor.isActive("italic") ? "is-active" : ""}
                      title={t("editor.italic", { shortcut: `${mod}${isMac ? "" : "+"}I` })}
                    >
                      <ItalicIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().toggleStrike().run()}
                      className={editor.isActive("strike") ? "is-active" : ""}
                      title={t("editor.strikethrough", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}S` })}
                    >
                      <StrikethroughIcon className="w-3.5 h-3.5" />
                    </button>
                    <div className="bubble-toolbar-separator" />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().toggleCode().run()}
                      className={editor.isActive("code") ? "is-active" : ""}
                      title={t("editor.inlineCode", { shortcut: `${mod}${isMac ? "" : "+"}E` })}
                    >
                      <InlineCodeIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().toggleHighlight().run()}
                      className={editor.isActive("highlight") ? "is-active" : ""}
                      title={t("editor.highlight")}
                    >
                      <HighlightIcon className="w-3.5 h-3.5" />
                    </button>
                    <div className="bubble-toolbar-separator" />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleAddLink}
                      className={editor.isActive("link") ? "is-active" : ""}
                      title={t("editor.addLink", { shortcut: `${mod}${isMac ? "" : "+"}K` })}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </BubbleMenu>
              )}
              <EditorContent editor={editor} className="h-full text-text" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
