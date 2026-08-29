import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <AppShell user={{ name: session.name, email: session.email, role: session.role }}>
      {children}
    </AppShell>
  );
}
