import { useCallback, useEffect } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";
import type { VaultNote } from "../api/client";

export function useVault() {
  const {
    vaultNotes,
    setVaultNotes,
    activeNoteId,
    setActiveNoteId,
    isVaultMode,
  } = useAppStore();

  const fetchVaultNotes = useCallback(async () => {
    if (!isVaultMode) return;
    try {
      const data = await api.vault.list();
      if (Array.isArray(data)) {
        setVaultNotes(data);
      }
    } catch (err) {
      console.error("Failed to fetch vault notes:", err);
    }
  }, [isVaultMode, setVaultNotes]);

  useEffect(() => {
    fetchVaultNotes();
  }, [fetchVaultNotes]);

  const createVaultNote = useCallback(async () => {
    try {
      const note = await api.vault.create({
        title: "Untitled (Vault)",
        markdown: "",
        tags: [],
      });
      setVaultNotes([note, ...vaultNotes]);
      setActiveNoteId(note._id);
      return note;
    } catch (err) {
      console.error("Failed to create vault note:", err);
    }
  }, [vaultNotes, setVaultNotes, setActiveNoteId]);

  const updateVaultNote = useCallback(
    async (id: string, data: Partial<VaultNote>) => {
      try {
        const updated = await api.vault.update(id, data);
        setVaultNotes(vaultNotes.map((n) => (n._id === id ? updated : n)));
        return updated;
      } catch (err) {
        console.error("Failed to update vault note:", err);
      }
    },
    [vaultNotes, setVaultNotes],
  );

  const deleteVaultNote = useCallback(
    async (id: string) => {
      try {
        await api.vault.delete(id);
        setVaultNotes(vaultNotes.filter((n) => n._id !== id));
        if (activeNoteId === id) {
          setActiveNoteId(null);
        }
      } catch (err) {
        console.error("Failed to delete vault note:", err);
      }
    },
    [vaultNotes, activeNoteId, setVaultNotes, setActiveNoteId],
  );

  const activeVaultNote =
    vaultNotes.find((n) => n._id === activeNoteId) || null;

  return {
    vaultNotes,
    activeVaultNote,
    fetchVaultNotes,
    createVaultNote,
    updateVaultNote,
    deleteVaultNote,
  };
}
