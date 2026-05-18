import { useUiStore } from '../../store/useUiStore.js';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export default function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clear = useUiStore((s) => s.clearToast);
  if (!toast) return null;

  const styles = {
    success: { bg: 'bg-emerald-600', icon: CheckCircle2 },
    error: { bg: 'bg-unitep-danger', icon: AlertCircle },
    warning: { bg: 'bg-unitep-step', icon: AlertCircle },
    info: { bg: 'bg-unitep-info', icon: Info },
  };
  const cfg = styles[toast.type] || styles.info;
  const Icon = cfg.icon;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideIn_.2s_ease-out]">
      <div className={`${cfg.bg} text-white px-4 py-3 rounded-lg shadow-unitep-lg flex items-center gap-3 min-w-[300px] max-w-md`}>
        <Icon className="w-5 h-5 shrink-0" />
        <div className="text-sm flex-1">{toast.message}</div>
        <button onClick={clear} className="opacity-80 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
