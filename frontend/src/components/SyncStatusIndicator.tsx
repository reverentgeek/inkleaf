import { useCallback } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";

// Header pill showing Atlas connectivity + pending offline changes.
// Click forces an immediate sync.
export default function SyncStatusIndicator() {
  const status = useAppStore((s) => s.syncStatus);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);

  const handleClick = useCallback(() => {
    api.sync
      .now()
      .then(setSyncStatus)
      .catch(() => {});
  }, [setSyncStatus]);

  if (!status) return null;

  const pending = status.pendingPush;
  const title = status.syncing
    ? "Syncing with MongoDB Atlas..."
    : status.online
      ? `Synced with Atlas${
          status.lastSyncAt
            ? ` — last sync ${new Date(status.lastSyncAt).toLocaleTimeString()}`
            : ""
        }`
      : `Offline — ${
          pending === 0
            ? "changes will sync when reconnected"
            : `${pending} change${pending === 1 ? "" : "s"} pending`
        }`;

  return (
    <button
      onClick={handleClick}
      title={`${title} (click to sync now)`}
      className={`relative flex items-center gap-1.5 p-1.5 rounded hover:bg-ink-bg-secondary transition-colors ${
        status.online
          ? "text-ink-text-muted hover:text-ink-text-tertiary"
          : "text-amber-500"
      }`}
    >
      {status.syncing ? (
        <RefreshCw size={16} className="animate-spin" />
      ) : status.online ? (
        <Cloud size={16} />
      ) : (
        <CloudOff size={16} />
      )}
      {pending > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-semibold flex items-center justify-center">
          {pending > 99 ? "99+" : pending}
        </span>
      )}
    </button>
  );
}
