import { Tag } from "lucide-react";

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
}

export default function TagFilter({
  allTags,
  selectedTags,
  onToggle,
}: TagFilterProps) {
  if (allTags.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Tag size={12} className="text-ink-text-faint" />
        <span className="text-xs text-ink-text-faint uppercase tracking-wider">
          Tags
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              selectedTags.includes(tag)
                ? "bg-ink-accent/30 text-ink-accent-lighter"
                : "bg-ink-bg-secondary text-ink-text-faint hover:text-ink-text-tertiary"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
