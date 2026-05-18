import { useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore.js';

/**
 * Modale de confirmation centralisée (remplace window.confirm() qui dans
 * Electron s'affiche comme une fenêtre système séparée hors de l'app).
 *
 * Pilotée par useUiStore.confirm({ title, message, danger, ... }) qui
 * renvoie une Promise<boolean>. Cette modale lit l'état confirmDialog et
 * appelle resolveConfirm(true|false) sur OK/Annuler/Escape/clic en dehors.
 *
 * - Touche Échap → annule
 * - Touche Entrée → confirme
 * - Clic sur l'arrière-plan → annule
 * - Focus auto sur le bouton de confirmation
 */
export default function ConfirmDialog() {
  const dialog = useUiStore((s) => s.confirmDialog);
  const resolve = useUiStore((s) => s.resolveConfirm);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        resolve(true);
      }
    };
    window.addEventListener('keydown', onKey);
    // Léger délai pour laisser la modale se monter avant de focuser.
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [dialog, resolve]);

  if (!dialog) return null;

  const { title, message, confirmLabel, cancelLabel, danger } = dialog;
  const Icon = danger ? AlertTriangle : HelpCircle;
  const iconColor = danger ? 'text-unitep-danger' : 'text-unitep-navy';
  const iconBg = danger ? 'bg-red-50' : 'bg-unitep-navy/10';
  const confirmClass = danger
    ? 'bg-unitep-danger text-white hover:bg-red-700 focus:ring-red-300'
    : 'bg-unitep-navy text-white hover:bg-unitep-navy-dark focus:ring-unitep-navy/30';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_.12s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resolve(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white rounded-lg shadow-unitep-lg max-w-md w-[90%] mx-4 overflow-hidden animate-[slideIn_.15s_ease-out]">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="confirm-title" className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h2>
              {message && (
                <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-50 px-5 py-3 flex items-center justify-end gap-2 border-t border-unitep-border">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-unitep-border rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => resolve(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-md focus:outline-none focus:ring-2 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
