"use client";

import { SearchIcon } from "@/components/icons";

export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 card p-3 flex flex-wrap items-center gap-2 justify-between">
      {onSearchChange ? (
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            className="input pl-8"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
