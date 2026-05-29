"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  showDemoBanner?: boolean;
}

export function DashboardShell({ children, showDemoBanner }: DashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-sidebar/95 backdrop-blur-sm px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/60 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/overview" className="flex items-center gap-2 min-w-0">
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={24}
            height={24}
            className="rounded-lg shrink-0"
          />
          <span className="font-semibold text-sm tracking-tight truncate">pilotCFO</span>
        </Link>
        <div className="w-9" aria-hidden />
      </header>

      {menuOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="lg:ml-56 min-h-screen min-w-0">
        {showDemoBanner && (
          <div className="bg-accent-light border-b border-accent/20 px-4 sm:px-6 lg:px-8 py-2 text-center text-xs text-accent">
            Mode démo — connectez Supabase pour vos données réelles
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
