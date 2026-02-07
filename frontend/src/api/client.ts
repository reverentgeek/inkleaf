const API_BASE = "http://localhost:3001/api";

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

export interface VaultNote {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
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

  vault: {
    list: () => request<VaultNote[]>("/vault"),
    get: (id: string) => request<VaultNote>(`/vault/${id}`),
    create: (data: Partial<VaultNote>) =>
      request<VaultNote>("/vault", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<VaultNote>) =>
      request<VaultNote>(`/vault/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/vault/${id}`, { method: "DELETE" }),
    raw: (id: string) => request<Record<string, unknown>>(`/vault/${id}/raw`),
  },
};
