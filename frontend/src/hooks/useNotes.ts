import { useCallback, useEffect, useRef } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";
import type { Note } from "../api/client";

export function useNotes() {
  const {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    activeNotebook,
    isVaultMode,
  } = useAppStore();

  const fetchNotes = useCallback(async () => {
    if (isVaultMode) return;
    try {
      const data = await api.notes.list(activeNotebook || undefined);
      setNotes(data);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    }
  }, [activeNotebook, isVaultMode, setNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const createNote = useCallback(async () => {
    try {
      const note = await api.notes.create({
        title: "Untitled",
        markdown: "",
        tags: [],
        notebookId: activeNotebook || "default",
      });
      setNotes([note, ...notes]);
      setActiveNoteId(note._id);
      return note;
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }, [notes, activeNotebook, setNotes, setActiveNoteId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateNote = useCallback(
    (id: string, data: Partial<Note>) => {
      // Optimistic local update: merge changes and move to top
      const updated = notes.find((n) => n._id === id);
      if (!updated) return;
      setNotes([{ ...updated, ...data }, ...notes.filter((n) => n._id !== id)]);

      // Debounce the API call
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.notes.update(id, data);
        } catch (err) {
          console.error("Failed to update note:", err);
        }
      }, 400);
    },
    [notes, setNotes],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      try {
        await api.notes.delete(id);
        setNotes(notes.filter((n) => n._id !== id));
        if (activeNoteId === id) {
          setActiveNoteId(null);
        }
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    },
    [notes, activeNoteId, setNotes, setActiveNoteId],
  );

  const activeNote = notes.find((n) => n._id === activeNoteId) || null;

  return {
    notes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
