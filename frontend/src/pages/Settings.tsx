import { Building2, Sparkles, Trash2 } from "lucide-react";

import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../contexts/AuthContext";

export function Settings() {
  const { profile } = useAuth();

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
            Settings
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Business configuration and Aria's persona for your tenant.
          </p>
        </div>

        {/* Business identity */}
        <section className="mb-6 rounded-2xl border border-navy-100 bg-white shadow-soft p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-navy-100 text-navy-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-800">Business identity</h2>
              <p className="text-sm text-navy-500">How Aria refers to your business.</p>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-t border-navy-100 pt-2">
              <dt className="text-navy-500">Business ID</dt>
              <dd className="font-mono text-xs text-navy-700">{profile?.business_id ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-navy-100 pt-2">
              <dt className="text-navy-500">Your role</dt>
              <dd className="text-navy-700 capitalize">{profile?.role ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-navy-100 pt-2">
              <dt className="text-navy-500">Signed in as</dt>
              <dd className="text-navy-700">{profile?.email ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
            Editing the business name and persona is coming next. For now these
            are set during signup.
          </p>
        </section>

        {/* Aria persona */}
        <section className="mb-6 rounded-2xl border border-navy-100 bg-white shadow-soft p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-navy-800 text-gold-400 ring-1 ring-gold-400/40">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-800">Aria's persona</h2>
              <p className="text-sm text-navy-500">
                The voice, tone, and guidelines Aria follows when talking to your team and customers.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-navy-50 p-4 text-sm text-navy-700">
            <strong>Default:</strong> Warm, professional concierge tone — friendly,
            helpful, conversational, professional, intelligent. Adapts by user role
            (concierge for customers, direct for staff/admin).
          </div>
          <p className="mt-3 text-xs text-navy-500">
            Persona editor (custom instructions, tone presets, sample greetings)
            ships in the next iteration.
          </p>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-100 text-red-700">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-red-800">Danger zone</h2>
              <p className="text-sm text-red-700/80">
                Permanently delete this business and all its data.
              </p>
            </div>
          </div>
          <button
            disabled
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete business (owner only — coming soon)
          </button>
        </section>
      </div>
    </AdminLayout>
  );
}
