export default function ProgressBar({ value, max = 100, label, color = 'navy' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colors = {
    navy: 'bg-unitep-navy',
    success: 'bg-emerald-500',
    warning: 'bg-unitep-step',
    danger: 'bg-unitep-danger',
  };
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{label}</span>
          <span className="font-semibold">{value}/{max} ({pct}%)</span>
        </div>
      )}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color] || colors.navy} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
