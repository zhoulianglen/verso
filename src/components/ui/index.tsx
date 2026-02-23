import * as React from "react";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Tooltip } from "./Tooltip";

// Re-export components
export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "./Tooltip";
export { Button } from "./Button";
export { Input } from "./Input";
export { Select } from "./Select";
export { Toaster } from "./Toaster";
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./AlertDialog";

// Toolbar button with active state and tooltip
interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  children: ReactNode;
}

export function ToolbarButton({
  isActive = false,
  className = "",
  children,
  title,
  ...props
}: ToolbarButtonProps) {
  const button = (
    <button
      className={cn(
        "h-7 w-7 flex items-center justify-center text-sm rounded transition-colors shrink-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        isActive
          ? "bg-bg-muted text-text"
          : "hover:bg-bg-muted text-text-muted",
        className
      )}
      tabIndex={-1}
      aria-label={title}
      {...props}
    >
      {children}
    </button>
  );

  if (title) {
    return <Tooltip content={title}>{button}</Tooltip>;
  }

  return button;
}

// Icon button (for sidebar actions, etc.)
export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "default" | "secondary" | "ghost" | "outline";
  title?: string;
}

const iconButtonSizes = {
  xs: "w-6 h-6", // 24px
  sm: "w-7 h-7", // 28px
  md: "w-8 h-8", // 32px
  lg: "w-9 h-9", // 36px
  xl: "w-10 h-10", // 40px
};

const iconButtonVariants = {
  primary: "bg-accent text-white hover:bg-accent/90",
  default: "bg-bg-emphasis text-text hover:bg-bg-muted",
  secondary: "bg-bg-muted text-text hover:bg-bg-emphasis",
  ghost: "hover:bg-bg-muted text-text-muted hover:text-text",
  outline:
    "border border-border text-text-muted hover:bg-bg-muted hover:text-text",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { className, children, title, size = "sm", variant = "ghost", ...props },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-md transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          iconButtonSizes[size],
          iconButtonVariants[variant],
          className
        )}
        tabIndex={-1}
        aria-label={title}
        {...props}
      >
        {children}
      </button>
    );

    if (title) {
      return <Tooltip content={title}>{button}</Tooltip>;
    }

    return button;
  }
);
IconButton.displayName = "IconButton";

// List item for sidebar
interface ListItemProps {
  title: string;
  subtitle?: string;
  meta?: string;
  placeholder?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ListItem({
  title,
  subtitle,
  meta,
  placeholder,
  isSelected = false,
  onClick,
  onContextMenu,
}: ListItemProps & { onContextMenu?: (e: React.MouseEvent) => void }) {
  // Clean subtitle: treat whitespace-only or &nbsp; as empty
  const cleanSubtitle = subtitle
    ?.replace(/&nbsp;/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
  const hasSubtitle = cleanSubtitle && cleanSubtitle.length > 0;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={-1}
      className={cn(
        "w-full text-left py-2.5 cursor-pointer select-none rounded-md transition-all duration-150 flex",
        "focus:outline-none focus-visible:outline-none",
        isSelected
          ? "bg-white/12 text-white"
          : "hover:bg-white/10"
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        "w-[3px] shrink-0 rounded-full self-stretch ml-1 mr-2 transition-colors duration-150",
        isSelected ? "bg-red-500" : "bg-transparent"
      )} />
      <div className="flex-1 min-w-0 pr-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(
          "text-[14px] font-semibold truncate",
          isSelected ? "text-white" : "text-text"
        )}>
          {title}
        </span>
        {meta && (
          <span className={cn(
            "text-[11px] whitespace-nowrap shrink-0",
            isSelected ? "text-white/60" : "text-text-muted"
          )}>
            {meta}
          </span>
        )}
      </div>
      <p className={cn(
        "text-[12px] leading-relaxed line-clamp-2 mt-1",
        hasSubtitle
          ? (isSelected ? "text-white/50" : "text-text-muted")
          : (isSelected ? "text-white/30" : "text-text-muted/50 italic")
      )}>
        {hasSubtitle ? cleanSubtitle : (placeholder || "Start writing...")}
      </p>
      </div>
    </div>
  );
}

// Command palette item
interface CommandItemProps {
  label: string;
  subtitle?: string;
  shortcut?: string;
  icon?: ReactNode;
  iconText?: string;
  variant?: "note" | "command";
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

export function CommandItem({
  label,
  subtitle,
  shortcut,
  icon,
  iconText,
  variant = "command",
  isSelected = false,
  onClick,
  onMouseEnter,
}: CommandItemProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="button"
      tabIndex={-1}
      className={cn(
        "w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer",
        isSelected ? "bg-bg-muted text-text" : "text-text"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {(icon || iconText) && (
          <div
            className={cn(
              "shrink-0 flex items-center justify-center text-text-muted",
              variant === "note" &&
                "w-9 h-9 rounded-md bg-bg-emphasis flex items-center justify-center"
            )}
          >
            {iconText ? (
              <span className="text-xl text-text-muted font-serif">
                {iconText}
              </span>
            ) : (
              icon
            )}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-medium truncate">{label}</span>
          {subtitle && (
            <span className="text-sm truncate text-text-muted">{subtitle}</span>
          )}
        </div>
      </div>
      {shortcut && (
        <kbd
          className={cn(
            "text-xs px-2 py-0.5 rounded-md ml-2",
            isSelected ? "bg-bg-muted text-text" : "bg-bg-muted text-text-muted"
          )}
        >
          {shortcut}
        </kbd>
      )}
    </div>
  );
}
