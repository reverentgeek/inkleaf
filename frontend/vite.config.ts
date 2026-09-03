import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  // CodeMirror breaks with an "Unrecognized extension value" error if two
  // copies of @codemirror/state (or /view) end up in the graph — its
  // instanceof checks fail across module instances. A dependency bump that
  // leaves direct and transitive deps on different patch versions is enough
  // to trigger it, so force a single instance of each.
  resolve: {
    dedupe: ["@codemirror/state", "@codemirror/view"],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
