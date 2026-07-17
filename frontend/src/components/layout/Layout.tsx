import { useCallback, useRef, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MarkdownEditor from "../editor/MarkdownEditor";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import MarkdownPreview from "../editor/MarkdownPreview";
import TagInput from "../tags/TagInput";
import RelatedNotes from "../notes/RelatedNotes";
import CommandPalette from "../search/CommandPalette";
import Toast from "../Toast";
import { useNotes } from "../../hooks/useNotes";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { useAppStore } from "../../stores/appStore";
import { Eye, Edit3, WrapText, RotateCcw, Trash2 } from "lucide-react";
import InkleafLogo from "../InkleafLogo";
import ConfirmDialog from "../ConfirmDialog";

export default function Layout() {
  const {
    sidebarOpen,
    setSidebarOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    activeTag,
    setActiveTag,
    expandedTagPaths,
    toggleTagExpanded,
    tagsSectionOpen,
    toggleTagsSection,
    activeNoteId,
    setActiveNoteId,
    viewMode,
    setViewMode,
    sidebarView,
    setSidebarView,
  } = useAppStore();

  const {
    notes,
    trashNotes,
    filteredNotes,
    activeNote,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    emptyTrash,
  } = useNotes();

  // Single poller for Atlas connectivity — everything reads s.syncStatus.
  useSyncStatus();

  const editorRef = useRef<MarkdownEditorHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const focusTitleOnNextNoteRef = useRef(false);

  const handleFormat = useCallback(() => {
    editorRef.current?.format();
  }, []);

  const handleCreateNote = useCallback(() => {
    focusTitleOnNextNoteRef.current = true;
    createNote();
  }, [createNote]);

  // Cmd+Shift+F: Format markdown; Cmd+N: New note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        handleFormat();
      }
      if (isMod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFormat, handleCreateNote]);

  // A restored activeNoteId may point at a note permanently deleted elsewhere —
  // clear it once loaded, but keep it if it lives in the trash (previewable).
  useEffect(() => {
    if (
      notes.length > 0 &&
      activeNoteId &&
      !notes.some((n) => n._id === activeNoteId) &&
      !trashNotes.some((n) => n._id === activeNoteId)
    ) {
      setActiveNoteId(null);
    }
  }, [notes, trashNotes, activeNoteId, setActiveNoteId]);

  // Focus the title after creating a note so typing replaces "Untitled".
  useEffect(() => {
    if (focusTitleOnNextNoteRef.current && activeNoteId) {
      focusTitleOnNextNoteRef.current = false;
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [activeNoteId]);

  const currentNote = activeNote;

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeNoteId) return;
      updateNote(activeNoteId, { title: e.target.value });
    },
    [activeNoteId, updateNote],
  );

  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      if (!activeNoteId) return;
      updateNote(activeNoteId, { markdown });
    },
    [activeNoteId, updateNote],
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (!activeNoteId) return;
      updateNote(activeNoteId, { tags });
    },
    [activeNoteId, updateNote],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote(id);
    },
    [deleteNote],
  );

  const handleSelectFromSearch = useCallback(
    (id: string) => {
      setActiveNoteId(id);
    },
    [setActiveNoteId],
  );

  const handleRestoreActive = useCallback(
    (id: string) => {
      restoreNote(id);
      setSidebarView("notes"); // keep it selected; it's now editable again
    },
    [restoreNote, setSidebarView],
  );

  const handlePurgeActive = useCallback(
    (id: string) => {
      permanentDeleteNote(id);
      setActiveNoteId(null);
    },
    [permanentDeleteNote, setActiveNoteId],
  );

  const isTrashed = !!currentNote?.deletedAt;
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const handleEmptyTrash = useCallback(() => {
    emptyTrash();
    if (isTrashed) setActiveNoteId(null);
  }, [emptyTrash, isTrashed, setActiveNoteId]);

  return (
    <div className="flex h-screen overflow-hidden bg-ink-bg-primary">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          notes={notes}
          filteredNotes={filteredNotes}
          trashNotes={trashNotes}
          sidebarView={sidebarView}
          onSetView={setSidebarView}
          activeNoteId={activeNoteId}
          activeTag={activeTag}
          expandedTagPaths={expandedTagPaths}
          onSelectNote={setActiveNoteId}
          onDeleteNote={handleDeleteNote}
          onRestoreNote={restoreNote}
          onPurgeNote={permanentDeleteNote}
          onEmptyTrash={handleEmptyTrash}
          onCreateNote={handleCreateNote}
          onSelectTag={setActiveTag}
          onToggleTagExpanded={toggleTagExpanded}
          tagsSectionOpen={tagsSectionOpen}
          onToggleTagsSection={toggleTagsSection}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={currentNote?.title || ""}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSearch={() => setCommandPaletteOpen(true)}
        />

        {currentNote && isTrashed ? (
          /* Trashed note: read-only preview with restore / delete-forever */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-2.5 border-b border-ink-border bg-ink-bg-secondary/40">
              <Trash2 size={14} className="shrink-0 text-ink-text-faint" />
              <span className="text-xs text-ink-text-muted">
                In Trash
                {currentNote.deletedAt &&
                  ` — deleted ${new Date(currentNote.deletedAt).toLocaleString()}`}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => handleRestoreActive(currentNote._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-text-secondary hover:bg-ink-bg-secondary transition-colors"
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
                <button
                  onClick={() => setShowPurgeConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-ink-danger hover:bg-ink-danger-hover text-white transition-colors"
                >
                  <Trash2 size={13} />
                  Delete forever
                </button>
              </div>
            </div>
            <div className="px-6 pt-4 pb-2">
              <h1 className="text-2xl font-bold text-ink-text-primary">
                {currentNote.title || "Untitled"}
              </h1>
            </div>
            {currentNote.tags && currentNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-6 pb-3">
                {currentNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-ink-bg-secondary text-[11px] text-ink-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <MarkdownPreview content={currentNote.markdown || ""} />
            </div>
          </div>
        ) : currentNote ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Editor area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Title input */}
              <div className="px-6 pt-4 pb-2">
                <input
                  ref={titleInputRef}
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

            {/* Related notes panel */}
            <div className="w-64 border-l border-ink-border hidden lg:block">
              <RelatedNotes
                noteId={activeNoteId}
                onSelect={setActiveNoteId}
              />
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <InkleafLogo size={64} />
              </div>
              <h2 className="text-lg font-medium text-ink-text-muted mb-2">
                No note selected
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

      {/* Undo / status toast */}
      <Toast />

      <ConfirmDialog
        open={showPurgeConfirm}
        title="Delete forever"
        message={`Permanently delete "${currentNote?.title || "Untitled"}"? This cannot be undone.`}
        confirmLabel="Delete forever"
        onConfirm={() => {
          setShowPurgeConfirm(false);
          if (currentNote) handlePurgeActive(currentNote._id);
        }}
        onCancel={() => setShowPurgeConfirm(false)}
      />
    </div>
  );
}
