"use client";

import { usePathname } from "next/navigation";
import { COMPANIES, type CompanyInfo } from "@/lib/companies";

export type { CompanyInfo };
export { getCompanyByCode } from "@/lib/companies";

export function useCompany(): CompanyInfo {
  const pathname = usePathname();
  if (pathname.startsWith("/vpfl")) return COMPANIES.VPFL;
  return COMPANIES.VPPL;
}
