<p align="center">
  <img src="docs/verso-icon.svg" width="128" height="128" alt="Verso">
</p>

<h1 align="center">Verso / 轻墨</h1>

<p align="center">
  A minimalist Markdown editor for macOS, Windows, and Linux.
  <br>
  <a href="README.zh-CN.md">中文文档</a>
</p>

<p align="center">
  <img src="docs/screenshot.png" width="720" alt="Verso screenshot">
</p>

## Features

- **WYSIWYG & Source mode** — Rich visual editor powered by TipTap, with CodeMirror 6 source view and syntax highlighting (`Cmd+Shift+M`)
- **Plain Markdown files** — Notes are standard `.md` files in a folder you choose. No proprietary formats, no lock-in
- **Full-text search** — Powered by Tantivy (Rust), with instant prefix matching
- **Tables & Rich content** — Insert tables, task lists, code blocks, images, and more via slash commands or the format bar
- **Export anywhere** — Copy as Markdown, plain text, or HTML; print to PDF
- **Live file watching** — External edits are picked up instantly; works alongside Git, Obsidian, or any other tool
- **CJK-Latin spacing** — Automatic spacing between Chinese/Japanese/Korean and Latin characters
- **Keyboard-first** — Command palette, slash commands, and comprehensive shortcuts
- **Light & Dark themes** — Follows system preference automatically with customizable typography
- **Git integration** — Optional commit & push from the sidebar
- **AI editing** — Claude Code CLI integration for AI-assisted writing
- **i18n** — English and Simplified Chinese

## Screenshot

![Screenshot](docs/screenshot.png)

## Installation

Download the latest release from [Releases](https://github.com/zhoulianglen/verso/releases).

- **macOS** — `.dmg` (Universal binary: Apple Silicon + Intel)
- **Windows** — `.exe` installer
- **Linux** — `.AppImage` or `.deb`

### From Source

**Prerequisites:** Node.js 18+, Rust (stable), and [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/zhoulianglen/verso.git
cd verso
npm install
npm run tauri dev      # Development
npm run tauri build    # Production build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New note |
| `Cmd+P` | Command palette |
| `Cmd+K` | Add / edit link |
| `Cmd+F` | Find in note |
| `Cmd+Shift+C` | Copy & Export menu |
| `Cmd+Shift+M` | Toggle source mode |
| `Cmd+Shift+Enter` | Toggle focus mode |
| `Cmd+Shift+F` | Search all notes |
| `Cmd+\` | Toggle sidebar |
| `Cmd+,` | Settings |

> On Windows and Linux, use `Ctrl` instead of `Cmd`.

Full shortcut reference available in Settings → Shortcuts.

## Built With

[Tauri v2](https://v2.tauri.app/) · [React](https://react.dev/) · [TipTap](https://tiptap.dev/) · [CodeMirror 6](https://codemirror.net/) · [Tailwind CSS](https://tailwindcss.com/) · [Tantivy](https://github.com/quickwit-oss/tantivy)

## License

GPL-3.0
