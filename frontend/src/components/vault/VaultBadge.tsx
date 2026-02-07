import { Shield } from "lucide-react";

export default function VaultBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
      <Shield size={10} />
      Encrypted
    </span>
  );
}
