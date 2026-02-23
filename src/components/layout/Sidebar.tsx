import { useCallback, useEffect, useRef, useState } from "react";
import { useNotes } from "../../context/NotesContext";
import { NoteList } from "../notes/NoteList";
import { Footer } from "./Footer";
import { IconButton, Input } from "../ui";
import {
  PlusIcon,
  XIcon,
  SearchIcon,
  SearchOffIcon,
  PanelLeftIcon,
  BroomIcon,
  SettingsIcon,
  FolderIcon,
} from "../icons";
import { invoke } from "@tauri-apps/api/core";
import { mod, shift, isMac } from "../../lib/platform";
import { useT } from "../../i18n";
import { useNotesActions } from "../../context/NotesContext";

interface SidebarProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onOpenSettings, collapsed, onToggleCollapse }: SidebarProps) {
  const t = useT();
  const { createNote, notes, search, searchQuery, clearSearch, folder } = useNotes();
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const debounceRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync input with search query
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Debounce search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        search(value);
      }, 220);
    },
    [search]
  );

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setInputValue("");
    clearSearch();
  }, [clearSearch]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchOpen]);

  // Global shortcut hook: open and focus sidebar search
  useEffect(() => {
    const handleOpenSidebarSearch = () => {
      setSearchOpen(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    };

    window.addEventListener("open-sidebar-search", handleOpenSidebarSearch);
    return () =>
      window.removeEventListener("open-sidebar-search", handleOpenSidebarSearch);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (inputValue) {
          // First escape: clear search
          setInputValue("");
          clearSearch();
        } else {
          // Second escape: close search
          closeSearch();
        }
      }
    },
    [inputValue, clearSearch, closeSearch]
  );

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    clearSearch();
  }, [clearSearch]);

  const { clearList } = useNotesActions();

  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await invoke<string | null>("open_folder_dialog", { defaultPath: folder || null });
      if (selected) {
        window.dispatchEvent(new CustomEvent("switch-folder", { detail: selected }));
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  }, [folder]);

  // Global shortcut: Cmd+O open folder dialog
  useEffect(() => {
    const handler = () => handleOpenFolder();
    window.addEventListener("open-folder-dialog", handler);
    return () => window.removeEventListener("open-folder-dialog", handler);
  }, [handleOpenFolder]);

  // Collapsed mode: only show icon buttons
  if (collapsed) {
    return (
      <div className="w-[80px] h-full bg-bg-sidebar flex flex-col select-none sidebar-panel">
        {/* Drag region */}
        <div className="h-11 shrink-0" data-tauri-drag-region></div>
        {/* Top icons */}
        <div className="flex flex-col items-center gap-1.5 pt-2 px-3">
          <IconButton
            onClick={onToggleCollapse}
            size="md"
            title={t("editor.showSidebar", { shortcut: `${mod}${isMac ? "" : "+"}\\` })}
          >
            <PanelLeftIcon className="w-5 h-5 stroke-[1.5]" />
          </IconButton>
          <IconButton
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse();
              requestAnimationFrame(() => {
                window.dispatchEvent(new CustomEvent("open-sidebar-search"));
              });
            }}
            size="md"
            title={t("sidebar.searchNotes", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}F` })}
          >
            <SearchIcon className="w-[18px] h-[18px] stroke-[1.5]" />
          </IconButton>
          <IconButton
            onClick={handleOpenFolder}
            size="md"
            title={t("sidebar.openFolder", { shortcut: `${mod}${isMac ? "" : "+"}O` })}
          >
            <FolderIcon className="w-[18px] h-[18px] stroke-[1.5]" />
          </IconButton>
          <IconButton
            onClick={createNote}
            size="md"
            title={t("sidebar.newNote", { shortcut: `${mod}${isMac ? "" : "+"}N` })}
          >
            <PlusIcon className="w-5.5 h-5.5 stroke-[1.4]" />
          </IconButton>
        </div>
        {/* Spacer */}
        <div className="flex-1" />
        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-1.5 pb-3 px-3">
          <IconButton onClick={clearList} size="md" title={t("footer.clearList")}>
            <BroomIcon className="w-5 h-5 stroke-[1.5]" />
          </IconButton>
          <IconButton onClick={onOpenSettings} size="md" title={t("footer.settings", { shortcut: `${mod}${isMac ? "" : "+"},` })}>
            <SettingsIcon className="w-5 h-5 stroke-[1.5]" />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-bg-sidebar border-r border-border flex flex-col select-none sidebar-panel">
      {/* Drag region */}
      <div className="h-11 shrink-0" data-tauri-drag-region></div>
      <div className="flex items-center justify-between pl-4 pr-2.5 pb-2 border-b border-border shrink-0">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="font-medium text-base">{t("sidebar.notes")}</div>
            <div className="text-text-muted font-medium text-2xs min-w-4.75 h-4.75 flex items-center justify-center px-1 bg-bg-muted rounded-sm mt-0.5 pt-px">
              {notes.length}
            </div>
          </div>
          <div className="text-[11px] text-text-muted/60 truncate leading-tight" title={folder}>
            {folder.replace(/^\/Users\/[^/]+/, "~")}
          </div>
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <IconButton
            onClick={toggleSearch}
            title={t("sidebar.searchNotes", { shortcut: `${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}F` })}
          >
            {searchOpen ? (
              <SearchOffIcon className="w-4.25 h-4.25 stroke-[1.5]" />
            ) : (
              <SearchIcon className="w-4.25 h-4.25 stroke-[1.5]" />
            )}
          </IconButton>
          <IconButton
            onClick={handleOpenFolder}
            title={t("sidebar.openFolder", { shortcut: `${mod}${isMac ? "" : "+"}O` })}
          >
            <FolderIcon className="w-4.25 h-4.25 stroke-[1.5]" />
          </IconButton>
          <IconButton
            onClick={createNote}
            title={t("sidebar.newNote", { shortcut: `${mod}${isMac ? "" : "+"}N` })}
          >
            <PlusIcon className="w-5.25 h-5.25 stroke-[1.4]" />
          </IconButton>
        </div>
      </div>
      {/* Scrollable area with search and notes */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Search - sticky at top */}
        {searchOpen && (
          <div className="sticky top-0 z-10 px-2 pt-2 bg-bg-sidebar">
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                value={inputValue}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("sidebar.searchPlaceholder")}
                className="h-9 pr-8 text-sm"
              />
              {inputValue && (
                <button
                  onClick={handleClearSearch}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <XIcon className="w-4.5 h-4.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Note list */}
        <NoteList />
      </div>

      {/* Footer with git status, commit, and settings */}
      <Footer onOpenSettings={onOpenSettings} />
    </div>
  );
}
