import { Sidebar } from "@/components/dashboard/sidebar";
import { isDemoMode } from "@/lib/supabase/config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        {isDemoMode() && (
          <div className="bg-accent-light border-b border-accent/20 px-8 py-2 text-center text-xs text-accent">
            Mode démo — connectez Supabase pour vos données réelles
          </div>
        )}
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
