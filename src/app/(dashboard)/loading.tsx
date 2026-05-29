export default function DashboardLoading() {
  return (
    <div className="py-16 flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      <p className="text-sm text-muted">Chargement...</p>
    </div>
  );
}
