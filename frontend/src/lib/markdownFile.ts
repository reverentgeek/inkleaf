import yaml from "js-yaml";
import type { Note } from "../api/client";

export interface ParsedMarkdown {
  title: string;
  markdown: string;
  tags: string[];
}

// Matches a leading YAML frontmatter block delimited by `---` fences,
// tolerating an optional BOM and CRLF line endings.
const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

// First ATX H1 (`# Title`), allowing up to 3 leading spaces and an optional
// closing `#` sequence. H2+ (`## ...`) deliberately does not match.
const H1_RE = /^[ \t]{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/m;

/**
 * Parse the contents of an imported `.md` file into a note.
 *
 * Title resolution, in order: YAML frontmatter `title` → first H1 heading →
 * the file name without its extension.
 */
export function parseMarkdownFile(content: string, fileName: string): ParsedMarkdown {
  let body = content;
  let data: Record<string, unknown> = {};

  const match = content.match(FRONTMATTER_RE);
  if (match) {
    try {
      const loaded = yaml.load(match[1]);
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        data = loaded as Record<string, unknown>;
        body = content.slice(match[0].length);
      }
    } catch {
      // Malformed frontmatter: fall back to treating the whole file as body.
    }
  }

  return {
    title: resolveTitle(data.title, body, fileName),
    markdown: body.replace(/^(?:\r?\n)+/, ""),
    tags: normalizeTags(data.tags),
  };
}

function resolveTitle(fmTitle: unknown, body: string, fileName: string): string {
  if (typeof fmTitle === "string" && fmTitle.trim()) return fmTitle.trim();

  const h1 = body.match(H1_RE);
  if (h1 && h1[1].trim()) return h1[1].trim();

  return stripExtension(fileName) || "Untitled";
}

function stripExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.(md|markdown|mdown|mkd|txt)$/i, "").trim();
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Serialize a note to a `.md` document with YAML frontmatter. The frontmatter
 * round-trips `title` and `tags`; `createdAt`/`updatedAt` are included for
 * reference but are not consumed on import (an imported note is always new).
 */
export function serializeNoteToMarkdown(note: Note): string {
  const frontmatter = {
    title: note.title,
    tags: note.tags ?? [],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  const yamlBlock = yaml.dump(frontmatter, { lineWidth: -1, sortKeys: false }).trimEnd();
  const body = note.markdown.replace(/^(?:\r?\n)+/, "");
  return `---\n${yamlBlock}\n---\n\n${body}\n`;
}

/** A filesystem-safe default file name derived from the note title. */
export function noteToFileName(note: Note): string {
  const slug = (note.title || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${slug || "untitled"}.md`;
}
