import { ObjectId, Binary } from "mongodb";

export interface Note {
  _id?: ObjectId;
  title: string;
  markdown: string;
  tags: string[];
  notebookId: string;
  createdAt: Date;
  updatedAt: Date;
  embedding?: number[];
}

export interface VaultNote {
  _id?: ObjectId;
  title: string;
  markdown: string | Binary;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Wire shape of a note as the frontend consumes it (string _id, ISO dates).
// SQLite-backed responses use this directly; Mongo docs serialize identically.
export interface NoteDTO {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  notebookId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingPush: number;
  pendingEmbeddings: number;
  revision: number;
}

export interface SearchResult {
  _id: ObjectId | string;
  title: string;
  markdown: string;
  tags: string[];
  score: number;
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  path: string;
  texts: Array<{ value: string; type: "hit" | "text" }>;
}

export interface SemanticResult {
  _id: ObjectId;
  title: string;
  markdown: string;
  tags: string[];
  score: number;
}

export interface AutocompleteResult {
  _id: ObjectId | string;
  title: string;
}
