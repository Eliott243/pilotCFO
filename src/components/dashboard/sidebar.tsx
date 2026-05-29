"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/locale-provider";
import {
  LayoutDashboard,
  HeartPulse,
  TrendingUp,
  Wallet,
  LineChart,
  MessageSquare,
  FileText,
  Settings,
  X,
} from "lucide-react";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { dict } = useI18n();

  const items = [
    { href: "/overview", label: dict.nav.overview, icon: LayoutDashboard },
    { href: "/financial-health", label: dict.nav.financialHealth, icon: HeartPulse },
    { href: "/profitability", label: dict.nav.profitability, icon: TrendingUp },
    { href: "/cash-flow", label: dict.nav.cashFlow, icon: Wallet },
    { href: "/forecasts", label: dict.nav.forecasts, icon: LineChart },
    { href: "/ai-cfo", label: dict.nav.aiCfo, icon: MessageSquare },
    { href: "/reports", label: dict.nav.reports, icon: FileText },
    { href: "/settings", label: dict.nav.settings, icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-56 max-w-[85vw] border-r border-border bg-sidebar flex flex-col z-50",
        "transition-transform duration-200 ease-out",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="px-5 py-5 border-b border-border flex items-center justify-between gap-2">
        <Link href="/overview" className="flex items-center gap-2 min-w-0" onClick={onClose}>
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={28}
            height={28}
            className="rounded-lg shrink-0"
            priority
          />
          <span className="font-semibold text-sm tracking-tight truncate">pilotCFO</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/60 text-muted"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overscroll-contain">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150",
                active
                  ? "bg-white text-foreground font-medium shadow-sm border border-border"
                  : "text-muted hover:text-foreground hover:bg-white/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-xs text-muted">CFO virtuel Shopify</p>
      </div>
    </aside>
  );
}
