export interface CompanyInfo {
  code: string;
  name: string;
  prefix: string;
  /**
   * Village / district printed beneath the company name on the Register of
   * Wages. CompanySettings holds only one address for the whole system, so a
   * company that sits at its own premises overrides it here. Left empty, the
   * register falls back to the CompanySettings address.
   */
  address?: string;
}

/**
 * Shared by both server (API routes, exports) and client (useCompany hook),
 * so this module must stay free of client-only imports.
 */
export const COMPANIES: Record<string, CompanyInfo> = {
  VPPL: { code: "VPPL", name: "VEEJAY POLY PLAST LIMITED", prefix: "" },
  VPFL: {
    code: "VPFL",
    name: "VEEJAY POLY FILMS LIMITED",
    prefix: "/vpfl",
    address: "SY NO 106/A, MADANAPURAM, KOTHUR MANDAL, MAHABOOBNAGAR DIST",
  },
};

export function getCompanyByCode(code: string): CompanyInfo {
  return COMPANIES[code] || COMPANIES.VPPL;
}
