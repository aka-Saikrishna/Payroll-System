"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mainNav, settingsNav } from "./nav-config";
import { LogoutIcon } from "@/components/icons";
import { MONTH_NAMES } from "@/lib/date-utils";

function pageTitle(pathname: string): string {
  const all = [...mainNav, ...settingsNav];
  const match = all.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  if (match) return match.label;
  if (pathname.startsWith("/employees/")) return "Employee Detail";
  if (pathname.startsWith("/salary-sheets/")) return "Salary Sheet Detail";
  return "VEEKAY Payroll";
}

export function Topbar({ user }: { user: { name: string; email: string; role: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: period } = useQuery({
    queryKey: ["current-period"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/periods/current");
      if (!res.ok) return null;
      return res.json();
    },
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-navy-100 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-navy-900">{pageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-4">
        {period?.period && (
          <div className="hidden sm:flex items-center text-xs bg-navy-50 text-navy-700 rounded-full px-3 py-1 font-medium">
            {MONTH_NAMES[period.period.month - 1]} {period.period.year}
            <span className="ml-2 text-navy-400">•</span>
            <span className="ml-2 uppercase tracking-wide">{period.period.status}</span>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-navy-700 hover:text-navy-900"
          >
            <div className="w-7 h-7 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden md:inline">{user.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 card p-1 shadow-md">
              <div className="px-3 py-2 border-b border-navy-50">
                <div className="text-sm font-medium text-navy-900">{user.name}</div>
                <div className="text-xs text-navy-500">{user.email}</div>
                <div className="text-[10px] uppercase text-navy-400 mt-0.5">{user.role.replace("_", " ")}</div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy-700 hover:bg-navy-50 rounded-md"
              >
                <LogoutIcon /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
