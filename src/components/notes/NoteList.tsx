import { useCallback, useMemo, memo, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { useNotes } from "../../context/NotesContext";
import { useT } from "../../i18n";
import type { TranslateFn } from "../../i18n";
import { mod, isMac } from "../../lib/platform";
import {
  ListItem,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui";
import { cleanTitle } from "../../lib/utils";


function formatDate(timestamp: number, t: TranslateFn): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();

  // Get start of today, yesterday, etc. (midnight local time)
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  // Today: show time
  if (date >= startOfToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // Yesterday
  if (date >= startOfYesterday) {
    return t("noteList.yesterday");
  }

  // Calculate days ago
  const daysAgo =
    Math.floor((startOfToday.getTime() - date.getTime()) / 86400000) + 1;

  // 2-6 days ago: show "X days ago"
  if (daysAgo <= 6) {
    return t("noteList.daysAgo", { count: daysAgo });
  }

  // This year: show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Different year: show full date
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Memoized note item component
interface NoteItemProps {
  id: string;
  title: string;
  preview?: string;
  modified: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  t: TranslateFn;
}

const NoteItem = memo(function NoteItem({
  id,
  title,
  preview,
  modified,
  isSelected,
  onSelect,
  onContextMenu,
  t,
}: NoteItemProps) {
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => onContextMenu(e, id),
    [onContextMenu, id]
  );

  const folder = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : null;
  const displayPreview = folder
    ? preview ? `${folder}/ · ${preview}` : `${folder}/`
    : preview;

  return (
    <ListItem
      title={cleanTitle(title)}
      subtitle={displayPreview}
      meta={formatDate(modified, t)}
      placeholder={t("sidebar.startWriting")}
      isSelected={isSelected}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

export function NoteList() {
  const {
    notes,
    selectedNoteId,
    selectNote,
    deleteNote,
    duplicateNote,
    isLoading,
    searchQuery,
    searchResults,
    folder,
  } = useNotes();
  const t = useT();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDeleteConfirm = useCallback(async () => {
    if (noteToDelete) {
      try {
        await deleteNote(noteToDelete);
        setNoteToDelete(null);
        setDeleteDialogOpen(false);
      } catch (error) {
        console.error("Failed to delete note:", error);
      }
    }
  }, [noteToDelete, deleteNote]);

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      const menu = await Menu.new({
        items: [
          await MenuItem.new({
            text: t("noteList.duplicate"),
            action: () => duplicateNote(noteId),
          }),
          await MenuItem.new({
            text: t("noteList.copyFilepath"),
            action: async () => {
              try {
                const filepath = `${folder}/${noteId}.md`;
                await invoke("copy_to_clipboard", { text: filepath });
              } catch (error) {
                console.error("Failed to copy filepath:", error);
              }
            },
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            text: t("noteList.delete"),
            action: () => {
              setNoteToDelete(noteId);
              setDeleteDialogOpen(true);
            },
          }),
        ],
      });

      await menu.popup();
    },
    [folder, duplicateNote, t]
  );

  // Memoize display items to prevent recalculation on every render
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults.map((r) => ({
        id: r.id,
        title: r.title,
        preview: r.preview,
        modified: r.modified,
      }));
    }
    return notes;
  }, [searchQuery, searchResults, notes]);

  // Listen for focus request from editor (when Escape is pressed)
  useEffect(() => {
    const handleFocusNoteList = () => {
      containerRef.current?.focus();
    };

    window.addEventListener("focus-note-list", handleFocusNoteList);
    return () =>
      window.removeEventListener("focus-note-list", handleFocusNoteList);
  }, []);

  if (isLoading && notes.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted select-none">
        {t("noteList.loading")}
      </div>
    );
  }

  if (searchQuery.trim() && displayItems.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-text-muted select-none">
        {t("noteList.noResults")}
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 select-none">
        <div className="w-10 h-10 rounded-full bg-bg-muted flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2h6l1 7h-8z" opacity="0.3"/>
            <path d="M4 7h16l-1.5 13a2 2 0 0 1-2 1.75h-9a2 2 0 0 1-2-1.75z"/>
            <path d="M9 12h6"/>
          </svg>
        </div>
        <div className="text-sm text-text-muted/70 mb-1">{t("noteList.noNotes")}</div>
        <div className="text-xs text-text-muted/40">{t("noteList.emptyHint", { shortcut: `${mod}${isMac ? "" : "+"}N` })}</div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        className="flex flex-col divide-y divide-white/[0.06] px-2 py-1.5 outline-none"
      >
        {displayItems.map((item) => (
          <NoteItem
            key={item.id}
            id={item.id}
            title={item.title}
            preview={item.preview}
            modified={item.modified}
            isSelected={selectedNoteId === item.id}
            onSelect={selectNote}
            onContextMenu={handleContextMenu}
            t={t}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("noteList.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("noteList.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("noteList.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("noteList.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
