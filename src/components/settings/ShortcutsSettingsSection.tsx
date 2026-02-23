import { mod } from "../../lib/platform";
import { useT } from "../../i18n";
import type { TranslateFn } from "../../i18n";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

function getShortcuts(t: TranslateFn): Shortcut[] {
  return [
    { keys: [mod, "P"], description: t("shortcuts.openPalette"), category: "navigation" },
    { keys: [mod, "O"], description: t("shortcuts.openFolder"), category: "navigation" },
    { keys: [mod, "N"], description: t("shortcuts.createNote"), category: "notes" },
    { keys: [mod, "R"], description: t("shortcuts.reloadNote"), category: "notes" },
    { keys: [mod, ","], description: t("shortcuts.openSettings"), category: "navigation" },
    { keys: [mod, "\\"], description: t("shortcuts.toggleSidebar"), category: "navigation" },
    { keys: [mod, "K"], description: t("shortcuts.addEditLink"), category: "editor" },
    { keys: [mod, "Shift", "C"], description: t("shortcuts.copyExport"), category: "editor" },
    { keys: [mod, "F"], description: t("shortcuts.findInNote"), category: "editor" },
    { keys: [mod, "Shift", "M"], description: t("shortcuts.toggleSource"), category: "editor" },
    { keys: [mod, "Shift", "Enter"], description: t("shortcuts.toggleFocus"), category: "editor" },
    { keys: ["/"], description: t("shortcuts.slashCommands"), category: "editor" },
    { keys: [mod, "Shift", "Space"], description: t("shortcuts.panguSpacing"), category: "editor" },
    { keys: [mod, "="], description: t("shortcuts.zoomIn"), category: "editor" },
    { keys: [mod, "\u2212"], description: t("shortcuts.zoomOut"), category: "editor" },
    { keys: [mod, "0"], description: t("shortcuts.zoomReset"), category: "editor" },
    { keys: [mod, "Shift", "F"], description: t("shortcuts.searchNotes"), category: "navigation" },
    { keys: [mod, "1"], description: t("shortcuts.goAppearance"), category: "settings" },
    { keys: [mod, "2"], description: t("shortcuts.goShortcuts"), category: "settings" },
    { keys: [mod, "3"], description: t("shortcuts.goAbout"), category: "settings" },
  ];
}

// Render individual key as keyboard button
function KeyboardKey({ keyLabel }: { keyLabel: string }) {
  return (
    <kbd className="text-xs px-1.5 py-0.5 rounded-md bg-bg-muted text-text min-w-6.5 inline-flex items-center justify-center">
      {keyLabel}
    </kbd>
  );
}

// Render shortcut keys
function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {keys.map((key, index) => (
        <KeyboardKey key={index} keyLabel={key} />
      ))}
    </div>
  );
}

export function ShortcutsSettingsSection() {
  const t = useT();
  const shortcuts = getShortcuts(t);

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || "navigation";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>,
  );

  const categoryLabels: Record<string, string> = {
    navigation: t("shortcuts.navigation"),
    notes: t("shortcuts.notes"),
    editor: t("shortcuts.editor"),
    settings: t("shortcuts.settingsCategory"),
  };
  const categoryOrder = ["navigation", "notes", "editor", "settings"];

  return (
    <div className="space-y-8 pb-8">
      {categoryOrder.map((category, idx) => {
        const categoryShortcuts = groupedShortcuts[category];
        if (!categoryShortcuts) return null;

        return (
          <div key={category}>
            {idx > 0 && (
              <div className="border-t border-border border-dashed" />
            )}
            <section>
              <h2 className="text-xl font-medium pt-8 mb-4">{categoryLabels[category]}</h2>
              <div className="space-y-3">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-text font-medium">
                      {shortcut.description}
                    </span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
