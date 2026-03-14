import { useMemo } from "react";
import { ChevronRight, ChevronDown, Tag, Hash } from "lucide-react";
import type { Note } from "../../api/client";

interface TagNode {
  name: string;
  fullPath: string;
  children: TagNode[];
  noteCount: number;
}

function buildTree(notes: Note[]): TagNode[] {
  const tagCounts = new Map<string, number>();

  for (const note of notes) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const root: TagNode[] = [];
  const nodeMap = new Map<string, TagNode>();

  // Sort tags so parents are created before children
  const allTags = [...tagCounts.keys()].sort();

  for (const tag of allTags) {
    const segments = tag.split("/");
    let currentPath = "";
    let parentChildren = root;

    for (let i = 0; i < segments.length; i++) {
      currentPath = i === 0 ? segments[i] : `${currentPath}/${segments[i]}`;
      let node = nodeMap.get(currentPath);

      if (!node) {
        node = {
          name: segments[i],
          fullPath: currentPath,
          children: [],
          noteCount: 0,
        };
        nodeMap.set(currentPath, node);
        parentChildren.push(node);
      }

      parentChildren = node.children;
    }
  }

  // Calculate counts: each node's count includes descendants
  function countNotes(node: TagNode): number {
    let count = tagCounts.get(node.fullPath) || 0;
    for (const child of node.children) {
      count += countNotes(child);
    }
    node.noteCount = count;
    return count;
  }

  for (const node of root) {
    countNotes(node);
  }

  return root;
}

interface TagTreeProps {
  notes: Note[];
  activeTag: string | null;
  expandedPaths: string[];
  onSelectTag: (tag: string | null) => void;
  onToggleExpand: (path: string) => void;
}

export default function TagTree({
  notes,
  activeTag,
  expandedPaths,
  onSelectTag,
  onToggleExpand,
}: TagTreeProps) {
  const tree = useMemo(() => buildTree(notes), [notes]);

  if (tree.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-ink-text-faint">
        No tags yet
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* All Notes */}
      <button
        onClick={() => onSelectTag(null)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
          activeTag === null
            ? "text-ink-accent-lighter bg-ink-accent/10"
            : "text-ink-text-muted hover:text-ink-text-secondary hover:bg-ink-bg-secondary"
        }`}
      >
        <Tag size={13} />
        <span>All Notes</span>
        <span className="ml-auto text-xs text-ink-text-faint">{notes.length}</span>
      </button>

      {/* Tag tree */}
      {tree.map((node) => (
        <TagNodeRow
          key={node.fullPath}
          node={node}
          depth={0}
          activeTag={activeTag}
          expandedPaths={expandedPaths}
          onSelectTag={onSelectTag}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}

interface TagNodeRowProps {
  node: TagNode;
  depth: number;
  activeTag: string | null;
  expandedPaths: string[];
  onSelectTag: (tag: string | null) => void;
  onToggleExpand: (path: string) => void;
}

function TagNodeRow({
  node,
  depth,
  activeTag,
  expandedPaths,
  onSelectTag,
  onToggleExpand,
}: TagNodeRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.includes(node.fullPath);
  const isActive = activeTag === node.fullPath;

  return (
    <>
      <div
        className={`flex items-center gap-1 py-1 pr-3 text-sm cursor-pointer transition-colors ${
          isActive
            ? "text-ink-accent-lighter bg-ink-accent/10"
            : "text-ink-text-muted hover:text-ink-text-secondary hover:bg-ink-bg-secondary"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.fullPath);
            }}
            className="p-0.5 rounded hover:bg-ink-bg-elevated shrink-0"
          >
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className="w-[20px] shrink-0 flex justify-center">
            <Hash size={11} className="text-ink-text-faint" />
          </span>
        )}

        {/* Tag name */}
        <button
          onClick={() => onSelectTag(node.fullPath)}
          className="flex-1 text-left truncate"
        >
          {node.name}
        </button>

        {/* Count */}
        <span className="text-xs text-ink-text-faint shrink-0">
          {node.noteCount}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        node.children.map((child) => (
          <TagNodeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            activeTag={activeTag}
            expandedPaths={expandedPaths}
            onSelectTag={onSelectTag}
            onToggleExpand={onToggleExpand}
          />
        ))
      )}
    </>
  );
}
