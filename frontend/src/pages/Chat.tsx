import {
  ChevronLeft,
  LogOut,
  MessageSquarePlus,
  Send,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { AvatarState } from "../components/avatar/ConciergeAvatar";
import { Logo } from "../components/Logo";
import { MessageBubble } from "../components/MessageBubble";
import { TypingIndicator } from "../components/TypingIndicator";
import { useAuth } from "../contexts/AuthContext";
import { getIdTokenForWs, WS_BASE_URL } from "../lib/api";

// Lazy-loaded so three.js (~150 KB gzipped) stays out of the initial bundle.
const ConciergeAvatar = lazy(() =>
  import("../components/avatar/ConciergeAvatar").then((m) => ({
    default: m.ConciergeAvatar,
  })),
);

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Help me draft a warm welcome email for a new customer",
  "Suggest a polite response to a refund request",
  "What information should I gather to onboard a new client?",
  "Give me three professional ways to say no to a meeting",
];

export function Chat() {
  const { profile, firebaseUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
            {
              role: "assistant",
              content: `⚠️ ${data.message ?? `Something went wrong (${data.code}).`}`,
            },
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
  }, [messages, streaming]);

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [...prev, { role: "user", content }]);
    wsRef.current.send(JSON.stringify({ type: "user_message", content }));
    setInput("");
    setStreaming(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
    setStreaming(false);
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const role = profile?.role ?? "member";

  // Map the live chat lifecycle onto the avatar's animation state.
  const lastRole = messages[messages.length - 1]?.role;
  const avatarState: AvatarState = streaming
    ? lastRole === "assistant"
      ? "speaking" // tokens are streaming in
      : "thinking" // waiting on the model's first token
    : input.trim()
      ? "listening" // user is composing a message
      : "idle";

  return (
    <div className="flex h-full bg-navy-50">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onOpenAdmin={() => navigate("/admin")}
        onOpenPlatform={() => navigate("/platform")}
        isPlatformAdmin={profile?.is_platform_admin ?? false}
        userEmail={firebaseUser?.email ?? null}
        role={role}
        onSignOut={signOut}
      />

      {/* Main */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-navy-100 bg-white/85 backdrop-blur px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden grid h-9 w-9 place-items-center rounded-lg text-navy-500 hover:bg-navy-100"
              aria-label="Open menu"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 flex-shrink-0">
                <div className="h-full w-full overflow-hidden rounded-full bg-navy-800 shadow-soft ring-1 ring-gold-400/40">
                  <Suspense
                    fallback={
                      <div className="grid h-full w-full place-items-center">
                        <span className="font-display text-base font-bold text-gold-400">
                          A
                        </span>
                      </div>
                    }
                  >
                    <ConciergeAvatar state={avatarState} />
                  </Suspense>
                </div>
                {connected && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
                )}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-navy-800">Aria</div>
                <div className="flex items-center gap-1.5 text-xs">
                  {connected ? (
                    <span className="text-emerald-600">Here to help</span>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-600">Connecting…</span>
                    </>
                  )}
                  <span className="text-navy-300">·</span>
                  <span className="capitalize text-navy-500">{role}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={signOut}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
            {messages.length === 0 ? (
              <EmptyState onPick={(text) => send(text)} />
            ) : (
              <div className="space-y-5">
                {messages.map((m, i) => (
                  <MessageBubble key={i} role={m.role} content={m.content} />
                ))}
                {streaming && messages[messages.length - 1]?.role === "user" && (
                  <MessageBubble role="assistant" content="" asPlaceholder>
                    <TypingIndicator />
                  </MessageBubble>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </main>

        {/* Composer */}
        <footer className="border-t border-navy-100 bg-white px-4 sm:px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-navy-200 bg-white shadow-soft focus-within:border-gold-400 focus-within:shadow-focus transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={!connected || streaming}
                placeholder={connected ? "Ask Aria anything…  (Enter to send, Shift+Enter for newline)" : "Connecting to Aria…"}
                rows={1}
                className="flex-1 resize-none bg-transparent px-4 py-3 text-[15px] placeholder:text-navy-400 focus:outline-none disabled:opacity-60 max-h-40"
                style={{ minHeight: "48px" }}
              />
              <button
                onClick={() => send()}
                disabled={!connected || streaming || !input.trim()}
                aria-label="Send"
                className={[
                  "m-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl transition",
                  input.trim() && connected && !streaming
                    ? "bg-navy-800 text-gold-400 hover:bg-navy-700"
                    : "bg-navy-100 text-navy-400 cursor-not-allowed",
                ].join(" ")}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-navy-400">
              Aria can be imprecise — verify anything important. Knowledge-base grounding ships next.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenAdmin: () => void;
  onOpenPlatform: () => void;
  isPlatformAdmin: boolean;
  userEmail: string | null;
  role: string;
  onSignOut: () => void;
}

function Sidebar({
  open,
  onClose,
  onNewChat,
  onOpenAdmin,
  onOpenPlatform,
  isPlatformAdmin,
  userEmail,
  role,
  onSignOut,
}: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-navy-900/55 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={[
          "z-30 flex w-72 flex-col border-r border-navy-100 bg-white",
          "fixed inset-y-0 left-0 transform transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between p-4 border-b border-navy-100">
          <Logo size={32} />
          <button
            onClick={onClose}
            className="lg:hidden grid h-8 w-8 place-items-center rounded-lg text-navy-500 hover:bg-navy-100"
            aria-label="Close menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 hover:border-gold-400/60 transition"
          >
            <MessageSquarePlus className="h-4 w-4 text-gold-500" />
            New conversation
          </button>
          <button
            onClick={onOpenAdmin}
            className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 hover:border-navy-200 transition"
          >
            <SettingsIcon className="h-4 w-4 text-gold-500" />
            Admin
          </button>
          {isPlatformAdmin && (
            <button
              onClick={onOpenPlatform}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 hover:border-navy-200 transition"
            >
              <ShieldAlert className="h-4 w-4 text-gold-500" />
              Platform
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 px-2 py-1.5">
            Recent
          </div>
          <p className="px-2 py-3 text-xs text-navy-400 italic">
            Conversation history coming soon.
          </p>
        </nav>

        <div className="border-t border-navy-100 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-navy-100 text-navy-700 text-sm font-semibold uppercase">
              {(userEmail?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-navy-800">
                {userEmail ?? "—"}
              </div>
              <div className="capitalize text-xs text-navy-500">{role}</div>
            </div>
            <button
              onClick={onSignOut}
              className="grid h-8 w-8 place-items-center rounded-lg text-navy-500 hover:bg-navy-100 hover:text-navy-800"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8 sm:py-16 animate-fade-in">
      <div className="relative mb-5">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-navy-800 shadow-card ring-2 ring-gold-400/40">
          <span className="font-display text-2xl font-bold text-gold-400">A</span>
        </div>
        <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-gold-400 text-navy-900 shadow-soft">
          <Sparkles className="h-3 w-3" />
        </div>
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
        Hi, I'm Aria.
      </h2>
      <p className="mt-2 text-sm text-navy-500 max-w-md">
        Your AI Concierge. <span className="italic">Here to help. Here to listen. Here for you.</span>
      </p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 sm:grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-navy-200 bg-white p-3 text-left text-sm text-navy-700 hover:border-gold-400 hover:bg-gold-50/40 transition shadow-soft"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
