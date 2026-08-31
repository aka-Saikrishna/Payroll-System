"use client";

import { usePathname } from "next/navigation";

export interface CompanyInfo {
  code: string;
  name: string;
  prefix: string;
}

const COMPANIES: Record<string, CompanyInfo> = {
  VPPL: { code: "VPPL", name: "VEEJAY POLY PLAST LIMITED", prefix: "" },
  VPFL: { code: "VPFL", name: "VEEJAY POLY FILMS LIMITED", prefix: "/vpfl" },
};

export function useCompany(): CompanyInfo {
  const pathname = usePathname();
  if (pathname.startsWith("/vpfl")) return COMPANIES.VPFL;
  return COMPANIES.VPPL;
}

export function getCompanyByCode(code: string): CompanyInfo {
  return COMPANIES[code] || COMPANIES.VPPL;
}
