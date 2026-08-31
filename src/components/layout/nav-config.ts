import {
  AdvanceIcon,
  AttendanceIcon,
  BonusIcon,
  CalendarIcon,
  DashboardIcon,
  EmployeeIcon,
  EmployeeOffIcon,
  ReportIcon,
  RuleIcon,
  SettingsIcon,
  SheetIcon,
  UsersIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

export const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/salary-sheets", label: "Salary Sheets", icon: SheetIcon },
  { href: "/employees", label: "Employees", icon: EmployeeIcon },
  { href: "/attendance", label: "Attendance", icon: AttendanceIcon },
  { href: "/advances", label: "Advances", icon: AdvanceIcon },
  { href: "/reports", label: "Reports", icon: ReportIcon },
];

export const deactivatedNav: NavItem = { href: "/employees/deactivated", label: "Deactivated", icon: EmployeeOffIcon };

export const vpflNav: NavItem[] = [
  { href: "/vpfl/employees", label: "Employees", icon: EmployeeIcon },
  { href: "/vpfl/salary-sheets", label: "Salary Sheets", icon: SheetIcon },
  { href: "/vpfl/attendance", label: "Attendance", icon: AttendanceIcon },
  { href: "/vpfl/advances", label: "Advances", icon: AdvanceIcon },
  { href: "/vpfl/reports", label: "Reports", icon: ReportIcon },
];

export const settingsNav: NavItem[] = [
  { href: "/settings/holidays", label: "Holiday Calendar", icon: CalendarIcon },
  { href: "/settings/deduction-rules", label: "Deduction Rules", icon: RuleIcon },
  { href: "/settings/bonus", label: "Bonus Settings", icon: BonusIcon },
  { href: "/settings/company", label: "Company Settings", icon: SettingsIcon },
  { href: "/settings/users", label: "Users", icon: UsersIcon },
];
