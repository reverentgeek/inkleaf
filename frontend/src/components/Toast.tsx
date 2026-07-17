import { useEffect } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../stores/appStore";

const AUTO_DISMISS_MS = 6000;

// Single transient toast anchored bottom-center. Used for the undo prompt after
// moving a note to the trash; auto-dismisses after a few seconds.
export default function Toast() {
  const toast = useAppStore((s) => s.toast);
  const dismissToast = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 rounded-lg border border-ink-border-strong bg-ink-bg-primary px-4 py-2.5 shadow-2xl">
        <span className="text-sm text-ink-text-secondary">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => {
              toast.onAction?.();
              dismissToast();
            }}
            className="text-sm font-medium text-ink-accent-lighter hover:underline"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          onClick={dismissToast}
          className="p-0.5 rounded text-ink-text-faint hover:text-ink-text-secondary transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
