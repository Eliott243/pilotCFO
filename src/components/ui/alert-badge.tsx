import { cn } from "@/lib/utils";
import type { Alert } from "@/types/database";
import { AlertTriangle, Info, XCircle } from "lucide-react";

export function AlertBadge({ alert }: { alert: Alert }) {
  const icons = {
    critical: XCircle,
    high: AlertTriangle,
    medium: Info,
  };
  const colors = {
    critical: "border-red-200 bg-red-50 text-red-800",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    medium: "border-stone-200 bg-stone-50 text-stone-700",
  };

  const Icon = icons[alert.priority];

  return (
    <div className={cn("flex gap-3 p-4 rounded-xl border", colors[alert.priority])}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-sm">{alert.title}</p>
        <p className="text-sm opacity-80 mt-0.5">{alert.message}</p>
        {alert.action && (
          <p className="text-xs font-medium mt-2 opacity-70">→ {alert.action}</p>
        )}
      </div>
    </div>
  );
}
