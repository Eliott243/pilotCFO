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
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/financial-health", label: "Financial Health", icon: HeartPulse },
  { href: "/profitability", label: "Profitability", icon: TrendingUp },
  { href: "/cash-flow", label: "Cash Flow", icon: Wallet },
  { href: "/forecasts", label: "Forecasts", icon: LineChart },
  { href: "/ai-cfo", label: "AI CFO", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
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
    <aside className="fixed left-0 top-0 h-full w-56 border-r border-border bg-sidebar flex flex-col z-40">
      <div className="px-5 py-6 border-b border-border">
        <Link href="/overview" className="flex items-center gap-2">
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span className="font-semibold text-sm tracking-tight">pilotCFO</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150",
                active
                  ? "bg-white text-foreground font-medium shadow-sm border border-border"
                  : "text-muted hover:text-foreground hover:bg-white/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-muted">CFO virtuel Shopify</p>
      </div>
    </aside>
  );
}
