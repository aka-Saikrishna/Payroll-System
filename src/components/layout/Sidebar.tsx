"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { mainNav, vpflNav, deactivatedNav, settingsNav } from "./nav-config";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  const allHrefs = [...mainNav, ...vpflNav, ...settingsNav].map((item) => item.href);
  const bestMatch = allHrefs
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  function NavItem({ href, label, icon: IconComp }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
    const active = href === bestMatch;
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={clsx(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-navy-800 text-white" : "text-navy-200 hover:bg-navy-800/60 hover:text-white"
        )}
      >
        <IconComp className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={clsx(
        "flex flex-col bg-navy-900 text-white h-screen sticky top-0 shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-navy-800">
        {!collapsed && <span className="font-bold tracking-tight">VEEKAY</span>}
        <button onClick={onToggle} className="text-navy-300 hover:text-white p-1 rounded ml-auto" aria-label="Toggle sidebar">
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {!collapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-500">VEEJAY POLYPLAST PVT LTD</div>
        )}
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="pt-4 mt-4 border-t border-navy-800">
          {!collapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-500">VPFL</div>
          )}
          <div className="space-y-1">
            {vpflNav.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-navy-800">
          <NavItem {...deactivatedNav} />
        </div>

        <div className="pt-4 mt-4 border-t border-navy-800">
          {!collapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-500">Settings</div>
          )}
          <div className="space-y-1">
            {settingsNav.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
