import { Lock, Unlock } from "lucide-react";

interface VaultToggleProps {
  isActive: boolean;
  onToggle: () => void;
}

export default function VaultToggle({ isActive, onToggle }: VaultToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"
      }`}
      title="Toggle Vault Mode (Cmd+Shift+V)"
    >
      {isActive ? <Lock size={14} /> : <Unlock size={14} />}
      <span>{isActive ? "Vault Mode" : "Open Vault"}</span>
    </button>
  );
}
