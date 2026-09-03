export interface CompanyInfo {
  code: string;
  name: string;
  prefix: string;
}

/**
 * Shared by both server (API routes, exports) and client (useCompany hook),
 * so this module must stay free of client-only imports.
 */
export const COMPANIES: Record<string, CompanyInfo> = {
  VPPL: { code: "VPPL", name: "VEEJAY POLY PLAST LIMITED", prefix: "" },
  VPFL: { code: "VPFL", name: "VEEJAY POLY FILMS LIMITED", prefix: "/vpfl" },
};

export function getCompanyByCode(code: string): CompanyInfo {
  return COMPANIES[code] || COMPANIES.VPPL;
}
