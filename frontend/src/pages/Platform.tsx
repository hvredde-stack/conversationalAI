import {
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Loader2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import { listTenants, type TenantSummary } from "../lib/api";

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
