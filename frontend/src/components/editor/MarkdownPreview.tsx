import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { invoke } from "@tauri-apps/api/core";
import "highlight.js/styles/github.css";
import "./markdown-preview.css";

interface MarkdownPreviewProps {
  content: string;
}

function ExternalLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!props.href) return;

    try {
      await invoke("open_external", { url: props.href });
    } catch {
      window.open(props.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <a {...props} onClick={handleClick} rel="noopener noreferrer" />
  );
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview overflow-y-auto h-full p-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ a: ExternalLink }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
