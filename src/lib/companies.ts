export interface CompanyInfo {
  code: string;
  name: string;
  prefix: string;
  /**
   * Premises printed beneath the company name on the Register of Wages.
   * Held here rather than in CompanySettings, which stores a single address
   * for the whole system and so cannot describe two sites. Empty prints the
   * company name alone — never another company's address.
   */
  address: string;
}

/**
 * Shared by both server (API routes, exports) and client (useCompany hook),
 * so this module must stay free of client-only imports.
 */
export const COMPANIES: Record<string, CompanyInfo> = {
  VPPL: {
    code: "VPPL",
    name: "VEEJAY POLY PLAST LIMITED",
    prefix: "",
    address: "SY NO 106/A, MADANAPURAM, KOTHUR MANDAL, MAHABOOBNAGAR DIST",
  },
  // VPFL is at Kattedan. Left empty until that address is supplied — the
  // register then prints the name alone rather than VPPL's Kothur premises.
  VPFL: { code: "VPFL", name: "VEEJAY POLY FILMS LIMITED", prefix: "/vpfl", address: "" },
};

export function getCompanyByCode(code: string): CompanyInfo {
  return COMPANIES[code] || COMPANIES.VPPL;
}
