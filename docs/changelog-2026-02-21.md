# Verso v0.7.0 - 开发日志 (2026-02-21)

## UI 整体改版

### 侧边栏

- **深色侧边栏**：亮色模式下侧边栏背景改为 `#2E3235`，文字/图标自动适配浅色，与编辑区形成双色调布局
- **Bear 风格文档列表**：去除卡片边框和阴影，扁平化设计，标题+日期同行，预览文字在下方
- **选中样式**：`bg-white/12` 半透明背景 + 左侧 3px 红色竖条指示器
- **列表分隔线**：`divide-white/[0.06]` 细微分隔
- **文件夹路径显示**：标题下方灰色小字显示当前目录路径
- **可拖动宽度**：侧边栏右侧边缘可拖动调整宽度（180-400px）
- **可收缩侧边栏**：收缩至 80px，图标放大到 32px 点击区域，间距更宽松
- **Traffic lights 适配**：收缩宽度 80px 完整覆盖 macOS 三个圆点
- **空文档占位文字**：无内容时显示「开始书写...」/ "Start writing..."（i18n）
- **自定义滚动条**：6px 半透明白色细条，替代 macOS 默认滚动条

### 编辑器

- **Markdown 样式**（Bear 风格）：
  - 链接：红色 `#E25D5D`，无下划线，悬停出现下划线
  - 引用块：红色 3px 左边框 + 斜体
  - 列表标记：红色 `#E25D5D`
  - H1 标题：底部边框
  - 高亮标记：暖黄色背景
- **代码块样式**：去除彩色边框，改为 `bg-emphasis` + 宽松内边距
- **内联代码**：正常文字颜色 + `bg-emphasis` 背景
- **自定义滚动条**：6px 半透明细条，亮/暗模式自适应

### 设置页面

- **设置侧边栏**：与主侧边栏统一深色背景
- **外观预览高度**：放开至 `max-h-240`，可展示更多内容

## 代码高亮

- **CodeBlockLowlight 集成**：安装 `@tiptap/extension-code-block-lowlight` + `lowlight`
- **One Dark / One Light 主题**：完整的语法高亮 CSS（~130 行），亮暗模式自动切换
- **智能语言检测**：自定义 `detectLanguage()` 函数替代不可靠的 `highlightAuto`，基于正则模式匹配，支持 JS/TS/Python/Rust/Go/Java/Ruby/CSS/SQL/HTML/JSON/C 等 14 种语言
- **设置预览代码高亮**：外观设置中的代码预览也应用 lowlight 高亮渲染

## Titlebar 对齐优化

- **折叠 icon + 日期**与 format bar（B/I 等按钮）左对齐，统一使用 `px-3` 边距
- 侧边栏展开/收缩时，编辑器 titlebar 的折叠 icon 始终显示
- 收缩时不再重复显示折叠 icon（侧边栏已有）→ 后改为两处都保留，编辑器内的用于快速展开

## 多行预览

- **Rust 后端**：`generate_preview()` 改为收集多行内容（最多 200 字符），空内容文档不再显示空白
- **前端**：`line-clamp-3` 显示最多 3 行预览

## 技术细节

| 文件 | 主要改动 |
|------|----------|
| `src/App.css` | 主题变量、侧边栏 CSS 作用域、Bear 风格 Markdown、One Dark/Light 高亮、自定义滚动条 |
| `src/App.tsx` | 侧边栏宽度状态、拖动调整、收缩宽度 80px |
| `src/components/editor/Editor.tsx` | CodeBlockLowlight、智能语言检测、titlebar 对齐、编辑器滚动条 |
| `src/components/layout/Sidebar.tsx` | 深色背景、收缩模式 80px、图标放大、文件夹路径 |
| `src/components/ui/index.tsx` | Bear 风格 ListItem、左侧竖条、空文档占位文字 |
| `src/components/settings/EditorSettingsSection.tsx` | 预览高度、代码高亮渲染 |
| `src/components/settings/SettingsPage.tsx` | 设置侧边栏深色 |
| `src/components/notes/NoteList.tsx` | 分隔线、占位文字 prop |
| `src-tauri/src/lib.rs` | 多行预览收集（200 字符） |
| `src/i18n/en.ts` / `zh-CN.ts` | 新增 `sidebar.startWriting` 翻译 key |
