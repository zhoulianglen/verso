import { useState, useEffect, useRef } from "react";
import {
  ArrowLeftIcon,
  SwatchIcon,
  KeyboardIcon,
  InfoIcon,
} from "../icons";
import { Button, IconButton } from "../ui";
import { AppearanceSettingsSection } from "./EditorSettingsSection";
import { ShortcutsSettingsSection } from "./ShortcutsSettingsSection";
import { AboutSettingsSection } from "./AboutSettingsSection";
import { mod, isMac } from "../../lib/platform";
import { useT } from "../../i18n";

interface SettingsPageProps {
  onBack: () => void;
}

type SettingsTab = "editor" | "shortcuts" | "about";

const tabs: {
  id: SettingsTab;
  labelKey: "settings.appearance" | "settings.shortcuts" | "settings.about";
  icon: typeof SwatchIcon;
  shortcut: string;
}[] = [
  { id: "editor", labelKey: "settings.appearance", icon: SwatchIcon, shortcut: "1" },
  { id: "shortcuts", labelKey: "settings.shortcuts", icon: KeyboardIcon, shortcut: "2" },
  { id: "about", labelKey: "settings.about", icon: InfoIcon, shortcut: "3" },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>("editor");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("editor");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("shortcuts");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveTab("about");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-full flex bg-bg w-full">
      {/* Sidebar - matches main Notes sidebar */}
      <div className="w-60 h-full bg-bg-sidebar border-r border-border flex flex-col select-none sidebar-panel">
        {/* Drag region */}
        <div className="h-11 shrink-0" data-tauri-drag-region></div>

        {/* Header with back button and Settings title */}
        <div className="flex items-center justify-between px-3 pb-2 border-b border-border shrink-0">
          <div className="flex items-center gap-1">
            <IconButton
              onClick={onBack}
              title={t("settings.back", { shortcut: `${mod}${isMac ? "" : "+"},` })}
            >
              <ArrowLeftIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </IconButton>
            <div className="font-medium text-base">{t("settings.title")}</div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex-1 p-2 flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="justify-between gap-2.5 h-10 pr-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4.5 h-4.5 stroke-[1.5]" />
                  {t(tab.labelKey)}
                </div>
                <div className="text-xs text-text-muted">
                  <span className="mr-0.5">{mod}</span>
                  {tab.shortcut}
                </div>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden">
        {/* Drag region */}
        <div className="h-11 shrink-0" data-tauri-drag-region></div>

        {/* Content - centered with max width */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto">
          <div className="w-full max-w-3xl mx-auto px-6 pb-6">
            {activeTab === "editor" && <AppearanceSettingsSection />}
            {activeTab === "shortcuts" && <ShortcutsSettingsSection />}
            {activeTab === "about" && <AboutSettingsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
