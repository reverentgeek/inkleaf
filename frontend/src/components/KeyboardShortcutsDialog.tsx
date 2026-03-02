import { useEffect } from "react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "\u2318" : "Ctrl+";
const shift = isMac ? "\u21E7" : "Shift+";

const shortcuts = [
  { keys: `${mod}K`, description: "Search (text)" },
  { keys: `${mod}${shift}K`, description: "Search (semantic)" },
  { keys: `${mod}E`, description: "Edit mode" },
  { keys: `${mod}${shift}E`, description: "Preview mode" },
  { keys: `${mod}${shift}V`, description: "Toggle vault" },
  { keys: `${mod}${shift}T`, description: "Toggle theme" },
  { keys: `${mod}${shift}F`, description: "Format markdown" },
  { keys: `${mod}/`, description: "Keyboard shortcuts" },
  { keys: "Esc", description: "Close dialog / palette" },
];

export default function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-ink-bg-primary border border-ink-border-strong rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-ink-text-primary">
          Keyboard Shortcuts
        </h3>
        <div className="mt-4 space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm text-ink-text-muted">
                {s.description}
              </span>
              <kbd className="text-xs text-ink-text-faint bg-ink-bg-secondary px-2 py-1 rounded font-mono">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
