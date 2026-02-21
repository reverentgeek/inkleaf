import { useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import * as prettier from "prettier/standalone";
import * as markdownPlugin from "prettier/plugins/markdown";
import { useAppStore } from "../../stores/appStore";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export interface MarkdownEditorHandle {
  format: () => void;
}

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
  },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    padding: "16px",
  },
  ".cm-content": {
    caretColor: "var(--ink-accent-light)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange }, ref) {
    const storeTheme = useAppStore((s) => s.theme);
    // Capture value at mount only. The component remounts via key={noteId}
    // when switching notes, so this always starts with the correct content.
    // Within a note session, the editor is the source of truth — parent
    // re-renders with stale saved values won't reset the editor.
    const [initialValue] = useState(value);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const isFormatting = useRef(false);

    const formatContent = useCallback(async () => {
      const view = editorRef.current?.view;
      if (!view) return;

      const oldText = view.state.doc.toString();
      if (!oldText.trim()) return;

      let formatted: string;
      try {
        formatted = await prettier.format(oldText, {
          parser: "markdown",
          plugins: [markdownPlugin],
          proseWrap: "preserve",
          tabWidth: 2,
        });
      } catch {
        return;
      }

      // Remove trailing newline prettier adds
      formatted = formatted.replace(/\n$/, "");

      if (formatted === oldText) return;

      // If the user typed while prettier was running, discard the result
      if (view.state.doc.toString() !== oldText) return;

      // Save cursor line/column so we can restore after formatting.
      // Line/column survives table reformatting (prettier pads cells but
      // doesn't add/remove rows), unlike a raw character offset.
      const cursor = view.state.selection.main.head;
      const cursorLine = view.state.doc.lineAt(cursor);
      const lineNum = cursorLine.number; // 1-based
      const col = cursor - cursorLine.from;

      // Compute minimal change region
      let prefixLen = 0;
      const minLen = Math.min(oldText.length, formatted.length);
      while (prefixLen < minLen && oldText[prefixLen] === formatted[prefixLen]) {
        prefixLen++;
      }

      let oldSuffix = 0;
      let newSuffix = 0;
      while (
        oldSuffix < oldText.length - prefixLen &&
        newSuffix < formatted.length - prefixLen &&
        oldText[oldText.length - 1 - oldSuffix] ===
          formatted[formatted.length - 1 - newSuffix]
      ) {
        oldSuffix++;
        newSuffix++;
      }

      const from = prefixLen;
      const to = oldText.length - oldSuffix;
      const insert = formatted.slice(prefixLen, formatted.length - newSuffix);

      // Map cursor to the same line/column in the formatted text
      const formattedLines = formatted.split("\n");
      const targetLineIdx = Math.min(lineNum - 1, formattedLines.length - 1);
      let newCursor = 0;
      for (let i = 0; i < targetLineIdx; i++) {
        newCursor += formattedLines[i].length + 1;
      }
      newCursor += Math.min(col, formattedLines[targetLineIdx].length);

      isFormatting.current = true;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: newCursor },
      });
      isFormatting.current = false;

      // Sync formatted content to parent so it persists to MongoDB
      onChange(formatted);
    }, [onChange]);

    useImperativeHandle(ref, () => ({ format: formatContent }), [formatContent]);

    const handleChange = useCallback(
      (val: string) => {
        if (isFormatting.current) return;

        // Save debounce (500ms)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          onChange(val);
        }, 500);
      },
      [onChange],
    );

    useEffect(() => {
      return () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
    }, []);

    return (
      <CodeMirror
        ref={editorRef}
        value={initialValue}
        onChange={handleChange}
        extensions={[markdown(), baseTheme, EditorView.lineWrapping]}
        theme={storeTheme === "dark" ? oneDark : "light"}
        className="h-full"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
        }}
      />
    );
  },
);

export default MarkdownEditor;
