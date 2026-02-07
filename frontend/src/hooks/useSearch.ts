import { useState, useCallback } from "react";
import { api } from "../api/client";
import type { SearchResult, SemanticResult, AutocompleteResult } from "../api/client";

export function useSearch() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
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

  const semanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSemanticResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.semantic.search(query);
      setSemanticResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Semantic search failed:", err);
      setSemanticResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setSemanticResults([]);
    setAutocompleteResults([]);
  }, []);

  return {
    searchResults,
    semanticResults,
    autocompleteResults,
    isSearching,
    search,
    autocomplete,
    semanticSearch,
    clearResults,
  };
}
