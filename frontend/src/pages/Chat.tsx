import { useEffect, useRef, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { getIdTokenForWs, WS_BASE_URL } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function Chat() {
  const { profile, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getIdTokenForWs();
      if (cancelled) return;
      const ws = new WebSocket(`${WS_BASE_URL}/api/chat?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "ready") {
          setConnected(true);
        } else if (data.type === "token") {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + data.content };
            } else {
              copy.push({ role: "assistant", content: data.content });
            }
            return copy;
          });
        } else if (data.type === "done") {
          setStreaming(false);
        } else if (data.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `⚠️ ${data.message ?? data.code}` },
          ]);
          setStreaming(false);
        }
      };

      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [...prev, { role: "user", content }]);
    wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    setInput("");
    setStreaming(true);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Conversational AI</div>
          <div className="text-xs text-slate-500">
            Role: {profile?.role ?? "—"} ·{" "}
            <span className={connected ? "text-emerald-600" : "text-slate-400"}>
              {connected ? "connected" : "connecting…"}
            </span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              Say hi to your assistant.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-2xl bg-slate-900 px-4 py-2 text-white"
                  : "mr-auto max-w-[80%] rounded-2xl bg-white px-4 py-2 shadow-sm"
              }
            >
              {m.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white p-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!connected || streaming}
            placeholder={connected ? "Type a message" : "Connecting…"}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
          />
          <button
            onClick={send}
            disabled={!connected || streaming || !input.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
