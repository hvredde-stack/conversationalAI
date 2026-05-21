export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Assistant is typing">
      <span
        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce-dot"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce-dot"
        style={{ animationDelay: "0.16s" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce-dot"
        style={{ animationDelay: "0.32s" }}
      />
    </div>
  );
}
