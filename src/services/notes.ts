import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteMetadata, Settings } from "../types/note";

export async function getLastFolder(): Promise<string | null> {
  return invoke("get_last_folder");
}

export async function initializeFolder(folder: string): Promise<void> {
  return invoke("initialize_folder", { folder });
}

export async function listNotes(folder: string): Promise<NoteMetadata[]> {
  return invoke("list_notes", { folder });
}

export async function readNote(folder: string, id: string): Promise<Note> {
  return invoke("read_note", { folder, id });
}

export async function saveNote(folder: string, id: string | null, content: string): Promise<Note> {
  return invoke("save_note", { folder, id, content });
}

export async function deleteNote(folder: string, id: string): Promise<void> {
  return invoke("delete_note", { folder, id });
}

export async function createNote(folder: string): Promise<Note> {
  return invoke("create_note", { folder });
}

export async function duplicateNote(folder: string, id: string): Promise<Note> {
  const original = await readNote(folder, id);
  const newNote = await createNote(folder);
  const duplicatedContent = original.content.replace(/^# (.+)$/m, (_, title) => `# ${title} (Copy)`);
  return saveNote(folder, newNote.id, duplicatedContent || original.content);
}

export async function getSettings(folder: string): Promise<Settings> {
  return invoke("get_settings", { folder });
}

export async function updateSettings(folder: string, settings: Settings): Promise<void> {
  return invoke("update_settings", { folder, newSettings: settings });
}

export interface SearchResult {
  id: string;
  title: string;
  preview: string;
  modified: number;
  score: number;
}

export async function searchNotes(folder: string, query: string): Promise<SearchResult[]> {
  return invoke("search_notes", { folder, query });
}

export async function startFileWatcher(folder: string): Promise<void> {
  return invoke("start_file_watcher", { folder });
}
