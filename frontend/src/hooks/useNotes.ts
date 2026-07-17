import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";
import type { Note } from "../api/client";

export function useNotes() {
  const {
    notes,
    setNotes,
    trashNotes,
    setTrashNotes,
    activeNoteId,
    setActiveNoteId,
    activeTag,
    showToast,
  } = useAppStore();

  // Bumps when a background sync pulls remote changes into the local store
  // (e.g. edits from another device, or the initial pull on a fresh machine).
  const syncRevision = useAppStore((s) => s.syncStatus?.revision);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await api.notes.list();
      setNotes(data);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    }
  }, [setNotes]);

  const fetchTrash = useCallback(async () => {
    try {
      const data = await api.notes.trash();
      setTrashNotes(data);
    } catch (err) {
      console.error("Failed to fetch trash:", err);
    }
  }, [setTrashNotes]);

  useEffect(() => {
    fetchNotes();
    fetchTrash();
  }, [fetchNotes, fetchTrash, syncRevision]);

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

  // Restore a trashed note back to the active list.
  const restoreNote = useCallback(
    async (id: string) => {
      try {
        await api.notes.restore(id);
        await Promise.all([fetchNotes(), fetchTrash()]);
      } catch (err) {
        console.error("Failed to restore note:", err);
      }
    },
    [fetchNotes, fetchTrash],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n._id === id);
      try {
        // Soft delete — the note moves to the trash and can be restored.
        await api.notes.delete(id);
        setNotes(notes.filter((n) => n._id !== id));
        if (activeNoteId === id) {
          setActiveNoteId(null);
        }
        fetchTrash();
        showToast({
          message: `“${note?.title || "Untitled"}” moved to Trash`,
          actionLabel: "Undo",
          onAction: () => restoreNote(id),
        });
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    },
    [
      notes,
      activeNoteId,
      setNotes,
      setActiveNoteId,
      fetchTrash,
      showToast,
      restoreNote,
    ],
  );

  // Permanently remove a trashed note (not recoverable).
  const permanentDeleteNote = useCallback(
    async (id: string) => {
      try {
        await api.notes.permanentDelete(id);
        setTrashNotes(trashNotes.filter((n) => n._id !== id));
      } catch (err) {
        console.error("Failed to permanently delete note:", err);
      }
    },
    [trashNotes, setTrashNotes],
  );

  // Resolve the selection from either list so a trashed note can be previewed.
  // Permanently remove every trashed note.
  const emptyTrash = useCallback(async () => {
    try {
      await api.notes.emptyTrash();
      setTrashNotes([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  }, [setTrashNotes]);

  const activeNote =
    notes.find((n) => n._id === activeNoteId) ||
    trashNotes.find((n) => n._id === activeNoteId) ||
    null;

  return {
    notes,
    trashNotes,
    filteredNotes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    fetchNotes,
    fetchTrash,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    emptyTrash,
  };
}
