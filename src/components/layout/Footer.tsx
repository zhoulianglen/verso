import { memo } from "react";
import { IconButton } from "../ui";
import { SettingsIcon, BroomIcon } from "../icons";
import { mod, isMac } from "../../lib/platform";
import { useT } from "../../i18n";
import { useNotesActions } from "../../context/NotesContext";

interface FooterProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
}

export const Footer = memo(function Footer({ onOpenSettings, collapsed }: FooterProps) {
  const t = useT();
  const { clearList } = useNotesActions();

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-border">
        <div className="flex flex-col items-center gap-1 py-2 px-1.5">
          <IconButton onClick={clearList} title={t("footer.clearList")}>
            <BroomIcon className="w-4.5 h-4.5 stroke-[1.5]" />
          </IconButton>
          <IconButton onClick={onOpenSettings} title={t("footer.settings", { shortcut: `${mod}${isMac ? "" : "+"},` })}>
            <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border">
      <div className="pl-4 pr-3 pt-2 pb-2.5 flex items-center justify-end gap-px">
        <IconButton onClick={clearList} title={t("footer.clearList")}>
          <BroomIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>
        <IconButton onClick={onOpenSettings} title={t("footer.settings", { shortcut: `${mod}${isMac ? "" : "+"},` })}>
          <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>
      </div>
    </div>
  );
});
