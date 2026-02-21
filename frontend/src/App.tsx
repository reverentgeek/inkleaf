import { useEffect } from "react";
import Layout from "./components/layout/Layout";
import { useAppStore } from "./stores/appStore";

export default function App() {
  const { setCommandPaletteOpen, openCommandPalette, toggleVaultMode, setViewMode, theme, toggleTheme } = useAppStore();

  // Sync theme class to <html>
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K / Cmd+Shift+K: Open command palette
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette(e.shiftKey ? "semantic" : "text");
        return;
      }

      // Cmd+E / Cmd+Shift+E: Switch edit/preview mode
      if (isMod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setViewMode(e.shiftKey ? "preview" : "edit");
        return;
      }

      // Cmd+Shift+V: Toggle vault mode
      if (isMod && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        toggleVaultMode();
        return;
      }

      // Cmd+Shift+T: Toggle theme
      if (isMod && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Escape: Close command palette
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen, openCommandPalette, toggleVaultMode, setViewMode, toggleTheme]);

  return <Layout />;
}
