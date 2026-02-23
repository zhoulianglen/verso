# UI Redesign - Modern Structured Style

## Overview

Redesign Verso's UI to look like a distinctly different Markdown editor with modern structured aesthetics while keeping the existing black/white/gray color scheme.

## Design Decisions

### 1. Collapsible Sidebar

**Expanded** (240px): Full sidebar with title, search, note list, footer buttons.

**Collapsed** (48px): Narrow icon strip with vertical icons - notes, search, new, clear, settings. Tooltip on hover.

**Toggle**: `Cmd+\` shortcut (already exists) or collapse button.

### 2. Card-Style Note List

- Each note is a rounded card (border-radius: 8px)
- 6px gap between cards
- Hover: deeper background + subtle shadow transition
- Selected: left indicator bar + distinct background
- Content: title + relative time

### 3. Dual Toolbar

**Fixed top bar**: Always visible above editor. Contains all format buttons (B/I/S/H1-H4/lists/quote/code/link/image/table) + right-side action buttons (source mode/focus mode/copy-export).

**Floating toolbar**: Appears above text selection with compact format options (B/I/S/link/highlight/code). Rounded corners, shadow, fade-in animation.

### 4. Color Scheme

No changes. Keep existing CSS variables and black/white/gray palette.

### 5. Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Collapsed sidebar state, width logic |
| `src/App.css` | Card styles, floating toolbar, collapsed sidebar |
| `src/components/layout/Sidebar.tsx` | Collapsed mode rendering |
| `src/components/layout/Footer.tsx` | Collapsed mode icons |
| `src/components/editor/Editor.tsx` | Floating toolbar (BubbleMenu) |
| `src/components/ui/index.tsx` | Card-style ListItem |
| `src/components/notes/NoteList.tsx` | Card gap/spacing |
| `src/i18n/en.ts` | New tooltip keys |
| `src/i18n/zh-CN.ts` | New tooltip keys |
