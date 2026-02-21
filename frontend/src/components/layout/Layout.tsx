import { useCallback, useRef, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MarkdownEditor from "../editor/MarkdownEditor";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import MarkdownPreview from "../editor/MarkdownPreview";
import TagInput from "../tags/TagInput";
import RelatedNotes from "../notes/RelatedNotes";
import CommandPalette from "../search/CommandPalette";
import { useNotes } from "../../hooks/useNotes";
import { useVault } from "../../hooks/useVault";
import { useAppStore } from "../../stores/appStore";
import type { Note } from "../../api/client";
import { Eye, Edit3, WrapText } from "lucide-react";
import InkleafLogo from "../InkleafLogo";

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

  const editorRef = useRef<MarkdownEditorHandle>(null);

  const handleFormat = useCallback(() => {
    editorRef.current?.format();
  }, []);

  // Cmd+Shift+F: Format markdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFormat]);

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
    <div className="flex h-screen overflow-hidden bg-ink-bg-primary">
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
                  className="w-full bg-transparent text-2xl font-bold text-ink-text-primary outline-none placeholder:text-ink-text-placeholder"
                />
              </div>

              {/* Tags */}
              <div className="px-6 pb-3">
                <TagInput
                  tags={currentNote.tags || []}
                  onChange={handleTagsChange}
                />
              </div>

              {/* View mode toggle + format */}
              <div className="flex items-center gap-1 px-6 pb-2">
                <button
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === "edit"
                      ? "bg-ink-bg-secondary text-ink-text-secondary"
                      : "text-ink-text-faint hover:text-ink-text-tertiary"
                  }`}
                >
                  <Edit3 size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    viewMode === "preview"
                      ? "bg-ink-bg-secondary text-ink-text-secondary"
                      : "text-ink-text-faint hover:text-ink-text-tertiary"
                  }`}
                >
                  <Eye size={12} />
                  Preview
                </button>
                {viewMode === "edit" && (
                  <>
                    <div className="w-px h-4 bg-ink-border-strong mx-1" />
                    <button
                      onClick={handleFormat}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-ink-text-faint hover:text-ink-text-tertiary hover:bg-ink-bg-secondary transition-colors"
                      title="Format (Cmd+Shift+F)"
                    >
                      <WrapText size={12} />
                      Format
                    </button>
                  </>
                )}
              </div>

              {/* Editor / Preview */}
              <div className="flex-1 overflow-hidden">
                {viewMode === "edit" ? (
                  <MarkdownEditor
                    ref={editorRef}
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
              <div className="w-64 border-l border-ink-border hidden lg:block">
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
              <div className="mb-4 flex justify-center">
                {isVaultMode ? <span className="text-6xl">{"\uD83D\uDD12"}</span> : <InkleafLogo size={64} />}
              </div>
              <h2 className="text-lg font-medium text-ink-text-muted mb-2">
                {isVaultMode ? "Vault Mode" : "No note selected"}
              </h2>
              <p className="text-sm text-ink-text-faint">
                Select a note or create a new one to get started
              </p>
              <button
                onClick={handleCreateNote}
                className="mt-4 px-4 py-2 rounded-lg bg-ink-accent hover:bg-ink-accent-hover text-white text-sm transition-colors"
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
