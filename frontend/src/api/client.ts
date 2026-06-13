const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001") + "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export interface Note {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  notebookId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHighlight {
  path: string;
  texts: Array<{ value: string; type: "hit" | "text" }>;
}

export interface SearchResult {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  score: number;
  highlights: SearchHighlight[];
}

export interface SemanticResult {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  score: number;
}

export interface AutocompleteResult {
  _id: string;
  title: string;
}

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingPush: number;
  pendingEmbeddings: number;
  // Bumped when a background pull applies remote changes locally —
  // watched by useNotes to refetch.
  revision: number;
}

// Notes CRUD
export const api = {
  notes: {
    list: (notebookId?: string) =>
      request<Note[]>(
        `/notes${notebookId ? `?notebookId=${encodeURIComponent(notebookId)}` : ""}`,
      ),
    get: (id: string) => request<Note>(`/notes/${id}`),
    create: (data: Partial<Note>) =>
      request<Note>("/notes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Note>) =>
      request<Note>(`/notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" }),
  },

  search: {
    query: (q: string, tags?: string) =>
      request<SearchResult[]>(
        `/search?q=${encodeURIComponent(q)}${tags ? `&tags=${encodeURIComponent(tags)}` : ""}`,
      ),
    autocomplete: (q: string) =>
      request<AutocompleteResult[]>(
        `/search/autocomplete?q=${encodeURIComponent(q)}`,
      ),
  },

  semantic: {
    search: (q: string) =>
      request<SemanticResult[]>(
        `/semantic/search?q=${encodeURIComponent(q)}`,
      ),
    related: (noteId: string) =>
      request<SemanticResult[]>(`/semantic/related/${noteId}`),
  },

  sync: {
    status: () => request<SyncStatus>("/sync"),
    now: () => request<SyncStatus>("/sync/now", { method: "POST" }),
  },
};
