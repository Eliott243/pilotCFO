import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center mb-4">
        <span className="text-accent text-xl font-semibold">$</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted mt-2 leading-relaxed">{description}</p>
      {action && (
        <a href={action.href} className="mt-6">
          <Button>{action.label}</Button>
        </a>
      )}
    </div>
  );
}
