import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useNotes } from "../../context/NotesContext";
import { useTheme } from "../../context/ThemeContext";
import { downloadPdf, downloadMarkdown } from "../../services/pdf";
import type { Editor } from "@tiptap/react";
import {
  CommandItem,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui";
import { useT } from "../../i18n";
import { cleanTitle } from "../../lib/utils";
import { plainTextFromMarkdown } from "../../lib/plainText";
import {
  CopyIcon,
  DownloadIcon,
  SettingsIcon,
  SwatchIcon,
  AddNoteIcon,
  FolderIcon,
  TrashIcon,
  MarkdownIcon,
  TextSpacingIcon,
} from "../icons";
import { mod, shift } from "../../lib/platform";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  editorRef?: React.RefObject<Editor | null>;
}

export function CommandPalette({
  open,
  onClose,
  onOpenSettings,
  editorRef,
}: CommandPaletteProps) {
  const {
    notes,
    selectNote,
    createNote,
    deleteNote,
    duplicateNote,
    currentNote,
    folder,
  } = useNotes();
  const { setTheme } = useTheme();
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [localSearchResults, setLocalSearchResults] = useState<
    { id: string; title: string; preview: string; modified: number }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Track whether selection was changed by keyboard (for scroll-into-view)
  const selectionSourceRef = useRef<"keyboard" | "mouse">("keyboard");

  // Memoize commands array — use refs for callbacks to avoid unnecessary recalculation
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onOpenSettingsRef = useRef(onOpenSettings);
  onOpenSettingsRef.current = onOpenSettings;
  const createNoteRef = useRef(createNote);
  createNoteRef.current = createNote;
  const deleteNoteRef = useRef(deleteNote);
  deleteNoteRef.current = deleteNote;
  const duplicateNoteRef = useRef(duplicateNote);
  duplicateNoteRef.current = duplicateNote;
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;
  const editorRefLatest = useRef(editorRef);
  editorRefLatest.current = editorRef;

  const commands = useMemo<Command[]>(() => {
    const baseCommands: Command[] = [
      {
        id: "new-note",
        label: t("palette.newNote"),
        shortcut: `${mod} N`,
        icon: <AddNoteIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          createNoteRef.current();
          onCloseRef.current();
        },
      },
      {
        id: "open-folder",
        label: t("palette.openFolder"),
        shortcut: `${mod} O`,
        icon: <FolderIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          window.dispatchEvent(new CustomEvent("open-folder-dialog"));
          onCloseRef.current();
        },
      },
    ];

    // Add note-specific commands if a note is selected
    if (currentNote) {
      baseCommands.push(
        {
          id: "duplicate-note",
          label: t("palette.duplicateNote"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              await duplicateNoteRef.current(currentNote.id);
              onCloseRef.current();
            } catch (error) {
              console.error("Failed to duplicate note:", error);
            }
          },
        },
        {
          id: "delete-note",
          label: t("palette.deleteNote"),
          icon: <TrashIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: () => {
            setNoteToDelete(currentNote.id);
            setDeleteDialogOpen(true);
          },
        },
        {
          id: "copy-markdown",
          label: t("palette.copyMarkdown"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              await invoke("copy_to_clipboard", { text: currentNote.content });
              toast.success(t("toast.copiedMarkdown"));
              onCloseRef.current();
            } catch (error) {
              console.error("Failed to copy markdown:", error);
              toast.error(t("toast.copyFailed"));
            }
          },
        },
        {
          id: "copy-plain",
          label: t("palette.copyPlainText"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              const plainText = plainTextFromMarkdown(currentNote.content);
              await invoke("copy_to_clipboard", { text: plainText });
              toast.success(t("toast.copiedPlainText"));
              onCloseRef.current();
            } catch (error) {
              console.error("Failed to copy plain text:", error);
              toast.error(t("toast.copyFailed"));
            }
          },
        },
        {
          id: "copy-html",
          label: t("palette.copyHtml"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              const editor = editorRefLatest.current?.current;
              if (!editor) {
                toast.error(t("toast.editorNotAvailable"));
                return;
              }
              const html = editor.getHTML();
              await invoke("copy_to_clipboard", { text: html });
              toast.success(t("toast.copiedHtml"));
              onCloseRef.current();
            } catch (error) {
              console.error("Failed to copy HTML:", error);
              toast.error(t("toast.copyFailed"));
            }
          },
        },
        {
          id: "download-pdf",
          label: t("palette.printPdf"),
          icon: <DownloadIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              const editor = editorRefLatest.current?.current;
              if (!editor || !currentNote) {
                toast.error(t("toast.editorNotAvailable"));
                return;
              }
              await downloadPdf(editor, currentNote.title);
              onCloseRef.current();
            } catch (error) {
              console.error("Failed to open print dialog:", error);
              toast.error(t("toast.printFailed"));
            }
          },
        },
        {
          id: "download-markdown",
          label: t("palette.exportMarkdown"),
          icon: <DownloadIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              if (!currentNote) {
                toast.error(t("app.noNoteSelected"));
                return;
              }
              let markdown = currentNote.content;
              const editorInstance = editorRefLatest.current?.current;
              if (editorInstance) {
                const manager = editorInstance.storage.markdown?.manager;
                if (manager) {
                  markdown = manager.serialize(editorInstance.getJSON());
                  markdown = markdown.replace(/&nbsp;|&#160;/g, " ");
                } else {
                  markdown = editorInstance.getText();
                }
              }
              const saved = await downloadMarkdown(markdown, currentNote.title);
              if (saved) {
                toast.success(t("toast.markdownSaved"));
                onCloseRef.current();
              }
            } catch (error) {
              console.error("Failed to download markdown:", error);
              toast.error(t("toast.markdownSaveFailed"));
            }
          },
        },
      );
    }

    // Pangu spacing (available when a note is selected)
    if (currentNote) {
      baseCommands.push({
        id: "pangu-spacing",
        label: t("palette.panguSpacing"),
        shortcut: `${mod} ${shift} Space`,
        icon: <TextSpacingIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          window.dispatchEvent(new CustomEvent("format-pangu-spacing"));
          onCloseRef.current();
        },
      });
    }

    // Source toggle
    baseCommands.push({
      id: "toggle-source",
      label: t("palette.toggleSource"),
      shortcut: `${mod} ${shift} M`,
      icon: <MarkdownIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
      action: () => {
        window.dispatchEvent(new CustomEvent("toggle-source-mode"));
        onCloseRef.current();
      },
    });

    // Settings and theme commands at the bottom
    baseCommands.push(
      {
        id: "settings",
        label: t("palette.settings"),
        shortcut: `${mod} ,`,
        icon: <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          onOpenSettingsRef.current?.();
          onCloseRef.current();
        },
      },
      {
        id: "theme-light",
        label: t("palette.themeLight"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setThemeRef.current("light");
          onCloseRef.current();
        },
      },
      {
        id: "theme-dark",
        label: t("palette.themeDark"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setThemeRef.current("dark");
          onCloseRef.current();
        },
      },
      {
        id: "theme-system",
        label: t("palette.themeSystem"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setThemeRef.current("system");
          onCloseRef.current();
        },
      },
    );

    return baseCommands;
  }, [currentNote, t]);

  // Debounced search using Tantivy (local state, doesn't affect sidebar)
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setLocalSearchResults([]);
      return;
    }

    // Debounce search calls
    const timer = setTimeout(async () => {
      try {
        const results = await invoke<
          {
            id: string;
            title: string;
            preview: string;
            modified: number;
            score: number;
          }[]
        >("search_notes", { folder, query: trimmed });
        setLocalSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Clear local search when palette closes
  useEffect(() => {
    if (!open) {
      setLocalSearchResults([]);
    }
  }, [open]);

  // Use search results when searching, otherwise show all notes
  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    return localSearchResults;
  }, [query, notes, localSearchResults]);

  // Memoize filtered commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const queryLower = query.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(queryLower),
    );
  }, [query, commands]);

  // Build flat item list for unified indexing
  const allItems = useMemo(
    () => [
      ...filteredCommands.map((cmd) => ({
        type: "command" as const,
        id: cmd.id,
        label: cmd.label,
        shortcut: cmd.shortcut,
        icon: cmd.icon,
        action: cmd.action,
      })),
      ...filteredNotes.slice(0, 10).map((note) => ({
        type: "note" as const,
        id: note.id,
        label: cleanTitle(note.title),
        preview: note.preview,
        action: () => {
          selectNote(note.id);
          onCloseRef.current();
        },
      })),
    ],
    [filteredNotes, filteredCommands, selectNote],
  );

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      selectionSourceRef.current = "keyboard";
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
    selectionSourceRef.current = "keyboard";
  }, [query]);

  // Scroll selected item into view — only for keyboard navigation
  useEffect(() => {
    if (selectionSourceRef.current !== "keyboard") return;
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selectedItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleDeleteConfirm = useCallback(async () => {
    if (noteToDelete) {
      try {
        await deleteNote(noteToDelete);
        setNoteToDelete(null);
        setDeleteDialogOpen(false);
        onCloseRef.current();
      } catch (error) {
        console.error("Failed to delete note:", error);
        toast.error(t("toast.deleteFailed"));
      }
    }
  }, [noteToDelete, deleteNote, t]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          selectionSourceRef.current = "keyboard";
          setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          selectionSourceRef.current = "keyboard";
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (allItems[selectedIndex]) {
            allItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
          break;
      }
    },
    [allItems, selectedIndex],
  );

  // Mouse enter handler — update selection without triggering scroll
  const handleMouseSelect = useCallback((index: number) => {
    selectionSourceRef.current = "mouse";
    setSelectedIndex(index);
  }, []);

  if (!open) return null;

  const commandsCount = filteredCommands.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center py-11 px-4 pointer-events-none">
      {/* Palette */}
      <div className="relative w-full h-full max-h-108 max-w-2xl bg-bg rounded-2xl shadow-2xl overflow-hidden border border-border animate-slide-down flex flex-col pointer-events-auto">
        {/* Search input */}
        <div className="border-b border-border flex-none">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("palette.searchPlaceholder")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full px-4.5 py-3.5 text-[17px] bg-transparent outline-none text-text placeholder-text-muted/50"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto h-full p-2.5 flex-1">
          {allItems.length === 0 ? (
            <div className="text-sm font-medium opacity-50 text-text-muted p-2">
              {t("palette.noResults")}
            </div>
          ) : (
            <>
              {/* Commands section */}
              {filteredCommands.length > 0 && (
                <div className="space-y-0.5 mb-5">
                  <div className="text-sm font-medium text-text-muted px-2.5 py-1.5">
                    {t("palette.commands")}
                  </div>
                  {filteredCommands.map((cmd, i) => (
                    <div key={cmd.id} data-index={i}>
                      <CommandItem
                        label={cmd.label}
                        shortcut={cmd.shortcut}
                        icon={cmd.icon}
                        isSelected={selectedIndex === i}
                        onMouseEnter={() => handleMouseSelect(i)}
                        onClick={cmd.action}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Notes section */}
              {filteredNotes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-text-muted px-2.5 py-1.5">
                    {t("palette.notes")}
                  </div>
                  {filteredNotes.slice(0, 10).map((note, i) => {
                    const title = cleanTitle(note.title);
                    const firstLetter = title.charAt(0).toUpperCase();
                    const cleanSubtitle = note.preview
                      ?.replace(/&nbsp;/g, " ")
                      .replace(/\u00A0/g, " ")
                      .trim();
                    const index = commandsCount + i;
                    return (
                      <div key={note.id} data-index={index}>
                        <CommandItem
                          label={title}
                          subtitle={cleanSubtitle}
                          iconText={firstLetter}
                          variant="note"
                          isSelected={selectedIndex === index}
                          onMouseEnter={() => handleMouseSelect(index)}
                          onClick={allItems[index]?.action}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("palette.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("palette.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("palette.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("palette.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
