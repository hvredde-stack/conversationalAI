import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content: string;
  /** Render only the avatar (used to anchor the typing indicator). */
  asPlaceholder?: boolean;
  children?: React.ReactNode;
}

function AriaAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-full bg-navy-800 shadow-soft ring-1 ring-gold-400/40"
      style={{ width: size, height: size }}
    >
      <span className="font-display font-bold text-gold-400" style={{ fontSize: size * 0.42 }}>
        A
      </span>
    </div>
  );
}

export function MessageBubble({ role, content, asPlaceholder, children }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-navy-100 text-navy-600">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <AriaAvatar size={36} />
        )}
      </div>

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {!isUser && !asPlaceholder && (
          <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
            Aria
          </div>
        )}
        <div
          className={[
            "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-soft",
            isUser
              ? "bg-navy-800 text-white rounded-tr-md"
              : "bg-white text-navy-800 border border-navy-100 rounded-tl-md",
          ].join(" ")}
        >
          {asPlaceholder ? (
            children
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
