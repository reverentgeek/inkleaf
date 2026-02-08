import { useState, useEffect, useCallback, useRef } from "react";
import { Command } from "cmdk";
import { Search, Sparkles, FileText } from "lucide-react";
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
  const mode = useAppStore((s) => s.commandPaletteMode);
  const setMode = useAppStore((s) => s.setCommandPaletteMode);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const {
    searchResults,
    semanticResults,
    autocompleteResults,
    isSearching,
    search,
    autocomplete,
    semanticSearch,
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

    debounceRef.current = setTimeout(() => {
      if (mode === "text") {
        search(query);
        autocomplete(query);
      } else {
        semanticSearch(query);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, search, autocomplete, semanticSearch, clearResults]);

  if (!open) return null;

  const results = mode === "text" ? searchResults : semanticResults;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <Command
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        shouldFilter={false}
      >
        {/* Mode tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              mode === "text"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Search size={14} />
            Text Search
          </button>
          <button
            onClick={() => setMode("semantic")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              mode === "semantic"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Sparkles size={14} />
            Semantic Search
          </button>
        </div>

        {/* Search input */}
        <div className="flex items-center px-4 border-b border-slate-800">
          <Search size={16} className="text-slate-500" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={
              mode === "text"
                ? "Search notes..."
                : "Describe what you're looking for..."
            }
            className="flex-1 px-3 py-3 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Autocomplete suggestions (text mode) */}
        {mode === "text" && autocompleteResults.length > 0 && (
          <div className="px-2 py-1 border-b border-slate-800">
            <div className="flex flex-wrap gap-1">
              {autocompleteResults.map((r) => (
                <button
                  key={r._id}
                  onClick={() => handleSelect(r._id)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
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
          {query && !isSearching && results.length === 0 && (
            <Command.Empty className="p-4 text-sm text-slate-500 text-center">
              No results found
            </Command.Empty>
          )}
          <SearchResults
            results={results}
            onSelect={handleSelect}
            mode={mode}
          />
        </Command.List>
      </Command>
    </div>
  );
}
