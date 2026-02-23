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

- **WYSIWYG + Source mode** — Rich editor powered by TipTap, with a CodeMirror 6 source view (`Cmd+Shift+M`)
- **Local-first** — Notes are plain `.md` files in a folder you choose. No cloud, no lock-in
- **Full-text search** — Powered by Tantivy (Rust), with instant prefix matching
- **Focus mode** — Distraction-free writing (`Cmd+Shift+Enter`)
- **Command palette** — Quick access to notes and actions (`Cmd+P`)
- **Slash commands** — Type `/` to insert headings, lists, code blocks, tables, and more
- **Dark / Light / System theme** — Automatic theme switching with customizable typography
- **Git integration** — Optional commit & push from the sidebar
- **AI editing** — Claude Code CLI integration for AI-assisted writing
- **Auto-updater** — In-app update notifications
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

MIT
