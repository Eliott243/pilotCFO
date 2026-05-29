interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted mt-1 max-w-xl">{subtitle}</p>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 w-full sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}
