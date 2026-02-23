import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { NotesProvider, useNotes } from "./context/NotesContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { I18nProvider, useT } from "./i18n";
import { TooltipProvider, Toaster } from "./components/ui";
import { Sidebar } from "./components/layout/Sidebar";
import { Editor } from "./components/editor/Editor";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WelcomePage } from "./components/layout/WelcomePage";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { SettingsPage } from "./components/settings";
import { SpinnerIcon } from "./components/icons";
import {
  check as checkForUpdate,
  type Update,
} from "@tauri-apps/plugin-updater";
import { listen } from "@tauri-apps/api/event";
import { getLastFolder } from "./services/notes";

type ViewState = "notes" | "settings";

function AppContent() {
  const t = useT();
  const {
    isLoading,
    createNote,
    notes,
    selectedNoteId,
    selectNote,
    searchQuery,
    searchResults,
    reloadCurrentNote,
  } = useNotes();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view, setView] = useState<ViewState>("notes");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizingRef = useRef(false);
  const [focusMode, setFocusMode] = useState(false);
  const editorRef = useRef<TiptapEditor | null>(null);
  const { zoomFontSize, editorFontSettings } = useTheme();

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(startWidth + e.clientX - startX, 180), 400);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      // Don't enter focus mode without a selected note
      if (!prev && !selectedNoteId) return prev;
      if (prev) {
        // Exiting focus mode — always restore sidebar
        setSidebarCollapsed(false);
      }
      return !prev;
    });
  }, [selectedNoteId]);

  const toggleSettings = useCallback(() => {
    setView((prev) => (prev === "settings" ? "notes" : "settings"));
  }, []);

  const closeSettings = useCallback(() => {
    setView("notes");
  }, []);

  // Memoize display items to prevent unnecessary recalculations
  const displayItems = useMemo(() => {
    return searchQuery.trim() ? searchResults : notes;
  }, [searchQuery, searchResults, notes]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInEditor = target.closest(".ProseMirror");
      const isInInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Cmd+, - Toggle settings (always works, even in settings)
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        toggleSettings();
        return;
      }

      // Cmd+= / Cmd+- / Cmd+0 — font size zoom (works everywhere including settings)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomFontSize(1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "-") {
        e.preventDefault();
        zoomFontSize(-1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "0") {
        e.preventDefault();
        zoomFontSize(17 - editorFontSettings.baseFontSize); // reset to default 17
        return;
      }

      // Cmd+P - Open command palette (works in all views)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Block all other shortcuts when in settings view
      if (view === "settings") {
        return;
      }

      // Cmd+Shift+Space - Add CJK-Latin spacing (pangu)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === " ") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("format-pangu-spacing"));
        return;
      }

      // Cmd+Shift+Enter - Toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // Cmd+Shift+M - Toggle markdown source mode
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "m"
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-source-mode"));
        return;
      }

      // Escape exits focus mode when not in editor
      if (e.key === "Escape" && focusMode && !isInEditor) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // Trap Tab/Shift+Tab in notes view only - prevent focus navigation
      // TipTap handles indentation internally before event bubbles up
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }

      // Cmd/Ctrl+Shift+F - Open sidebar search
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        setSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent("open-sidebar-search"));
        return;
      }

      // Cmd+\ - Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+O - Open folder
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-folder-dialog"));
        return;
      }

      // Cmd+N - New note
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNote();
        return;
      }

      // Cmd+R - Reload current note (pull external changes)
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        reloadCurrentNote();
        return;
      }

      // Arrow keys for note navigation (when not in editor or input)
      if (!isInEditor && !isInInput && displayItems.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const currentIndex = displayItems.findIndex(
            (n) => n.id === selectedNoteId,
          );
          let newIndex: number;

          if (e.key === "ArrowDown") {
            newIndex =
              currentIndex < displayItems.length - 1 ? currentIndex + 1 : 0;
          } else {
            newIndex =
              currentIndex > 0 ? currentIndex - 1 : displayItems.length - 1;
          }

          selectNote(displayItems[newIndex].id);
          return;
        }

        // Enter to focus editor
        if (e.key === "Enter" && selectedNoteId) {
          e.preventDefault();
          const editor = document.querySelector(".ProseMirror") as HTMLElement;
          if (editor) {
            editor.focus();
          }
          return;
        }
      }

      // Escape to blur editor and go back to note list
      if (e.key === "Escape" && isInEditor) {
        e.preventDefault();
        (target as HTMLElement).blur();
        // Focus the note list for keyboard navigation
        window.dispatchEvent(new CustomEvent("focus-note-list"));
        return;
      }
    };

    // Always disable the browser/WKWebView default context menu globally.
    // All areas that need context menus (editor, source mode, note list)
    // use custom Tauri native menus via Menu.popup().
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [
    createNote,
    displayItems,
    reloadCurrentNote,
    selectedNoteId,
    selectNote,
    toggleSettings,
    toggleSidebar,
    toggleFocusMode,
    focusMode,
    view,
    zoomFontSize,
    editorFontSettings.baseFontSize,
  ]);

  const handleClosePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-text-muted/70 text-sm flex items-center gap-1.5 font-medium">
          <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin" />
          {t("app.initializing")}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-screen flex bg-bg overflow-hidden">
        {view === "settings" ? (
          <SettingsPage onBack={closeSettings} />
        ) : (
          <>
            <div
              className={`transition-all duration-300 ease-out overflow-hidden shrink-0 ${focusMode ? "opacity-0 -translate-x-4 pointer-events-none" : "opacity-100 translate-x-0"}`}
              style={{ width: focusMode ? 0 : sidebarCollapsed ? 80 : sidebarWidth }}
            >
              <Sidebar onOpenSettings={toggleSettings} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
            </div>
            {/* Sidebar resize handle */}
            {!focusMode && !sidebarCollapsed && (
              <div
                className="w-1 shrink-0 cursor-col-resize hover:bg-white/10 active:bg-white/15 transition-colors"
                onMouseDown={handleResizeStart}
              />
            )}
            <Editor
              onToggleSidebar={toggleSidebar}
              onOpenSettings={toggleSettings}
              sidebarVisible={!sidebarCollapsed && !focusMode}
              focusMode={focusMode}
              onEditorReady={(editor) => {
                editorRef.current = editor;
              }}
            />
          </>
        )}
      </div>

      {/* Backdrop for command palette */}
      {paletteOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
          onClick={handleClosePalette}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={handleClosePalette}
        onOpenSettings={toggleSettings}
        editorRef={editorRef}
      />
    </>
  );
}

// Shared update check — used by startup and manual "Check for Updates"
async function showUpdateToast(): Promise<"update" | "no-update" | "error"> {
  try {
    const update = await checkForUpdate();
    if (update) {
      toast(<UpdateToast update={update} toastId="update-toast" />, {
        id: "update-toast",
        duration: Infinity,
        closeButton: true,
      });
      return "update";
    }
    return "no-update";
  } catch (err) {
    // Network errors and 404s (no release published yet) are not real failures
    const msg = String(err);
    if (
      msg.includes("404") ||
      msg.includes("network") ||
      msg.includes("Could not fetch")
    ) {
      return "no-update";
    }
    console.error("Update check failed:", err);
    return "error";
  }
}

export { showUpdateToast };

function UpdateToast({
  update,
  toastId,
}: {
  update: Update;
  toastId: string | number;
}) {
  const t = useT();
  const [installing, setInstalling] = useState(false);

  const handleUpdate = async () => {
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      toast.dismiss(toastId);
      toast.success(t("about.updateInstalled"), {
        duration: Infinity,
        closeButton: true,
      });
    } catch (err) {
      console.error("Update failed:", err);
      toast.error(t("about.updateFailed"));
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="font-medium text-sm">
        {t("about.updateAvailable", { version: update.version })}
      </div>
      {update.body && (
        <div className="text-xs text-text-muted line-clamp-3">
          {update.body}
        </div>
      )}
      <button
        onClick={handleUpdate}
        disabled={installing}
        className="self-start mt-1 text-xs font-medium px-3 py-1.5 rounded-md bg-text text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {installing ? t("about.installing") : t("about.updateNow")}
      </button>
    </div>
  );
}

// Bridge between ThemeContext (which loads settings) and I18nProvider
function I18nBridge({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useTheme();
  return (
    <I18nProvider initialLanguage={language} onLanguageChange={setLanguage}>
      {children}
    </I18nProvider>
  );
}

function App() {
  const [folder, setFolder] = useState<string | null | undefined>(undefined); // undefined = loading
  const [selectParam, setSelectParam] = useState<string | null>(null);

  // Add platform class for OS-specific styling (e.g., keyboard shortcuts)
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    document.documentElement.classList.add(
      isMac ? "platform-mac" : "platform-other",
    );
  }, []);

  // Resolve folder from URL params or last_folder
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("folder");
    const select = params.get("select");

    if (folderParam) {
      setFolder(decodeURIComponent(folderParam));
      setSelectParam(select ? decodeURIComponent(select) : null);
    } else {
      // No URL param — try to restore last folder
      getLastFolder().then((lastFolder) => {
        setFolder(lastFolder); // null if first launch
      });
    }
  }, []);

  // Listen for open-folder events from the backend (drag-drop, CLI, file association)
  useEffect(() => {
    const unlisten = listen<{ folder: string; select: string | null }>("open-folder", (event) => {
      setFolder(event.payload.folder);
      setSelectParam(event.payload.select);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen for switch-folder events from sidebar folder picker
  useEffect(() => {
    const handleSwitchFolder = (e: Event) => {
      const folder = (e as CustomEvent<string>).detail;
      if (folder) {
        setSelectParam(null);
        setFolder(folder);
      }
    };
    window.addEventListener("switch-folder", handleSwitchFolder);
    return () => window.removeEventListener("switch-folder", handleSwitchFolder);
  }, []);

  // Check for app updates on startup
  useEffect(() => {
    if (folder === undefined) return; // still loading
    const timer = setTimeout(() => showUpdateToast(), 3000);
    return () => clearTimeout(timer);
  }, [folder]);

  // Still resolving folder
  if (folder === undefined) {
    return null;
  }

  // No folder — first launch, show welcome page
  if (!folder) {
    return <WelcomePage />;
  }

  // Full app with sidebar, search, git, etc.
  return (
    <ThemeProvider folder={folder}>
      <I18nBridge>
        <Toaster />
        <TooltipProvider>
          <NotesProvider folder={folder} initialSelectId={selectParam}>
            <AppContent />
          </NotesProvider>
        </TooltipProvider>
      </I18nBridge>
    </ThemeProvider>
  );
}

export default App;
