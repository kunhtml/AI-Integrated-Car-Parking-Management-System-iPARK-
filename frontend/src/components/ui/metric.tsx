export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
