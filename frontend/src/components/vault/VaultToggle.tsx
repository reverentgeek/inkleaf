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
          ? "bg-ink-vault/15 text-ink-vault-light border border-ink-vault/30"
          : "text-ink-text-muted hover:text-ink-text-tertiary hover:bg-ink-bg-secondary"
      }`}
      title="Toggle Vault Mode (Cmd+Shift+V)"
    >
      {isActive ? <Lock size={14} /> : <Unlock size={14} />}
      <span>{isActive ? "Vault Mode" : "Open Vault"}</span>
    </button>
  );
}
