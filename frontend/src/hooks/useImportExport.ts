import { useCallback, useEffect } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";
import { pickMarkdownFile, saveMarkdownFile } from "../lib/fileIO";
import {
  parseMarkdownFile,
  serializeNoteToMarkdown,
  noteToFileName,
} from "../lib/markdownFile";

/**
 * Import a `.md` file as a new note, and export the active note to a `.md`
 * file. Both flows also fire from the native Tauri File menu (`menu-import` /
 * `menu-export` events). Store reads go through `getState()` so the callbacks
 * stay stable for the menu-event listeners.
 */
export function useImportExport() {
  const activeNoteId = useAppStore((s) => s.activeNoteId);

  const importFile = useCallback(async () => {
    const file = await pickMarkdownFile();
    if (!file) return;

    const parsed = parseMarkdownFile(file.content, file.name);
    try {
      const note = await api.notes.create({
        title: parsed.title,
        markdown: parsed.markdown,
        tags: parsed.tags,
        notebookId: "default",
      });
      const { notes, setNotes, setActiveNoteId } = useAppStore.getState();
      setNotes([note, ...notes]);
      setActiveNoteId(note._id);
    } catch (err) {
      console.error("Failed to import note:", err);
    }
  }, []);

  const exportActiveNote = useCallback(async () => {
    const { notes, activeNoteId } = useAppStore.getState();
    const note = notes.find((n) => n._id === activeNoteId);
    if (!note) return;

    try {
      await saveMarkdownFile(noteToFileName(note), serializeNoteToMarkdown(note));
    } catch (err) {
      console.error("Failed to export note:", err);
    }
  }, []);

  // Native File menu items (desktop) emit these events.
  useEffect(() => {
    const unlisten: Array<() => void> = [];
    import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        unlisten.push(await listen("menu-import", () => importFile()));
        unlisten.push(await listen("menu-export", () => exportActiveNote()));
      })
      .catch(() => {
        // Not running in Tauri (browser dev mode) — header buttons handle it.
      });
    return () => unlisten.forEach((fn) => fn());
  }, [importFile, exportActiveNote]);

  return { importFile, exportActiveNote, canExport: activeNoteId !== null };
}
