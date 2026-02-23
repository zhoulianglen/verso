import { useEffect, useRef } from "react";
import { Input, IconButton } from "../ui";
import { ArrowUpIcon, ArrowDownIcon, XIcon } from "../icons";
import { shift } from "../../lib/platform";
import { useT } from "../../i18n";

interface SearchToolbarProps {
  query: string;
  onChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  currentMatch: number;
  totalMatches: number;
}

export function SearchToolbar({
  query,
  onChange,
  onNext,
  onPrevious,
  onClose,
  currentMatch,
  totalMatches,
}: SearchToolbarProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Allow tab navigation within toolbar
      e.stopPropagation();
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg shadow-lg p-1">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search.findInNote")}
        className="w-55 h-8 text-sm"
        onKeyDown={handleKeyDown}
      />

      <span className="text-xs text-text-muted whitespace-nowrap px-1 min-w-17">
        {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : t("search.notFound")}
      </span>

      <div className="flex items-center gap-px ml-1">
        <IconButton
          onClick={onPrevious}
          disabled={totalMatches === 0}
          title={t("search.previousMatch", { shortcut: `${shift}↵` })}
        >
          <ArrowUpIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>

        <IconButton
          onClick={onNext}
          disabled={totalMatches === 0}
          title={t("search.nextMatch", { shortcut: "↵" })}
        >
          <ArrowDownIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>

        <IconButton onClick={onClose} title={t("search.close")}>
          <XIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>
      </div>
    </div>
  );
}
