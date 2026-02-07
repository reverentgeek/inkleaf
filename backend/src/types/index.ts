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

export interface SearchResult {
  _id: ObjectId;
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
  _id: ObjectId;
  title: string;
}
