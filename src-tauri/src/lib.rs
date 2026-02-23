use anyhow::Result;
use base64::Engine;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::fs;


// Note metadata for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub modified: i64,
}

// Full note content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub path: String,
    pub modified: i64,
}

// Theme color customization
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub bg: Option<String>,
    pub bg_secondary: Option<String>,
    pub bg_muted: Option<String>,
    pub bg_emphasis: Option<String>,
    pub text: Option<String>,
    pub text_muted: Option<String>,
    pub text_inverse: Option<String>,
    pub border: Option<String>,
    pub accent: Option<String>,
}

// Theme settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub mode: String, // "light" | "dark" | "system"
    pub custom_light_colors: Option<ThemeColors>,
    pub custom_dark_colors: Option<ThemeColors>,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            mode: "system".to_string(),
            custom_light_colors: None,
            custom_dark_colors: None,
        }
    }
}

// Editor font settings (simplified)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EditorFontSettings {
    pub base_font_family: Option<String>, // "system-sans" | "serif" | "monospace"
    pub base_font_size: Option<f32>,      // in px, default 16
    pub bold_weight: Option<i32>,         // 600, 700, 800 for headings and bold
    pub line_height: Option<f32>,         // default 1.6
}

// App config (stored in app data directory)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(alias = "notes_folder")]
    pub last_folder: Option<String>,
}

// App settings (stored in app data directory)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub theme: ThemeSettings,
    #[serde(rename = "editorFont")]
    pub editor_font: Option<EditorFontSettings>,
    #[serde(rename = "textDirection")]
    pub text_direction: Option<String>,
    #[serde(rename = "editorWidth")]
    pub editor_width: Option<String>,
    pub language: Option<String>,
}

// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub modified: i64,
    pub score: f32,
}

// AI execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExecutionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

// File watcher state
pub struct FileWatcherState {
    #[allow(dead_code)]
    watcher: RecommendedWatcher,
}

// Tantivy search index state
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    #[allow(dead_code)]
    schema: Schema,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    modified_field: Field,
}

impl SearchIndex {
    fn new(index_path: &PathBuf) -> Result<Self> {
        // Build schema
        let mut schema_builder = Schema::builder();
        let id_field = schema_builder.add_text_field("id", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT | STORED);
        let modified_field = schema_builder.add_i64_field("modified", INDEXED | STORED);
        let schema = schema_builder.build();

        // Create or open index
        std::fs::create_dir_all(index_path)?;
        let index = Index::create_in_dir(index_path, schema.clone())
            .or_else(|_| Index::open_in_dir(index_path))?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let writer = index.writer(50_000_000)?; // 50MB buffer

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            schema,
            id_field,
            title_field,
            content_field,
            modified_field,
        })
    }

    fn index_note(&self, id: &str, title: &str, content: &str, modified: i64) -> Result<()> {
        let mut writer = self.writer.lock().expect("search writer mutex");

        // Delete existing document with this ID
        let id_term = tantivy::Term::from_field_text(self.id_field, id);
        writer.delete_term(id_term);

        // Add new document
        writer.add_document(doc!(
            self.id_field => id,
            self.title_field => title,
            self.content_field => content,
            self.modified_field => modified,
        ))?;

        writer.commit()?;
        Ok(())
    }

    fn delete_note(&self, id: &str) -> Result<()> {
        let mut writer = self.writer.lock().expect("search writer mutex");
        let id_term = tantivy::Term::from_field_text(self.id_field, id);
        writer.delete_term(id_term);
        writer.commit()?;
        Ok(())
    }

    fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let searcher = self.reader.searcher();
        let query_parser =
            QueryParser::for_index(&self.index, vec![self.title_field, self.content_field]);

        // Parse query, fall back to prefix query if parsing fails
        let query = query_parser
            .parse_query(query_str)
            .or_else(|_| query_parser.parse_query(&format!("{}*", query_str)))?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        let mut results = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address)?;

            let id = doc
                .get_first(self.id_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = doc
                .get_first(self.title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let content = doc
                .get_first(self.content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let modified = doc
                .get_first(self.modified_field)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            let preview = generate_preview(content);

            results.push(SearchResult {
                id,
                title,
                preview,
                modified,
                score,
            });
        }

        Ok(results)
    }

    fn rebuild_index(&self, notes_folder: &PathBuf) -> Result<()> {
        let mut writer = self.writer.lock().expect("search writer mutex");
        writer.delete_all_documents()?;

        if notes_folder.exists() {
            use walkdir::WalkDir;
            for entry in WalkDir::new(notes_folder)
                .max_depth(1)
                .into_iter()
                .filter_entry(is_visible_notes_entry)
                .flatten()
            {
                let file_path = entry.path();
                if !file_path.is_file() {
                    continue;
                }
                if let Some(id) = id_from_abs_path(notes_folder, file_path) {
                    if let Ok(content) = std::fs::read_to_string(file_path) {
                        let modified = entry
                            .metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);

                        let title = extract_title(&content);

                        writer.add_document(doc!(
                            self.id_field => id.as_str(),
                            self.title_field => title,
                            self.content_field => content.as_str(),
                            self.modified_field => modified,
                        ))?;
                    }
                }
            }
        }

        writer.commit()?;
        Ok(())
    }
}

// Per-folder state (each open directory has its own isolated state)
pub struct FolderState {
    pub folder: String,
    pub notes_cache: RwLock<HashMap<String, NoteMetadata>>,
    pub file_watcher: Mutex<Option<FileWatcherState>>,
    pub search_index: Mutex<Option<SearchIndex>>,
    pub debounce_map: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

// App state: global config + per-folder states
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub app_config: RwLock<AppConfig>,
    pub settings: RwLock<Settings>,
    pub folder_states: RwLock<HashMap<String, Arc<FolderState>>>,
}

// Helper: get the Arc<FolderState> for a given folder path
fn get_folder_state(state: &AppState, folder: &str) -> Result<Arc<FolderState>, String> {
    let states = state.folder_states.read().expect("folder_states read lock");
    states
        .get(folder)
        .cloned()
        .ok_or_else(|| format!("Folder not initialized: {}", folder))
}

// Utility: Sanitize filename from title
fn sanitize_filename(title: &str) -> String {
    let sanitized: String = title
        .chars()
        .filter(|c| *c != '\u{00A0}' && *c != '\u{FEFF}')
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();

    let trimmed = sanitized.trim();
    if trimmed.is_empty() || is_effectively_empty(trimmed) {
        "Untitled".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Expands template tags in a note name template using local timezone
/// Extracts a display title from a note ID (filename)
fn extract_title_from_id(id: &str) -> String {
    // Get last path component (filename)
    let filename = id.rsplit('/').next().unwrap_or(id);

    // Convert to display title (replace dashes/underscores with spaces)
    let title = filename.replace(['-', '_'], " ");

    // Title case
    title
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// Utility: Check if a string is effectively empty
fn is_effectively_empty(s: &str) -> bool {
    s.chars()
        .all(|c| c.is_whitespace() || c == '\u{00A0}' || c == '\u{FEFF}')
}

/// Strip YAML frontmatter (leading `---` ... `---` block) from content.
fn strip_frontmatter(content: &str) -> &str {
    let trimmed = content.trim_start();
    if trimmed.starts_with("---") {
        // Find the closing --- (skip the opening line)
        if let Some(rest) = trimmed.strip_prefix("---") {
            if let Some(end) = rest.find("\n---") {
                // Skip past closing --- and the newline after it (handle CRLF)
                let after_close = &rest[end + 4..];
                return after_close
                    .strip_prefix("\r\n")
                    .or_else(|| after_close.strip_prefix('\n'))
                    .unwrap_or(after_close);
            }
        }
    }
    content
}

// Utility: Extract title from markdown content
fn extract_title(content: &str) -> String {
    let body = strip_frontmatter(content);
    for line in body.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("# ") {
            let title = title.trim();
            if !is_effectively_empty(title) {
                return title.to_string();
            }
        }
        if !is_effectively_empty(trimmed) {
            return trimmed.chars().take(50).collect();
        }
    }
    "Untitled".to_string()
}

// Utility: Generate preview from content (strip markdown formatting)
fn generate_preview(content: &str) -> String {
    let body = strip_frontmatter(content);
    let mut preview = String::new();
    // Skip the first line (title), collect multiple lines for richer preview
    for line in body.lines().skip(1) {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let stripped = strip_markdown(trimmed);
            if !stripped.is_empty() {
                if !preview.is_empty() {
                    preview.push(' ');
                }
                preview.push_str(&stripped);
                if preview.len() >= 200 {
                    break;
                }
            }
        }
    }
    preview.chars().take(200).collect()
}

// Strip common markdown formatting from text
fn strip_markdown(text: &str) -> String {
    let mut result = text.to_string();

    // Remove heading markers (##, ###, etc.)
    let trimmed = result.trim_start();
    if trimmed.starts_with('#') {
        result = trimmed.trim_start_matches('#').trim_start().to_string();
    }

    // Remove strikethrough (~~text~~) - before other markers
    while let Some(start) = result.find("~~") {
        if let Some(end) = result[start + 2..].find("~~") {
            let inner = &result[start + 2..start + 2 + end];
            result = format!("{}{}{}", &result[..start], inner, &result[start + 4 + end..]);
        } else {
            break;
        }
    }

    // Remove bold (**text** or __text__) - before italic
    while let Some(start) = result.find("**") {
        if let Some(end) = result[start + 2..].find("**") {
            let inner = &result[start + 2..start + 2 + end];
            result = format!("{}{}{}", &result[..start], inner, &result[start + 4 + end..]);
        } else {
            break;
        }
    }
    while let Some(start) = result.find("__") {
        if let Some(end) = result[start + 2..].find("__") {
            let inner = &result[start + 2..start + 2 + end];
            result = format!("{}{}{}", &result[..start], inner, &result[start + 4 + end..]);
        } else {
            break;
        }
    }

    // Remove inline code (`code`)
    while let Some(start) = result.find('`') {
        if let Some(end) = result[start + 1..].find('`') {
            let inner = &result[start + 1..start + 1 + end];
            result = format!("{}{}{}", &result[..start], inner, &result[start + 2 + end..]);
        } else {
            break;
        }
    }

    // Remove images ![alt](url) - must come before links
    let img_re = regex::Regex::new(r"!\[([^\]]*)\]\([^)]+\)").unwrap();
    result = img_re.replace_all(&result, "$1").to_string();

    // Remove links [text](url)
    let link_re = regex::Regex::new(r"\[([^\]]+)\]\([^)]+\)").unwrap();
    result = link_re.replace_all(&result, "$1").to_string();

    // Remove italic (*text* or _text_) - simple approach after bold is removed
    // Match *text* where text doesn't contain *
    while let Some(start) = result.find('*') {
        if let Some(end) = result[start + 1..].find('*') {
            if end > 0 {
                let inner = &result[start + 1..start + 1 + end];
                result = format!("{}{}{}", &result[..start], inner, &result[start + 2 + end..]);
            } else {
                break;
            }
        } else {
            break;
        }
    }
    // Match _text_ where text doesn't contain _
    while let Some(start) = result.find('_') {
        if let Some(end) = result[start + 1..].find('_') {
            if end > 0 {
                let inner = &result[start + 1..start + 1 + end];
                result = format!("{}{}{}", &result[..start], inner, &result[start + 2 + end..]);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Remove task list markers
    result = result
        .replace("- [ ] ", "")
        .replace("- [x] ", "")
        .replace("- [X] ", "");

    // Remove list markers at start (-, *, +, 1.)
    let list_re = regex::Regex::new(r"^(\s*[-+*]|\s*\d+\.)\s+").unwrap();
    result = list_re.replace(&result, "").to_string();

    result.trim().to_string()
}

/// Filter for WalkDir: skips dot-directories (e.g. .git) and assets/.
fn is_visible_notes_entry(entry: &walkdir::DirEntry) -> bool {
    if entry.file_type().is_dir() {
        let name = entry.file_name().to_str().unwrap_or("");
        return !name.starts_with('.') && name != "assets";
    }
    true
}

/// Convert an absolute file path to a note ID (relative path from notes root, no .md extension, POSIX separators).
/// Returns None if the path is outside the root, not a .md file, or in an excluded directory.
fn id_from_abs_path(notes_root: &Path, file_path: &Path) -> Option<String> {
    let rel = file_path.strip_prefix(notes_root).ok()?;

    // Skip excluded directories (dot-dirs catch .git, etc.)
    for component in rel.components() {
        if let std::path::Component::Normal(name) = component {
            let name_str = name.to_str()?;
            if name_str.starts_with('.') || name_str == "assets" {
                return None;
            }
        }
    }

    // Must be a .md file
    if file_path.extension()?.to_str()? != "md" {
        return None;
    }

    // Build ID: relative path without .md suffix, using POSIX separators.
    // Strip .md by converting to string and trimming (avoids with_extension
    // which breaks on stems containing dots like "meeting.2024-01-15.md").
    let rel_str = rel.to_str()?;
    let id = rel_str.strip_suffix(".md")?.replace(std::path::MAIN_SEPARATOR, "/");

    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

/// Convert a note ID to an absolute file path. Validates against path traversal.
fn abs_path_from_id(notes_root: &Path, id: &str) -> Result<PathBuf, String> {
    if id.contains('\\') {
        return Err("Invalid note ID: backslashes not allowed".to_string());
    }

    let rel = Path::new(id);

    for component in rel.components() {
        match component {
            std::path::Component::ParentDir => {
                return Err("Invalid note ID: parent directory references not allowed".to_string());
            }
            std::path::Component::CurDir => {
                return Err("Invalid note ID: current directory references not allowed".to_string());
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err("Invalid note ID: absolute paths not allowed".to_string());
            }
            _ => {}
        }
    }

    // Append ".md" via OsString to avoid with_extension replacing dots in stems
    // (e.g. "meeting.2024-01-15" would become "meeting.md" with with_extension)
    let joined = notes_root.join(rel);
    let mut file_path_os = joined.into_os_string();
    file_path_os.push(".md");
    let file_path = PathBuf::from(file_path_os);

    if !file_path.starts_with(notes_root) {
        return Err("Invalid note ID: path escapes notes folder".to_string());
    }

    Ok(file_path)
}

// Get app config file path (in app data directory)
fn get_app_config_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data)?;
    Ok(app_data.join("config.json"))
}

// Get settings file path (in app data directory)
fn get_settings_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("settings.json")
}

// Get search index path (isolated per folder by hash)
fn get_search_index_path(app: &AppHandle, folder: &str) -> Result<PathBuf> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let app_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data)?;
    let mut hasher = DefaultHasher::new();
    folder.hash(&mut hasher);
    Ok(app_data.join(format!("search_indexes/{:x}", hasher.finish())))
}

// Load app config from disk (notes folder path)
fn load_app_config(app: &AppHandle) -> AppConfig {
    let path = match get_app_config_path(app) {
        Ok(p) => p,
        Err(_) => return AppConfig::default(),
    };

    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

// Save app config to disk
fn save_app_config(app: &AppHandle, config: &AppConfig) -> Result<()> {
    let path = get_app_config_path(app)?;
    let content = serde_json::to_string_pretty(config)?;
    std::fs::write(path, content)?;
    Ok(())
}

// Load settings from app data directory
fn load_settings(app_data_dir: &Path) -> Settings {
    let path = get_settings_path(app_data_dir);

    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        Settings::default()
    }
}

// Save settings to app data directory
fn save_settings(app_data_dir: &Path, settings: &Settings) -> Result<()> {
    let path = get_settings_path(app_data_dir);
    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, content)?;
    Ok(())
}

// Clean up old entries from debounce map (entries older than 5 seconds)
fn cleanup_debounce_map(map: &Mutex<HashMap<PathBuf, Instant>>) {
    let mut map = map.lock().expect("debounce map mutex");
    let now = Instant::now();
    map.retain(|_, last| now.duration_since(*last) < Duration::from_secs(5));
}

// Normalize notes folder path from plain paths and legacy file:// URIs.
fn normalize_notes_folder_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Notes folder path is empty".to_string());
    }

    if trimmed.starts_with("file://") {
        let parsed = url::Url::parse(trimmed)
            .map_err(|e| format!("Invalid file URL for notes folder: {}", e))?;
        return parsed
            .to_file_path()
            .map_err(|_| "Invalid file URL for notes folder".to_string());
    }

    Ok(PathBuf::from(trimmed))
}

// TAURI COMMANDS

#[tauri::command]
fn get_last_folder(state: State<AppState>) -> Option<String> {
    state
        .app_config
        .read()
        .expect("app_config read lock")
        .last_folder
        .clone()
}

#[tauri::command]
fn initialize_folder(app: AppHandle, folder: String, state: State<AppState>) -> Result<(), String> {
    let path_buf = normalize_notes_folder_path(&folder)?;
    let normalized_path = path_buf.to_string_lossy().into_owned();

    // Verify it's a valid directory
    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf).map_err(|e| e.to_string())?;
    }

    // Create assets folder
    let assets = path_buf.join("assets");
    std::fs::create_dir_all(&assets).map_err(|e| e.to_string())?;

    // Check if already initialized
    {
        let states = state.folder_states.read().expect("folder_states read lock");
        if states.contains_key(&normalized_path) {
            // Already initialized — just update last_folder
            let mut app_config = state.app_config.write().expect("app_config write lock");
            app_config.last_folder = Some(normalized_path.clone());
            let _ = save_app_config(&app, &app_config);
            return Ok(());
        }
    }

    // Initialize search index
    let search_index = if let Ok(index_path) = get_search_index_path(&app, &normalized_path) {
        SearchIndex::new(&index_path).ok().inspect(|idx| {
            let _ = idx.rebuild_index(&path_buf);
        })
    } else {
        None
    };

    // Create FolderState
    let folder_state = Arc::new(FolderState {
        folder: normalized_path.clone(),
        notes_cache: RwLock::new(HashMap::new()),
        file_watcher: Mutex::new(None),
        search_index: Mutex::new(search_index),
        debounce_map: Arc::new(Mutex::new(HashMap::new())),
    });

    // Register in folder_states
    {
        let mut states = state.folder_states.write().expect("folder_states write lock");
        states.insert(normalized_path.clone(), folder_state);
    }

    // Update last_folder in app config
    {
        let mut app_config = state.app_config.write().expect("app_config write lock");
        app_config.last_folder = Some(normalized_path);
    }

    // Save app config to disk
    {
        let app_config = state.app_config.read().expect("app_config read lock");
        save_app_config(&app, &app_config).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn list_notes(folder: String, state: State<'_, AppState>) -> Result<Vec<NoteMetadata>, String> {
    let fs = get_folder_state(&state, &folder)?;

    let path = PathBuf::from(&folder);
    if !path.exists() {
        return Ok(vec![]);
    }

    let path_clone = path.clone();
    let discovered = tokio::task::spawn_blocking(move || {
        use walkdir::WalkDir;
        let mut results: Vec<(String, String, String, i64)> = Vec::new();
        for entry in WalkDir::new(&path_clone)
            .max_depth(1)
            .into_iter()
            .filter_entry(is_visible_notes_entry)
            .flatten()
        {
            let file_path = entry.path();
            if !file_path.is_file() {
                continue;
            }
            if let Some(id) = id_from_abs_path(&path_clone, file_path) {
                if let Ok(content) = std::fs::read_to_string(file_path) {
                    let modified = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    let title = extract_title(&content);
                    let preview = generate_preview(&content);
                    results.push((id, title, preview, modified));
                }
            }
        }
        results
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut notes: Vec<NoteMetadata> = discovered
        .into_iter()
        .map(|(id, title, preview, modified)| NoteMetadata {
            id,
            title,
            preview,
            modified,
        })
        .collect();

    // Sort by date (newest first)
    notes.sort_by(|a, b| b.modified.cmp(&a.modified));

    // Update cache efficiently
    {
        let mut cache = fs.notes_cache.write().expect("cache write lock");
        cache.clear();
        for note in &notes {
            cache.insert(note.id.clone(), note.clone());
        }
    }

    Ok(notes)
}

#[tauri::command]
async fn read_note(folder: String, id: String, state: State<'_, AppState>) -> Result<Note, String> {
    // Validate folder is initialized
    let _fs = get_folder_state(&state, &folder)?;

    let folder_path = PathBuf::from(&folder);
    let file_path = abs_path_from_id(&folder_path, &id)?;
    if !file_path.exists() {
        return Err("Note not found".to_string());
    }

    let content = fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    Ok(Note {
        id,
        title: extract_title(&content),
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
async fn save_note(
    folder: String,
    id: Option<String>,
    content: String,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    let fs = get_folder_state(&state, &folder)?;
    let folder_path = PathBuf::from(&folder);

    let title = extract_title(&content);
    let sanitized_leaf = sanitize_filename(&title);

    // Determine the file ID and path, handling renames
    let (final_id, file_path, old_id) = if let Some(existing_id) = id {
        // Preserve directory prefix for notes in subfolders
        let (dir_prefix, desired_id) = if let Some(pos) = existing_id.rfind('/') {
            let prefix = &existing_id[..pos];
            (Some(prefix.to_string()), format!("{}/{}", prefix, sanitized_leaf))
        } else {
            (None, sanitized_leaf.clone())
        };

        let old_file_path = abs_path_from_id(&folder_path, &existing_id)?;

        if existing_id != desired_id {
            let mut new_id = desired_id.clone();
            let mut counter = 1;

            while new_id != existing_id
                && abs_path_from_id(&folder_path, &new_id)
                    .map(|p| p.exists())
                    .unwrap_or(false)
            {
                new_id = if let Some(ref prefix) = dir_prefix {
                    format!("{}/{}-{}", prefix, sanitized_leaf, counter)
                } else {
                    format!("{}-{}", sanitized_leaf, counter)
                };
                counter += 1;
            }

            let new_file_path = abs_path_from_id(&folder_path, &new_id)?;
            (new_id, new_file_path, Some((existing_id, old_file_path)))
        } else {
            (existing_id, old_file_path, None)
        }
    } else {
        // New notes go in root
        let mut new_id = sanitized_leaf.clone();
        let mut counter = 1;

        while abs_path_from_id(&folder_path, &new_id)
            .map(|p| p.exists())
            .unwrap_or(false)
        {
            new_id = format!("{}-{}", sanitized_leaf, counter);
            counter += 1;
        }

        let new_file_path = abs_path_from_id(&folder_path, &new_id)?;
        (new_id, new_file_path, None)
    };

    // Write the file to the new path
    fs::write(&file_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    // Delete old file AFTER successful write (to prevent data loss)
    if let Some((_, ref old_file_path)) = old_id {
        if old_file_path.exists() && *old_file_path != file_path {
            let _ = fs::remove_file(old_file_path).await;
        }
    }

    let metadata = fs::metadata(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    // Update search index (delete old entry if renamed, then add new)
    {
        let index = fs.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            if let Some((ref old_id_str, _)) = old_id {
                let _ = search_index.delete_note(old_id_str);
            }
            let _ = search_index.index_note(&final_id, &title, &content, modified);
        }
    }

    // Update cache (remove old entry if renamed)
    if let Some((ref old_id_str, _)) = old_id {
        let mut cache = fs.notes_cache.write().expect("cache write lock");
        cache.remove(old_id_str);
    }

    Ok(Note {
        id: final_id,
        title,
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
async fn delete_note(folder: String, id: String, state: State<'_, AppState>) -> Result<(), String> {
    let fs = get_folder_state(&state, &folder)?;

    let folder_path = PathBuf::from(&folder);
    let file_path = abs_path_from_id(&folder_path, &id)?;
    if file_path.exists() {
        fs::remove_file(&file_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Update search index
    {
        let index = fs.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            let _ = search_index.delete_note(&id);
        }
    }

    // Remove from cache
    {
        let mut cache = fs.notes_cache.write().expect("cache write lock");
        cache.remove(&id);
    }

    Ok(())
}

#[tauri::command]
async fn create_note(folder: String, state: State<'_, AppState>) -> Result<Note, String> {
    let fs = get_folder_state(&state, &folder)?;
    let folder_path = PathBuf::from(&folder);

    // Find unique filename starting from "Untitled"
    let base_id = "Untitled".to_string();
    let mut final_id = base_id.clone();
    let mut counter = 1;

    while abs_path_from_id(&folder_path, &final_id)
        .map(|p| p.exists())
        .unwrap_or(false)
    {
        final_id = format!("{}-{}", base_id, counter);
        counter += 1;
    }

    let display_title = extract_title_from_id(&final_id);
    let content = format!("# {}\n\n", display_title);
    let file_path = abs_path_from_id(&folder_path, &final_id)?;

    fs::write(&file_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    let modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    // Update search index
    {
        let index = fs.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            let _ = search_index.index_note(&final_id, &display_title, &content, modified);
        }
    }

    Ok(Note {
        id: final_id,
        title: display_title,
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
fn get_settings(folder: String, state: State<AppState>) -> Result<Settings, String> {
    // Validate folder is initialized
    let _fs = get_folder_state(&state, &folder)?;
    let settings = state.settings.read().expect("settings read lock").clone();
    Ok(settings)
}

#[tauri::command]
fn update_settings(
    folder: String,
    new_settings: Settings,
    state: State<AppState>,
) -> Result<(), String> {
    // Validate folder is initialized
    let _fs = get_folder_state(&state, &folder)?;

    {
        let mut settings = state.settings.write().expect("settings write lock");
        *settings = new_settings;
    }

    let settings = state.settings.read().expect("settings read lock");
    save_settings(&state.app_data_dir, &settings).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn search_notes(folder: String, query: String, state: State<'_, AppState>) -> Result<Vec<SearchResult>, String> {
    let fs = get_folder_state(&state, &folder)?;
    let trimmed_query = query.trim().to_string();
    if trimmed_query.is_empty() {
        return Ok(vec![]);
    }

    // Check if search index is available and use it (scoped to drop lock before await)
    let indexed_result = {
        let index = fs.search_index.lock().expect("search index mutex");
        (*index).as_ref().map(|search_index| {
            search_index.search(&trimmed_query, 20).map_err(|e| e.to_string())
        })
    };

    match indexed_result {
        Some(Ok(results)) if !results.is_empty() => Ok(results),
        Some(Ok(_)) => {
            // Tantivy can miss partial/fuzzy matches; fall back to substring search.
            fallback_search(&trimmed_query, &folder, &fs).await
        }
        Some(Err(e)) => {
            eprintln!("Tantivy search error, falling back to substring search: {}", e);
            fallback_search(&trimmed_query, &folder, &fs).await
        }
        None => {
            // Fallback to simple search if index not available
            fallback_search(&trimmed_query, &folder, &fs).await
        }
    }
}

// Fallback search when Tantivy index isn't available - searches title and full content
async fn fallback_search(query: &str, folder: &str, fs: &Arc<FolderState>) -> Result<Vec<SearchResult>, String> {
    // Collect cache data upfront to avoid holding lock during async operations
    let cache_data: Vec<(String, String, String, i64)> = {
        let cache = fs.notes_cache.read().expect("cache read lock");
        cache
            .values()
            .map(|note| {
                (
                    note.id.clone(),
                    note.title.clone(),
                    note.preview.clone(),
                    note.modified,
                )
            })
            .collect()
    };

    let folder_path = PathBuf::from(folder);
    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for (id, title, preview, modified) in cache_data {
        let title_lower = title.to_lowercase();

        let mut score = 0.0f32;
        if title_lower.contains(&query_lower) {
            score += 50.0;
        }

        // Read file content asynchronously and search in it
        let file_path = match abs_path_from_id(&folder_path, &id) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if let Ok(content) = tokio::fs::read_to_string(&file_path).await {
            let content_lower = content.to_lowercase();
            if content_lower.contains(&query_lower) {
                // Higher score if in title, lower if only in content
                if score == 0.0 {
                    score += 10.0;
                } else {
                    score += 5.0;
                }
            }
        }

        if score > 0.0 {
            results.push(SearchResult {
                id,
                title,
                preview,
                modified,
                score,
            });
        }
    }

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(20);

    Ok(results)
}

// File watcher event payload
#[derive(Clone, Serialize)]
struct FileChangeEvent {
    kind: String,
    path: String,
    changed_ids: Vec<String>,
}

fn setup_file_watcher(
    app: AppHandle,
    notes_folder: &str,
    debounce_map: Arc<Mutex<HashMap<PathBuf, Instant>>>,
) -> Result<FileWatcherState, String> {
    let folder_path = PathBuf::from(notes_folder);
    let notes_root = folder_path.clone();
    let app_handle = app.clone();
    let folder_key = notes_folder.to_string();

    let watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                for path in event.paths.iter() {
                    let note_id = match id_from_abs_path(&notes_root, path) {
                        Some(id) => id,
                        None => continue,
                    };

                    // Debounce with cleanup
                    {
                        let mut map = debounce_map.lock().expect("debounce map mutex");
                        let now = Instant::now();

                        if map.len() > 100 {
                            map.retain(|_, last| now.duration_since(*last) < Duration::from_secs(5));
                        }

                        if let Some(last) = map.get(path) {
                            if now.duration_since(*last) < Duration::from_millis(500) {
                                continue;
                            }
                        }
                        map.insert(path.clone(), now);
                    }

                    let kind = match event.kind {
                        notify::EventKind::Create(_) => "created",
                        notify::EventKind::Modify(_) => "modified",
                        notify::EventKind::Remove(_) => "deleted",
                        // Some backends emit Any for renames or unclassified changes
                        notify::EventKind::Any => "modified",
                        _ => continue,
                    };

                    // Update search index for external file changes
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        let fs = {
                            let states = state.folder_states.read().expect("folder_states read lock");
                            states.get(&folder_key).cloned()
                        };
                        if let Some(fs) = fs {
                            let index = fs.search_index.lock().expect("search index mutex");
                            if let Some(ref search_index) = *index {
                                match kind {
                                    "created" | "modified" => {
                                        match std::fs::read_to_string(path) {
                                            Ok(content) => {
                                                let title = extract_title(&content);
                                                let modified = std::fs::metadata(path)
                                                    .ok()
                                                    .and_then(|m| m.modified().ok())
                                                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                                    .map(|d| d.as_secs() as i64)
                                                    .unwrap_or(0);
                                                let _ = search_index.index_note(&note_id, &title, &content, modified);
                                            }
                                            Err(_) => {
                                                // File gone between event and read — treat as deletion
                                                if !path.exists() {
                                                    let _ = search_index.delete_note(&note_id);
                                                }
                                            }
                                        }
                                    }
                                    "deleted" => {
                                        let _ = search_index.delete_note(&note_id);
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }

                    // Determine the actual kind for the frontend event
                    // (a "modified" event on a non-existent file is really a delete)
                    let effective_kind = if kind == "modified" && !path.exists() {
                        "deleted"
                    } else {
                        kind
                    };

                    let _ = app_handle.emit(
                        "file-change",
                        FileChangeEvent {
                            kind: effective_kind.to_string(),
                            path: path.to_string_lossy().into_owned(),
                            changed_ids: vec![note_id.clone()],
                        },
                    );
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    let mut watcher = watcher;

    // Watch the notes folder (top-level only, no subdirectories)
    watcher
        .watch(&folder_path, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    Ok(FileWatcherState { watcher })
}

#[tauri::command]
fn start_file_watcher(folder: String, app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let fs = get_folder_state(&state, &folder)?;

    // Clean up debounce map before starting
    cleanup_debounce_map(&fs.debounce_map);

    let watcher_state = setup_file_watcher(
        app,
        &folder,
        Arc::clone(&fs.debounce_map),
    )?;

    let mut file_watcher = fs.file_watcher.lock().expect("file watcher mutex");
    *file_watcher = Some(watcher_state);

    Ok(())
}

#[tauri::command]
fn copy_to_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_clipboard_image(
    folder: String,
    base64_data: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Guard against empty clipboard payload
    if base64_data.trim().is_empty() {
        return Err("Clipboard data is empty".to_string());
    }

    // Validate folder is initialized
    let _fs = get_folder_state(&state, &folder)?;

    // Decode base64
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Guard against zero-byte files
    if image_data.is_empty() {
        return Err("Decoded image data is empty".to_string());
    }

    // Create assets folder path
    let assets_dir = PathBuf::from(&folder).join("assets");
    fs::create_dir_all(&assets_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Generate unique filename with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut target_name = format!("screenshot-{}.png", timestamp);
    let mut counter = 1;
    let mut target_path = assets_dir.join(&target_name);

    while target_path.exists() {
        target_name = format!("screenshot-{}-{}.png", timestamp, counter);
        target_path = assets_dir.join(&target_name);
        counter += 1;
    }

    // Write the file
    fs::write(&target_path, &image_data)
        .await
        .map_err(|e| format!("Failed to write image: {}", e))?;

    // Return relative path
    Ok(format!("assets/{}", target_name))
}

#[tauri::command]
async fn copy_image_to_assets(
    folder: String,
    source_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Validate folder is initialized
    let _fs = get_folder_state(&state, &folder)?;

    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("Source image file does not exist".to_string());
    }

    // Get file extension
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Invalid file extension")?;

    // Get original filename (without extension)
    let original_name = source
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("image");

    // Sanitize the filename
    let sanitized_name = sanitize_filename(original_name);

    // Create assets folder path
    let assets_dir = PathBuf::from(&folder).join("assets");
    fs::create_dir_all(&assets_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Generate unique filename
    let mut target_name = format!("{}.{}", sanitized_name, extension);
    let mut counter = 1;
    let mut target_path = assets_dir.join(&target_name);

    while target_path.exists() {
        target_name = format!("{}-{}.{}", sanitized_name, counter, extension);
        target_path = assets_dir.join(&target_name);
        counter += 1;
    }

    // Copy the file
    fs::copy(&source, &target_path)
        .await
        .map_err(|e| format!("Failed to copy image: {}", e))?;

    // Return both relative path and filename for frontend to construct the URL
    Ok(format!("assets/{}", target_name))
}

#[tauri::command]
fn rebuild_search_index(folder: String, app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let fs = get_folder_state(&state, &folder)?;

    let index_path = get_search_index_path(&app, &folder).map_err(|e| e.to_string())?;

    // Create new index
    let search_index = SearchIndex::new(&index_path).map_err(|e| e.to_string())?;
    search_index
        .rebuild_index(&PathBuf::from(&folder))
        .map_err(|e| e.to_string())?;

    let mut index = fs.search_index.lock().expect("search index mutex");
    *index = Some(search_index);

    Ok(())
}

// UI helper commands - wrap Tauri plugins for consistent invoke-based API

#[tauri::command]
async fn open_folder_dialog(
    app: AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    // Run blocking dialog on a separate thread to avoid blocking the async runtime
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut builder = app.dialog().file().set_can_create_directories(true);

        if let Some(path) = default_path {
            builder = builder.set_directory(path);
        }

        builder.blocking_pick_folder()
    })
    .await
    .map_err(|e| format!("Dialog task failed: {}", e))?;

    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
async fn open_in_file_manager(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() || !path_buf.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        let windows_path = path.replace("/", "\\");
        std::process::Command::new("explorer")
            .arg(&windows_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return Err("Unsupported platform".to_string());
    }

    Ok(())
}

#[tauri::command]
async fn open_url_safe(url: String) -> Result<(), String> {
    // Validate URL scheme - only allow http, https, mailto
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;

    match parsed.scheme() {
        "http" | "https" | "mailto" => {}
        scheme => {
            return Err(format!(
                "URL scheme '{}' is not allowed. Only http, https, and mailto are permitted.",
                scheme
            ))
        }
    }

    // Use system opener
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

// Check if Claude CLI is installed
fn get_expanded_path() -> String {
    let system_path = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_else(|_| String::new());

    if home.is_empty() {
        return system_path;
    }

    // Common locations for node-installed CLIs (nvm, volta, fnm, homebrew, global npm)
    let candidate_dirs = vec![
        format!("{home}/.nvm/versions/node"),
        format!("{home}/.fnm/node-versions"),
    ];
    let static_dirs = vec![
        format!("{home}/.volta/bin"),
        format!("{home}/.local/bin"),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
    ];

    let mut expanded = Vec::new();

    // Prefer well-known static locations (e.g. ~/.local/bin for native CLI installs)
    for dir in static_dirs {
        expanded.push(dir);
    }

    // Then scan nvm/fnm node version dirs containing a bin/ folder
    for base in &candidate_dirs {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let bin_path = entry.path().join("bin");
                if bin_path.exists() {
                    expanded.push(bin_path.to_string_lossy().to_string());
                }
            }
        }
    }

    expanded.push(system_path);
    expanded.join(":")
}

fn check_cli_exists(command_name: &str, path: &str) -> Result<bool, String> {
    use std::process::Command;

    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let check_output = Command::new(which_cmd)
        .arg(command_name)
        .env("PATH", path)
        .output()
        .map_err(|e| format!("Failed to check for {} CLI: {}", command_name, e))?;

    Ok(check_output.status.success())
}

#[tauri::command]
async fn ai_check_claude_cli() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = get_expanded_path();
        check_cli_exists("claude", &path)
    })
    .await
    .map_err(|e| format!("Failed to check Claude CLI: {}", e))?
}

#[tauri::command]
async fn ai_check_codex_cli() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = get_expanded_path();
        check_cli_exists("codex", &path)
    })
    .await
    .map_err(|e| format!("Failed to check Codex CLI: {}", e))?
}

/// Shared AI CLI execution: spawns `command` with `args`, writes `stdin_input` to stdin,
/// and returns the result with a 5-minute timeout.
async fn execute_ai_cli(
    cli_name: &str,
    command: String,
    args: Vec<String>,
    stdin_input: String,
    not_found_msg: String,
) -> Result<AiExecutionResult, String> {
    use std::io::Write;
    use std::process::{Child, Command, Stdio};

    let cli_name = cli_name.to_string();
    let timeout_duration = std::time::Duration::from_secs(300);
    let shared_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let child_for_task = Arc::clone(&shared_child);
    let cli_name_task = cli_name.clone();

    let mut task = tauri::async_runtime::spawn_blocking(move || {
        // Blocking I/O: expand PATH and check CLI exists
        let path = get_expanded_path();
        match check_cli_exists(&command, &path) {
            Ok(false) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(not_found_msg),
                };
            }
            Err(e) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(e),
                };
            }
            Ok(true) => {}
        }

        let mut cmd = Command::new(&command);
        cmd.env("PATH", &path);
        for arg in &args {
            cmd.arg(arg);
        }
        let process = match cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(p) => p,
            Err(e) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to execute {}: {}", cli_name_task, e)),
                };
            }
        };

        // Store process in shared state so the timeout handler can kill it.
        // We only take individual I/O handles below — the Child stays in the
        // mutex so it remains reachable for kill().
        if let Ok(mut guard) = child_for_task.lock() {
            *guard = Some(process);
        } else {
            return AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("Failed to lock {} process handle", cli_name_task)),
            };
        }

        // Take stdin handle (briefly locks then releases)
        let stdin_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stdin.take()));

        if let Some(mut stdin) = stdin_handle {
            if let Err(e) = stdin.write_all(stdin_input.as_bytes()) {
                if let Ok(mut g) = child_for_task.lock() {
                    if let Some(ref mut p) = *g {
                        let _ = p.kill();
                        let _ = p.wait();
                    }
                }
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to write to {} stdin: {}", cli_name_task, e)),
                };
            }
            // stdin dropped here — closes the pipe
        } else {
            if let Ok(mut g) = child_for_task.lock() {
                if let Some(ref mut p) = *g {
                    let _ = p.kill();
                    let _ = p.wait();
                }
            }
            return AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("Failed to open stdin for {}", cli_name_task)),
            };
        }

        // Take stdout/stderr handles so we can read without holding the lock.
        // This allows the timeout handler to lock the mutex and kill the process.
        let stdout_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stdout.take()));
        let stderr_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stderr.take()));

        use std::io::Read;

        let mut stdout_str = String::new();
        if let Some(mut out) = stdout_handle {
            let _ = out.read_to_string(&mut stdout_str);
        }

        let mut stderr_str = String::new();
        if let Some(mut err) = stderr_handle {
            let _ = err.read_to_string(&mut stderr_str);
        }

        // Collect exit status — process has exited after stdout/stderr close
        let success = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.wait().ok()))
            .map(|s| s.success())
            .unwrap_or(false);

        if success {
            AiExecutionResult {
                success: true,
                output: stdout_str,
                error: None,
            }
        } else {
            AiExecutionResult {
                success: false,
                output: stdout_str,
                error: Some(stderr_str),
            }
        }
    });

    let result = match tokio::time::timeout(timeout_duration, &mut task).await {
        Ok(join_result) => {
            join_result.map_err(|e| format!("Failed to join {} blocking task: {}", cli_name, e))?
        }
        Err(_) => {
            // Kill through the shared handle — the Child is still in the mutex
            // because the blocking task only takes I/O handles, not the Child.
            // This sends SIGKILL, which closes the pipes and unblocks the reads.
            if let Ok(mut guard) = shared_child.lock() {
                if let Some(ref mut process) = *guard {
                    let _ = process.kill();
                }
            }

            match tokio::time::timeout(std::time::Duration::from_secs(5), task).await {
                Ok(join_result) => {
                    if let Err(e) = join_result {
                        return Err(format!(
                            "Failed to join {} blocking task after timeout: {}",
                            cli_name, e
                        ));
                    }
                }
                Err(_) => {
                    return Err(format!(
                        "{} CLI timed out and failed to exit after kill signal",
                        cli_name
                    ));
                }
            }

            AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("{} CLI timed out after 5 minutes", cli_name)),
            }
        }
    };

    Ok(result)
}

#[tauri::command]
async fn ai_execute_claude(file_path: String, prompt: String) -> Result<AiExecutionResult, String> {
    execute_ai_cli(
        "Claude",
        "claude".to_string(),
        vec![
            file_path,
            "--dangerously-skip-permissions".to_string(),
            "--print".to_string(),
        ],
        prompt,
        "Claude CLI not found. Please install it from https://claude.ai/code".to_string(),
    )
    .await
}

#[tauri::command]
async fn ai_execute_codex(file_path: String, prompt: String) -> Result<AiExecutionResult, String> {
    let stdin_input = format!(
        "Edit only this markdown file: {file_path}\n\
         Apply the user's instructions below directly to that file.\n\
         Do not create, delete, rename, or modify any other files.\n\
         User instructions:\n\
         {prompt}"
    );

    execute_ai_cli(
        "Codex",
        "codex".to_string(),
        vec![
            "exec".to_string(),
            "--skip-git-repo-check".to_string(),
            "--dangerously-bypass-approvals-and-sandbox".to_string(),
            "-".to_string(),
        ],
        stdin_input,
        "Codex CLI not found. Please install it from https://github.com/openai/codex".to_string(),
    )
    .await
}

/// Check if a file extension is a supported markdown extension.
fn is_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|s| {
            let lower = s.to_ascii_lowercase();
            lower == "md" || lower == "markdown"
        })
        .unwrap_or(false)
}

/// Generate a stable window label from a folder path.
fn window_label_for_folder(folder: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    folder.hash(&mut hasher);
    format!("dir-{:x}", hasher.finish())
}

/// Build the URL for a directory window.
fn build_directory_url(folder: &str, select_file: Option<&str>) -> String {
    let encoded_folder = urlencoding::encode(folder);
    if let Some(file_id) = select_file {
        let encoded_select = urlencoding::encode(file_id);
        format!("index.html?folder={}&select={}", encoded_folder, encoded_select)
    } else {
        format!("index.html?folder={}", encoded_folder)
    }
}

/// Create (or focus) a full directory window for the given folder,
/// optionally selecting a specific file.
fn create_directory_window(app: &AppHandle, folder: &str, select_file: Option<&str>) -> Result<(), String> {
    let label = window_label_for_folder(folder);

    // If window already exists for this folder, emit select-note and focus
    if let Some(window) = app.get_webview_window(&label) {
        if let Some(file_id) = select_file {
            let _ = app.emit_to(&*label, "select-note", file_id.to_string());
        }
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // If the main window exists, navigate it to the folder instead of creating a new window
    if let Some(main_window) = app.get_webview_window("main") {
        // Emit open-folder event so the frontend can navigate
        #[derive(Clone, Serialize)]
        struct OpenFolderEvent {
            folder: String,
            select: Option<String>,
        }
        let _ = main_window.emit("open-folder", OpenFolderEvent {
            folder: folder.to_string(),
            select: select_file.map(|s| s.to_string()),
        });

        // Extract folder name for window title
        let folder_name = PathBuf::from(folder)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Notes".to_string());
        let _ = main_window.set_title(&format!("{} — Verso", folder_name));
        let _ = main_window.set_focus();
        return Ok(());
    }

    let url = build_directory_url(folder, select_file);

    // Extract folder name for window title
    let folder_name = PathBuf::from(folder)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Notes".to_string());

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title(format!("{} — Verso", folder_name))
        .inner_size(1080.0, 720.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .decorations(true);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create directory window: {}", e))?;

    // Focus the window (short delay to handle cold-start race)
    let win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = win.set_focus();
    });

    Ok(())
}

/// Handle opening a markdown file: extract parent directory, derive note ID,
/// create/focus directory window.
fn handle_open_file(app: &AppHandle, path: &Path) {
    let parent = match path.parent() {
        Some(p) => p.to_string_lossy().into_owned(),
        None => return,
    };

    let note_id = id_from_abs_path(Path::new(&parent), path);

    let _ = create_directory_window(app, &parent, note_id.as_deref());
}

// Handle CLI arguments: open .md files as directory windows
fn handle_cli_args(app: &AppHandle, args: &[String], cwd: &str) {
    let mut opened_file = false;

    for arg in args.iter().skip(1) {
        // Skip flags
        if arg.starts_with('-') {
            continue;
        }

        let path = if PathBuf::from(arg).is_absolute() {
            PathBuf::from(arg)
        } else {
            PathBuf::from(cwd).join(arg)
        };

        if is_markdown_extension(&path) && path.is_file() {
            opened_file = true;
            handle_open_file(app, &path);
        }
    }

    // If no files were opened, focus the main window
    if !opened_file {
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Single-instance: forward CLI args from subsequent launches to the running instance
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            handle_cli_args(app, &args, &cwd);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // Load app config on startup
            let mut app_config = load_app_config(app.handle());

            // Normalize legacy/invalid saved paths (e.g. file:// URI from older builds)
            if let Some(saved_path) = app_config.last_folder.clone() {
                match normalize_notes_folder_path(&saved_path) {
                    Ok(normalized) if normalized.is_dir() => {
                        let normalized_str = normalized.to_string_lossy().into_owned();
                        if normalized_str != saved_path {
                            app_config.last_folder = Some(normalized_str);
                            let _ = save_app_config(app.handle(), &app_config);
                        }
                    }
                    Ok(normalized) => {
                        eprintln!("Notes folder not found (may be temporarily unavailable): {:?}", normalized);
                    }
                    Err(_) => {
                        app_config.last_folder = None;
                        let _ = save_app_config(app.handle(), &app_config);
                    }
                }
            }

            // Create app state with global settings from app data directory
            let app_data_dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let settings = load_settings(&app_data_dir);

            let state = AppState {
                app_data_dir,
                app_config: RwLock::new(app_config),
                settings: RwLock::new(settings),
                folder_states: RwLock::new(HashMap::new()),
            };
            app.manage(state);

            // Handle CLI args on first launch
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let cwd = std::env::current_dir()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned();
                handle_cli_args(app.handle(), &args, &cwd);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle drag-and-drop of .md files onto any window
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let app = window.app_handle();
                for path in paths {
                    if is_markdown_extension(path) && path.is_file() {
                        handle_open_file(app, path);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_last_folder,
            initialize_folder,
            list_notes,
            read_note,
            save_note,
            delete_note,
            create_note,
            get_settings,
            update_settings,
            write_file,
            search_notes,
            start_file_watcher,
            rebuild_search_index,
            copy_to_clipboard,
            copy_image_to_assets,
            save_clipboard_image,
            open_folder_dialog,
            open_in_file_manager,
            open_url_safe,
            ai_check_claude_cli,
            ai_check_codex_cli,
            ai_execute_claude,
            ai_execute_codex,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Use .run() callback to handle macOS "Open With" file events
    // RunEvent::Opened is macOS-only in Tauri v2
    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if is_markdown_extension(&path) && path.is_file() {
                        handle_open_file(_app_handle, &path);
                    }
                }
            }
        }
    });
}
