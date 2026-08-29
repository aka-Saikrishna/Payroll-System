import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return <div className="bg-navy-100 min-h-screen">{children}</div>;
}
