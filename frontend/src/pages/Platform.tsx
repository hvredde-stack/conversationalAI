import {
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import {
  deleteCatalogTool,
  listCatalog,
  listTenants,
  upsertCatalogTool,
  type CatalogTool,
  type TenantSummary,
  type WebhookAuth,
  type WebhookDef,
} from "../lib/api";

export function Platform() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTenants(await listTenants());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!profile?.is_platform_admin) {
    return (
      <div className="flex h-full items-center justify-center p-6 bg-navy-50">
        <div className="max-w-md rounded-2xl border border-navy-100 bg-white p-8 shadow-card text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-navy-800">Platform admin only</h1>
          <p className="mt-2 text-sm text-navy-500">
            This area is for the platform owner. Ask them to run
            <code className="ml-1 rounded bg-navy-100 px-1.5 py-0.5 text-xs">
              promote_platform_admin.py
            </code>{" "}
            on your account.
          </p>
          <button
            onClick={() => navigate("/chat")}
            className="mt-5 text-sm text-navy-500 hover:text-navy-800"
          >
            ← Back to chat
          </button>
        </div>
      </div>
    );
  }

  const totalUsers = tenants.reduce((sum, t) => sum + t.user_count, 0);
  const totalDocs = tenants.reduce((sum, t) => sum + t.document_count, 0);
  const readyCount = tenants.filter((t) => t.data_store_ready).length;

  return (
    <div className="flex h-full flex-col bg-navy-50">
      <header className="flex items-center justify-between border-b border-navy-100 bg-white px-4 sm:px-6 py-3">
        <div className="flex items-center gap-4">
          <Logo size={32} />
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold-600 ring-1 ring-gold-400/40">
            <ShieldAlert className="h-3 w-3" />
            Platform
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="text-sm text-navy-500 hover:text-navy-800 transition"
          >
            ← Back to chat
          </button>
          <button
            onClick={signOut}
            className="text-sm text-navy-500 hover:text-navy-800 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
                Tenants
              </h1>
              <p className="mt-1 text-sm text-navy-500">
                All businesses on the platform. View status, drill into details, and manage onboarding.
              </p>
            </div>
            <button
              disabled
              title="Coming next iteration"
              className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-gold-400 shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Onboard new tenant
            </button>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Tenants" value={tenants.length} icon={<Building2 className="h-4 w-4" />} />
            <StatCard label="Members" value={totalUsers} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Documents" value={totalDocs} icon={<FileText className="h-4 w-4" />} />
            <StatCard
              label="Knowledge bases ready"
              value={`${readyCount} / ${tenants.length}`}
              icon={<Database className="h-4 w-4" />}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-navy-100 bg-white shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-navy-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-navy-800">All tenants</div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-navy-400" />}
            </div>

            {tenants.length === 0 && !loading ? (
              <div className="p-10 text-center text-sm text-navy-400">
                No tenants yet. Self-serve signups will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400 bg-navy-50/50">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Owner</th>
                      <th className="px-5 py-3">Members</th>
                      <th className="px-5 py-3">Docs</th>
                      <th className="px-5 py-3">Knowledge base</th>
                      <th className="px-5 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {tenants.map((t) => (
                      <tr key={t.business_id} className="hover:bg-navy-50/50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-navy-800">{t.name}</div>
                          <div className="font-mono text-[11px] text-navy-400">
                            {t.business_id.slice(0, 12)}…
                          </div>
                        </td>
                        <td className="px-5 py-3 text-navy-700">{t.owner_email ?? "—"}</td>
                        <td className="px-5 py-3 text-navy-700">{t.user_count}</td>
                        <td className="px-5 py-3 text-navy-700">{t.document_count}</td>
                        <td className="px-5 py-3">
                          {t.data_store_id ? (
                            t.data_store_ready ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                                <Clock className="h-3 w-3" />
                                Provisioning
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-navy-400">none</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-navy-500 text-xs">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <CatalogSection />

          <div className="mt-6 rounded-xl border border-navy-100 bg-white p-4 text-xs text-navy-500">
            <strong className="text-navy-700">Coming next:</strong> onboard new
            tenants (generate signup link + email), suspend / delete tenants,
            view per-tenant audit logs, and platform analytics.
          </div>
        </div>
      </main>
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-lg border border-navy-200 px-3 py-2 text-sm focus:border-gold-400 focus:outline-none";

function CatalogSection() {
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTools(await listCatalog());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onDelete(toolId: string) {
    if (!confirm(`Remove "${toolId}" from the catalog?`)) return;
    setError(null);
    try {
      await deleteCatalogTool(toolId);
      setTools((t) => t.filter((x) => x.tool_id !== toolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-800">
            <Wrench className="h-4 w-4 text-gold-500" />
            Tool catalog
          </h2>
          <p className="text-sm text-navy-500">
            Webhook tools that businesses can enable and configure for their agent.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Publish tool"}
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <CatalogForm
          onError={setError}
          onPublished={(t) => {
            setTools((prev) => [
              t,
              ...prev.filter((x) => x.tool_id !== t.tool_id),
            ]);
            setShowForm(false);
          }}
        />
      )}

      <div className="rounded-2xl border border-navy-100 bg-white shadow-soft overflow-hidden">
        {tools.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-navy-400">
            No tools published yet. Click “Publish tool” to add one.
          </div>
        ) : (
          <ul className="divide-y divide-navy-100">
            {tools.map((t) => (
              <li key={t.tool_id} className="flex items-center gap-4 px-5 py-3">
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-navy-100 text-navy-600">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-navy-800">
                    {t.display_name}{" "}
                    <span className="font-mono text-[11px] text-navy-400">
                      {t.name}
                    </span>
                  </div>
                  <div className="truncate text-xs text-navy-500">
                    {t.webhook?.method} {t.webhook?.url_template}
                  </div>
                </div>
                <span className="hidden sm:inline-flex rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-600">
                  {t.min_role}+
                </span>
                <button
                  onClick={() => onDelete(t.tool_id)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-navy-400 hover:bg-red-50 hover:text-red-600 transition"
                  aria-label="Delete tool"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CatalogForm({
  onPublished,
  onError,
}: {
  onPublished: (t: CatalogTool) => void;
  onError: (msg: string | null) => void;
}) {
  const [f, setF] = useState({
    tool_id: "",
    name: "",
    display_name: "",
    description: "",
    method: "POST",
    url_template: "",
    auth_type: "none",
    header_name: "",
    secret_key: "",
    parameters: '{\n  "type": "object",\n  "properties": {}\n}',
    config_schema: '{\n  "type": "object",\n  "properties": {}\n}',
    min_role: "customer",
    requires_confirmation: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    onError(null);
    let parameters: Record<string, unknown>;
    let configSchema: Record<string, unknown>;
    try {
      parameters = JSON.parse(f.parameters);
    } catch {
      onError("Parameters is not valid JSON.");
      return;
    }
    try {
      configSchema = JSON.parse(f.config_schema);
    } catch {
      onError("Config schema is not valid JSON.");
      return;
    }
    setSaving(true);
    try {
      const tool = await upsertCatalogTool({
        tool_id: f.tool_id.trim(),
        name: f.name.trim(),
        display_name: f.display_name.trim(),
        description: f.description.trim(),
        parameters,
        webhook: {
          method: f.method as WebhookDef["method"],
          url_template: f.url_template.trim(),
          auth: {
            type: f.auth_type as WebhookAuth["type"],
            header_name: f.header_name.trim() || null,
            secret_key: f.secret_key.trim() || null,
          },
          timeout_s: 20,
        },
        config_schema: configSchema,
        min_role: f.min_role,
        requires_confirmation: f.requires_confirmation,
      });
      onPublished(tool);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-soft space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Tool ID (slug, e.g. acme-bookings)">
          <input
            className={INPUT_CLS}
            value={f.tool_id}
            onChange={(e) => set("tool_id", e.target.value)}
          />
        </Labeled>
        <Labeled label="Function name (identifier, e.g. check_availability)">
          <input
            className={INPUT_CLS}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Labeled>
        <Labeled label="Display name">
          <input
            className={INPUT_CLS}
            value={f.display_name}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Labeled>
        <Labeled label="Minimum role">
          <select
            className={INPUT_CLS}
            value={f.min_role}
            onChange={(e) => set("min_role", e.target.value)}
          >
            {["customer", "staff", "manager", "admin", "owner"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Labeled>
      </div>

      <Labeled label="Description (tells the model when to use this tool)">
        <textarea
          className={INPUT_CLS}
          rows={2}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Labeled>

      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="HTTP method">
          <select
            className={INPUT_CLS}
            value={f.method}
            onChange={(e) => set("method", e.target.value)}
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Labeled>
        <div className="sm:col-span-2">
          <Labeled label="URL template (use {config.key} for per-business values)">
            <input
              className={INPUT_CLS}
              placeholder="https://{config.base_url}/availability"
              value={f.url_template}
              onChange={(e) => set("url_template", e.target.value)}
            />
          </Labeled>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Auth type">
          <select
            className={INPUT_CLS}
            value={f.auth_type}
            onChange={(e) => set("auth_type", e.target.value)}
          >
            {["none", "bearer", "header"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Labeled>
        {f.auth_type === "header" && (
          <Labeled label="Header name">
            <input
              className={INPUT_CLS}
              placeholder="X-API-Key"
              value={f.header_name}
              onChange={(e) => set("header_name", e.target.value)}
            />
          </Labeled>
        )}
        {f.auth_type !== "none" && (
          <Labeled label="Secret key (businesses supply the value)">
            <input
              className={INPUT_CLS}
              placeholder="api_key"
              value={f.secret_key}
              onChange={(e) => set("secret_key", e.target.value)}
            />
          </Labeled>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Parameters — JSON Schema for the model's arguments">
          <textarea
            className={`${INPUT_CLS} font-mono text-xs`}
            rows={5}
            value={f.parameters}
            onChange={(e) => set("parameters", e.target.value)}
          />
        </Labeled>
        <Labeled label="Config schema — JSON Schema for per-business settings">
          <textarea
            className={`${INPUT_CLS} font-mono text-xs`}
            rows={5}
            value={f.config_schema}
            onChange={(e) => set("config_schema", e.target.value)}
          />
        </Labeled>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={f.requires_confirmation}
            onChange={(e) => set("requires_confirmation", e.target.checked)}
            className="h-4 w-4 rounded border-navy-300"
          />
          Requires confirmation before running
        </label>
        <Button type="button" loading={saving} onClick={submit}>
          {saving ? "Publishing…" : "Publish to catalog"}
        </Button>
      </div>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-navy-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between text-navy-400">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <span>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-navy-800">{value}</div>
    </div>
  );
}
