import { Mail, UserPlus, Users } from "lucide-react";

import { AdminLayout } from "../components/AdminLayout";
import { useAuth } from "../contexts/AuthContext";

export function Team() {
  const { profile } = useAuth();

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
            Team
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Manage who can use Aria inside your business — owners, admins,
            managers, and staff.
          </p>
        </div>

        {/* Current user (placeholder until /api/team list is built) */}
        <div className="rounded-2xl border border-navy-100 bg-white shadow-soft overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-navy-100 text-sm font-semibold text-navy-800">
            Members
          </div>
          <ul className="divide-y divide-navy-100">
            <li className="flex items-center gap-4 px-5 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-100 text-navy-700 font-semibold uppercase">
                {(profile?.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-navy-800">
                  {profile?.email}
                </div>
                <div className="text-xs text-navy-500">You</div>
              </div>
              <span className="inline-flex items-center rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gold-700 ring-1 ring-gold-400/40">
                {profile?.role}
              </span>
            </li>
          </ul>
        </div>

        {/* Coming next */}
        <div className="rounded-2xl border-2 border-dashed border-navy-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-navy-100 text-navy-600">
            <UserPlus className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-navy-800">
            Invite teammates — coming next
          </h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-navy-500">
            In the next iteration: enter a teammate's email, pick their role
            (admin · manager · staff), and they receive a signup link. Once
            they accept, they join this business with the right permissions.
          </p>
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-navy-400">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email invites
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Role-based access
            </span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
