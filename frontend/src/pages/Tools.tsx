import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Loader2,
  Lock,
  Plug,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminLayout } from "../components/AdminLayout";
import { Button } from "../components/Button";
import { useAuth } from "../contexts/AuthContext";
import {
  listToolActivity,
  listTools,
  updateTool,
  type ToolCallRecord,
  type ToolView,
} from "../lib/api";

const ROLE_RANK: Record<string, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function Tools() {
  const { profile } = useAuth();
  const [tools, setTools] = useState<ToolView[]>([]);
  const [activity, setActivity] = useState<ToolCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = (profile?.role && ROLE_RANK[profile.role] >= 3) ?? false;

  const refresh = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([listTools(), listToolActivity()]);
      setTools(t);
      setActivity(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
            Tools
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Everything your AI concierge can do. Built-in tools are always on;
            connected tools call your own systems — calendar, bookings, CRM —
            and you supply their settings.
          </p>
        </div>

        {!canManage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Lock className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Read-only.</strong> Only admins and owners can enable or
              configure tools. You can browse the list below.
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-navy-800">
            Capabilities ({tools.length})
            {tools.length > 0 && (
              <span className="ml-2 font-normal text-navy-500">
                {enabledCount} active
              </span>
            )}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-navy-400" />}
        </div>

        {tools.length === 0 && !loading ? (
          <div className="rounded-2xl border border-navy-100 bg-white p-10 text-center text-sm text-navy-400">
            No tools available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {tools.map((t) => (
              <ToolCard
                key={t.tool_id}
                tool={t}
                canManage={canManage}
                onError={setError}
                onSaved={(updated) =>
                  setTools((prev) =>
                    prev.map((x) => (x.tool_id === updated.tool_id ? updated : x)),
                  )
                }
              />
            ))}
          </div>
        )}

        <ActivityPanel activity={activity} loading={loading} />
      </div>
    </AdminLayout>
  );
}

function ToolCard({
  tool,
  canManage,
  onError,
  onSaved,
}: {
  tool: ToolView;
  canManage: boolean;
  onError: (msg: string | null) => void;
  onSaved: (t: ToolView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(tool.enabled);
  const [config, setConfig] = useState<Record<string, string>>(
    () => coerceStrings(tool.config),
  );
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fields = schemaFields(tool.config_schema);
  const secretKeys = [...new Set([...tool.needs_secrets, ...tool.has_secrets])];

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const updated = await updateTool(tool.tool_id, {
        enabled,
        config,
        // Only send secret values the user actually typed.
        secrets: Object.fromEntries(
          Object.entries(secrets).filter(([, v]) => v.trim() !== ""),
        ),
      });
      onSaved(updated);
      setSecrets({});
      setOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-navy-100 bg-white shadow-soft overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className={[
            "grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg",
            tool.kind === "builtin"
              ? "bg-navy-800 text-gold-400"
              : "bg-navy-100 text-navy-600",
          ].join(" ")}
        >
          {tool.kind === "builtin" ? (
            <Sparkles className="h-5 w-5" />
          ) : (
            <Plug className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy-800">
              {tool.display_name}
            </span>
            <KindBadge kind={tool.kind} />
          </div>
          <p className="mt-0.5 text-xs text-navy-500 line-clamp-2">
            {tool.description}
          </p>
        </div>
        <StatePill enabled={tool.enabled} configurable={tool.configurable} />
        {tool.configurable && canManage && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Configure"}
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t border-navy-100 bg-navy-50/50 px-5 py-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-navy-800"
            />
            Enabled — the agent may use this tool
          </label>

          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-navy-700">
                {f.label}
              </label>
              {f.description && (
                <p className="text-[11px] text-navy-400">{f.description}</p>
              )}
              <input
                type="text"
                value={config[f.key] ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, [f.key]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm focus:border-gold-400 focus:outline-none"
              />
            </div>
          ))}

          {secretKeys.map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium text-navy-700">
                {key.replace(/_/g, " ")} (credential)
              </label>
              <input
                type="password"
                value={secrets[key] ?? ""}
                placeholder={
                  tool.has_secrets.includes(key)
                    ? "•••••• stored — leave blank to keep"
                    : "Enter the API key / token"
                }
                onChange={(e) =>
                  setSecrets((s) => ({ ...s, [key]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm focus:border-gold-400 focus:outline-none"
              />
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="button" loading={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityPanel({
  activity,
  loading,
}: {
  activity: ToolCallRecord[];
  loading: boolean;
}) {
  return (
    <div className="mt-8">
      <div className="mb-2 text-sm font-semibold text-navy-800">
        Recent tool activity
      </div>
      <div className="rounded-2xl border border-navy-100 bg-white shadow-soft overflow-hidden">
        {activity.length === 0 ? (
          <div className="p-8 text-center text-sm text-navy-400">
            {loading ? "Loading…" : "No tool calls yet."}
          </div>
        ) : (
          <ul className="divide-y divide-navy-100">
            {activity.map((c, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                )}
                <span className="font-mono text-xs text-navy-700">{c.tool}</span>
                {c.error && (
                  <span className="truncate text-xs text-red-600">{c.error}</span>
                )}
                <span className="ml-auto text-[11px] text-navy-400">
                  {c.latency_ms != null ? `${c.latency_ms} ms` : ""}
                  {c.created_at
                    ? ` · ${new Date(c.created_at).toLocaleString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: ToolView["kind"] }) {
  const map = {
    builtin: { label: "Built-in", cls: "bg-gold-100 text-gold-700" },
    webhook: { label: "Connected", cls: "bg-sky-100 text-sky-700" },
  };
  const { label, cls } = map[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function StatePill({
  enabled,
  configurable,
}: {
  enabled: boolean;
  configurable: boolean;
}) {
  if (!configurable) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600">
        <Boxes className="h-3.5 w-3.5" />
        Always on
      </span>
    );
  }
  return (
    <span
      className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        enabled
          ? "bg-emerald-100 text-emerald-700"
          : "bg-navy-100 text-navy-500"
      }`}
    >
      {enabled ? "Active" : "Off"}
    </span>
  );
}

function schemaFields(
  schema: Record<string, unknown>,
): { key: string; label: string; description?: string }[] {
  const props = (schema?.properties ?? {}) as Record<
    string,
    { title?: string; description?: string }
  >;
  return Object.entries(props).map(([key, def]) => ({
    key,
    label: def.title ?? key.replace(/_/g, " "),
    description: def.description,
  }));
}

function coerceStrings(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
  );
}
