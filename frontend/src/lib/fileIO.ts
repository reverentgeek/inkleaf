import { isTauri } from "@tauri-apps/api/core";

export interface PickedFile {
  name: string;
  content: string;
}

const MARKDOWN_FILTER = { name: "Markdown", extensions: ["md", "markdown"] };

/**
 * Prompt the user to pick a Markdown file and return its contents.
 * Uses Tauri's native dialog + fs in the desktop app, and a hidden
 * `<input type="file">` in the browser (`pnpm dev`). Resolves to `null`
 * if the user cancels.
 */
export async function pickMarkdownFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({ multiple: false, filters: [MARKDOWN_FILTER] });
    if (typeof selected !== "string") return null;
    const content = await readTextFile(selected);
    const name = selected.split(/[\\/]/).pop() || "untitled.md";
    return { name, content };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, content: String(reader.result) });
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

/**
 * Save text to a Markdown file the user chooses. Uses Tauri's native save
 * dialog + fs in the desktop app, and a Blob download in the browser.
 * Resolves to `true` if a file was written, `false` if the user cancelled.
 */
export async function saveMarkdownFile(defaultName: string, content: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: defaultName, filters: [MARKDOWN_FILTER] });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
