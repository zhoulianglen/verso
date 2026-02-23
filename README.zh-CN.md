<p align="center">
  <img src="docs/verso-icon.svg" width="128" height="128" alt="Verso">
</p>

<h1 align="center">Verso / 轻墨</h1>

<p align="center">
  极简 Markdown 编辑器，支持 macOS、Windows 和 Linux。
  <br>
  <a href="README.md">English</a>
</p>

<p align="center">
  <img src="docs/screenshot.zh-CN.png" width="720" alt="Verso 截图">
</p>

## 功能

- **所见即所得 + 源码模式** — 基于 TipTap 的富文本编辑，搭配 CodeMirror 6 源码视图（`Cmd+Shift+M`）
- **本地优先** — 文档以 `.md` 文件存储在你选择的文件夹中，无云端、无锁定
- **全文搜索** — 基于 Tantivy（Rust），支持即时前缀匹配
- **专注模式** — 无干扰写作（`Cmd+Shift+Enter`）
- **命令面板** — 快速访问文档和操作（`Cmd+P`）
- **斜杠命令** — 输入 `/` 插入标题、列表、代码块、表格等
- **深色 / 浅色 / 跟随系统** — 自动切换主题，可自定义排版样式
- **Git 集成** — 在侧边栏中提交和推送（可选）
- **AI 编辑** — 集成 Claude Code CLI 进行 AI 辅助写作
- **自动更新** — 应用内更新通知
- **多语言** — 支持英文和简体中文

## 截图

![截图](docs/screenshot.zh-CN.png)

## 安装

从 [Releases](https://github.com/zhoulianglen/verso/releases) 下载最新版本。

- **macOS** — `.dmg`（通用二进制：Apple Silicon + Intel）
- **Windows** — `.exe` 安装程序
- **Linux** — `.AppImage` 或 `.deb`

### 从源码构建

**前置条件：** Node.js 18+、Rust（stable）、[Tauri v2 环境依赖](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/zhoulianglen/verso.git
cd verso
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 生产构建
```

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Cmd+N` | 新建文档 |
| `Cmd+P` | 命令面板 |
| `Cmd+K` | 添加 / 编辑链接 |
| `Cmd+F` | 文档内查找 |
| `Cmd+Shift+C` | 复制与导出菜单 |
| `Cmd+Shift+M` | 切换源码模式 |
| `Cmd+Shift+Enter` | 切换专注模式 |
| `Cmd+Shift+F` | 搜索所有文档 |
| `Cmd+\` | 切换侧边栏 |
| `Cmd+,` | 设置 |

> Windows 和 Linux 上使用 `Ctrl` 代替 `Cmd`。

完整快捷键参考请查看 设置 → 快捷键。

## 技术栈

[Tauri v2](https://v2.tauri.app/) · [React](https://react.dev/) · [TipTap](https://tiptap.dev/) · [CodeMirror 6](https://codemirror.net/) · [Tailwind CSS](https://tailwindcss.com/) · [Tantivy](https://github.com/quickwit-oss/tantivy)

## 许可证

MIT
