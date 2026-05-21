import {
  BookOpen,
  ChevronLeft,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Logo } from "./Logo";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  children: ReactNode;
}

const ROLE_RANK: Record<string, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function AdminLayout({ children }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const canManage = (profile?.role && ROLE_RANK[profile.role] >= 3) ?? false;

  return (
    <div className="flex h-full bg-navy-50">
      <aside className="hidden lg:flex w-64 flex-col border-r border-navy-100 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-navy-100">
          <Logo size={32} />
        </div>

        <div className="p-3 border-b border-navy-100">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 px-2 py-1">
            Workspace
          </div>
          <button
            onClick={() => navigate("/chat")}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-700 hover:bg-navy-50 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to chat
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy-400 px-2 py-1">
            Admin
          </div>
          <SidebarLink to="/admin/knowledge" icon={<BookOpen className="h-4 w-4" />}>
            Knowledge base
          </SidebarLink>
          <SidebarLink to="/admin/tools" icon={<Wrench className="h-4 w-4" />}>
            Tools
          </SidebarLink>
          <SidebarLink to="/admin/team" icon={<Users className="h-4 w-4" />}>
            Team
          </SidebarLink>
          <SidebarLink to="/admin/settings" icon={<Settings className="h-4 w-4" />}>
            Settings
          </SidebarLink>

          {profile?.is_platform_admin && (
            <>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-navy-400 px-2 py-1">
                Platform
              </div>
              <SidebarLink to="/platform" icon={<ShieldAlert className="h-4 w-4 text-gold-500" />}>
                All tenants
              </SidebarLink>
            </>
          )}
        </nav>

        <div className="border-t border-navy-100 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-navy-100 text-navy-700 text-sm font-semibold uppercase">
              {(profile?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-navy-800">
                {profile?.email ?? "—"}
              </div>
              <div className="capitalize text-xs text-navy-500">
                {profile?.role ?? "member"} {!canManage && <span className="ml-1 text-amber-600">(read-only)</span>}
              </div>
            </div>
            <button
              onClick={signOut}
              className="grid h-8 w-8 place-items-center rounded-lg text-navy-500 hover:bg-navy-100 hover:text-navy-800"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3">
        <Logo size={28} />
        <button
          onClick={() => navigate("/chat")}
          className="text-sm text-navy-500 hover:text-navy-800"
        >
          ← Chat
        </button>
      </div>

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}

function SidebarLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-navy-800 text-gold-400"
            : "text-navy-700 hover:bg-navy-50",
        ].join(" ")
      }
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}
