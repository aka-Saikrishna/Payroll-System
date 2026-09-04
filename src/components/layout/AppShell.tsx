"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} />
        {/* Vertical scroll only. overflow-y:auto alone would compute overflow-x
            to auto too, giving a second horizontal scrollbar competing with the
            one inside each wide table — so pin it hidden. Pages that scroll
            horizontally own that container themselves. */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
