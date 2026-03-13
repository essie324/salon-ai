"use client";

import { useMemo, useState } from "react";
import SidebarNav from "./SidebarNav";
import Topbar from "./Topbar";
import type { AppRole, NavItem } from "@/app/lib/roles";
import { roleLabel } from "@/app/lib/roles";

export default function DashboardShell({
  role,
  navItems,
  children,
  topbarRight,
}: {
  role: AppRole;
  navItems: NavItem[];
  children: React.ReactNode;
  topbarRight?: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const subtitle = useMemo(() => `Signed in as: ${roleLabel(role)} (temporary)`, [role]);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <Topbar
        title="Salon Dashboard"
        subtitle={subtitle}
        rightSlot={topbarRight}
        onToggleSidebar={() => setSidebarOpen(true)}
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-0 px-4 py-6 md:grid-cols-[260px_1fr] md:gap-6 md:px-6">
        <aside className="hidden md:block">
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <SidebarNav items={navItems} />
          </div>
        </aside>

        <main className="min-w-0">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px] bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Navigation</p>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <SidebarNav items={navItems} onNavigate={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

