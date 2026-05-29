import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isDemoMode } from "@/lib/supabase/config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell showDemoBanner={isDemoMode()}>
      {children}
    </DashboardShell>
  );
}
