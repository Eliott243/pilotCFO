import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isDemoMetricsOnly } from "@/lib/supabase/config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell showDemoBanner={isDemoMetricsOnly()}>
      {children}
    </DashboardShell>
  );
}
