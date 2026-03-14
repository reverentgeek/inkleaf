import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";
import type { Note } from "../api/client";

export function useNotes() {
  const {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    activeTag,
    isVaultMode,
  } = useAppStore();

  const fetchNotes = useCallback(async () => {
    if (isVaultMode) return;
    try {
      const data = await api.notes.list();
      setNotes(data);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    }
  }, [isVaultMode, setNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const filteredNotes = useMemo(() => {
    if (!activeTag) return notes;
    return notes.filter((n) =>
      n.tags.some((t) => t === activeTag || t.startsWith(activeTag + "/")),
    );
  }, [notes, activeTag]);

  const createNote = useCallback(async () => {
    try {
      const note = await api.notes.create({
        title: "Untitled",
        markdown: "",
        tags: activeTag ? [activeTag] : [],
        notebookId: "default",
      });
      setNotes([note, ...notes]);
      setActiveNoteId(note._id);
      return note;
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }, [notes, activeTag, setNotes, setActiveNoteId]);

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
    filteredNotes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
