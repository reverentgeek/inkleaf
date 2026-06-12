import { useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useAppStore } from "../stores/appStore";

const POLL_INTERVAL_MS = 5000;

// Polls the backend's sync status and publishes it to the store.
// Instantiate once (in Layout) — everything else reads s.syncStatus.
export function useSyncStatus() {
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);

  const refresh = useCallback(async () => {
    try {
      setSyncStatus(await api.sync.status());
    } catch {
      // Backend unreachable (shouldn't happen — it runs locally), but
      // degrade gracefully rather than showing stale "online" state.
      setSyncStatus({
        online: false,
        syncing: false,
        lastSyncAt: null,
        lastError: "Backend unreachable",
        pendingPush: 0,
        pendingEmbeddings: 0,
        revision: 0,
      });
    }
  }, [setSyncStatus]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { refresh };
}
