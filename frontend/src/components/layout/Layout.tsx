import { useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MarkdownEditor from "../editor/MarkdownEditor";
import MarkdownPreview from "../editor/MarkdownPreview";
import TagInput from "../tags/TagInput";
import RelatedNotes from "../notes/RelatedNotes";
import CommandPalette from "../search/CommandPalette";
import { useNotes } from "../../hooks/useNotes";
import { useVault } from "../../hooks/useVault";
import { useAppStore } from "../../stores/appStore";
import type { Note } from "../../api/client";
import { Eye, Edit3 } from "lucide-react";

export default function Layout() {
  const {
    isVaultMode,
    toggleVaultMode,
    sidebarOpen,
    setSidebarOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    activeNotebook,
    setActiveNotebook,
    activeNoteId,
    setActiveNoteId,
    viewMode,
    setViewMode,
  } = useAppStore();

  const {
    notes,
    activeNote,
    createNote,
    updateNote,
    deleteNote,
  } = useNotes();

  const {
    vaultNotes,
    activeVaultNote,
    createVaultNote,
    updateVaultNote,
    deleteVaultNote,
  } = useVault();

  const currentNote = isVaultMode ? activeVaultNote : activeNote;

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeNoteId) return;
      const title = e.target.value;
      if (isVaultMode) {
        updateVaultNote(activeNoteId, { title });
      } else {
        updateNote(activeNoteId, { title });
      }
    },
    [activeNoteId, isVaultMode, updateNote, updateVaultNote],
  );

  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      if (!activeNoteId) return;
      if (isVaultMode) {
        updateVaultNote(activeNoteId, { markdown });
      } else {
        updateNote(activeNoteId, { markdown });
      }
    },
    [activeNoteId, isVaultMode, updateNote, updateVaultNote],
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (!activeNoteId) return;
      if (isVaultMode) {
        updateVaultNote(activeNoteId, { tags });
      } else {
        updateNote(activeNoteId, { tags });
      }
    },
    [activeNoteId, isVaultMode, updateNote, updateVaultNote],
  );

  const handleCreateNote = useCallback(() => {
    if (isVaultMode) {
      createVaultNote();
    } else {
      createNote();
    }
  }, [isVaultMode, createNote, createVaultNote]);

  const handleDeleteNote = useCallback(
    (id: string) => {
      if (isVaultMode) {
        deleteVaultNote(id);
      } else {
        deleteNote(id);
      }
    },
    [isVaultMode, deleteNote, deleteVaultNote],
  );

  const handleSelectFromSearch = useCallback(
    (id: string) => {
      setActiveNoteId(id);
    },
    [setActiveNoteId],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          notes={notes}
          vaultNotes={vaultNotes}
          activeNoteId={activeNoteId}
          isVaultMode={isVaultMode}
          activeNotebook={activeNotebook}
          onSelectNote={setActiveNoteId}
          onDeleteNote={handleDeleteNote}
          onCreateNote={handleCreateNote}
          onToggleVault={toggleVaultMode}
          onSetNotebook={setActiveNotebook}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={currentNote?.title || ""}
          isVaultMode={isVaultMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
        />

        {currentNote ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Editor area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Title input */}
              <div className="px-6 pt-4 pb-2">
                <input
                  value={currentNote.title}
                  onChange={handleTitleChange}
                  placeholder="Note title"
                  className="w-full bg-transparent text-2xl font-bold text-slate-100 outline-none placeholder:text-slate-600"
                />
              </div>

              {/* Tags */}
              <div className="px-6 pb-3">
                <TagInput
                  tags={currentNote.tags || []}
                  onChange={handleTagsChange}
                />
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1 px-6 pb-2">
                <button
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === "edit"
                      ? "bg-slate-800 text-slate-200"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Edit3 size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === "preview"
                      ? "bg-slate-800 text-slate-200"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Eye size={12} />
                  Preview
                </button>
              </div>

              {/* Editor / Preview */}
              <div className="flex-1 overflow-hidden">
                {viewMode === "edit" ? (
                  <MarkdownEditor
                    key={activeNoteId}
                    value={currentNote.markdown || ""}
                    onChange={handleMarkdownChange}
                  />
                ) : (
                  <MarkdownPreview content={currentNote.markdown || ""} />
                )}
              </div>
            </div>

            {/* Related notes panel (not in vault mode) */}
            {!isVaultMode && (
              <div className="w-64 border-l border-slate-800 hidden lg:block">
                <RelatedNotes
                  noteId={activeNoteId}
                  onSelect={setActiveNoteId}
                />
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">
                {isVaultMode ? "\uD83D\uDD12" : "\uD83D\uDCDD"}
              </div>
              <h2 className="text-lg font-medium text-slate-400 mb-2">
                {isVaultMode ? "Vault Mode" : "No note selected"}
              </h2>
              <p className="text-sm text-slate-500">
                Select a note or create a new one to get started
              </p>
              <button
                onClick={handleCreateNote}
                className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm transition-colors"
              >
                Create Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectNote={handleSelectFromSearch}
      />
    </div>
  );
}
