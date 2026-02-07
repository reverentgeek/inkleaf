import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 focus-within:border-indigo-500/50">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="hover:text-indigo-100"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addTag(input)}
        placeholder={tags.length === 0 ? "Add tags..." : ""}
        className="flex-1 min-w-[60px] bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
      />
    </div>
  );
}
