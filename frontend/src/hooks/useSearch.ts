import { useState, useCallback } from "react";
import { api } from "../api/client";
import type { SearchResult, AutocompleteResult } from "../api/client";

// One result set. The backend decides how the query is answered — hybrid
// ($rankFusion over Atlas Search + Vector Search), text-only Atlas Search, or
// local FTS5 when offline — and all three share this shape.
export function useSearch() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string, tags?: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.search.query(query, tags);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const autocomplete = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAutocompleteResults([]);
      return;
    }
    try {
      const results = await api.search.autocomplete(query);
      setAutocompleteResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Autocomplete failed:", err);
      setAutocompleteResults([]);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setAutocompleteResults([]);
  }, []);

  return {
    searchResults,
    autocompleteResults,
    isSearching,
    search,
    autocomplete,
    clearResults,
  };
}
