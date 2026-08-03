import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import { Search, FileText, CloudOff } from "lucide-react";
import { useSearch } from "../../hooks/useSearch";
import { useAppStore } from "../../stores/appStore";
import SearchResults from "./SearchResults";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectNote: (id: string) => void;
}

export default function CommandPalette({
  open,
  onClose,
  onSelectNote,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const isOnline = useAppStore((s) => s.syncStatus?.online ?? true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const {
    searchResults,
    autocompleteResults,
    isSearching,
    search,
    autocomplete,
    clearResults,
  } = useSearch();

  const handleSelect = useCallback(
    (id: string) => {
      onSelectNote(id);
      onClose();
    },
    [onSelectNote, onClose],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      clearResults();
    }
  }, [open, clearResults]);

  useEffect(() => {
    if (!query.trim()) {
      clearResults();
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // One request either way — the backend fuses keyword and semantic results
    // when it can and degrades to text-only or local FTS5 when it can't.
    debounceRef.current = setTimeout(() => {
      search(query);
      autocomplete(query);
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search, autocomplete, clearResults]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <Command
        className="relative w-full max-w-xl bg-ink-bg-primary border border-ink-border-strong rounded-xl shadow-2xl overflow-hidden"
        shouldFilter={false}
      >
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-ink-border">
          <Search size={16} className="text-ink-text-faint" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search notes, or describe what you're looking for..."
            className="flex-1 px-3 py-3 bg-transparent text-sm text-ink-text-secondary outline-none placeholder:text-ink-text-placeholder"
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-ink-accent-light border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Offline hint — no vector half without a connection, keyword only */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-ink-border text-xs text-amber-500">
            <CloudOff size={12} />
            Offline — searching locally, keyword matches only
          </div>
        )}

        {/* Autocomplete suggestions */}
        {autocompleteResults.length > 0 && (
          <div className="px-2 py-1 border-b border-ink-border">
            <div className="flex flex-wrap gap-1">
              {autocompleteResults.map((r) => (
                <button
                  key={r._id}
                  onClick={() => handleSelect(r._id)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-ink-bg-secondary text-ink-text-muted hover:text-ink-text-secondary hover:bg-ink-bg-elevated transition-colors"
                >
                  <FileText size={10} />
                  {r.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <Command.List className="max-h-80 overflow-y-auto p-2">
          {query && !isSearching && searchResults.length === 0 && (
            <Command.Empty className="p-4 text-sm text-ink-text-faint text-center">
              No results found
            </Command.Empty>
          )}
          <SearchResults results={searchResults} onSelect={handleSelect} />
        </Command.List>
      </Command>
    </div>
  );
}
