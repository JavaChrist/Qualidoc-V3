import { create } from 'zustand';

/**
 * Store UI global : panneau de droite, sélection, toasts et modale de
 * confirmation. La modale est exposée via `confirm()` qui retourne une
 * Promise<boolean>, en remplacement de `window.confirm()` natif qui, dans
 * Electron, s'affiche comme une fenêtre système hors de l'application.
 */
export const useUiStore = create((set, get) => ({
  rightPanelOpen: true,
  selectedSectionId: null,
  selectedStepId: null,
  toast: null,

  // Modale de confirmation centralisée
  // { title, message, confirmLabel, cancelLabel, danger, _resolve }
  confirmDialog: null,

  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  selectSection: (id) => set({ selectedSectionId: id, selectedStepId: null }),
  selectStep: (sectionId, stepId) => set({ selectedSectionId: sectionId, selectedStepId: stepId }),
  notify: (type, message) => {
    set({ toast: { type, message, ts: Date.now() } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),

  /**
   * Affiche une modale de confirmation React et résout la Promise avec
   * true (confirmé) ou false (annulé). Remplace `window.confirm()`.
   *
   * Usage :
   *   const ok = await useUiStore.getState().confirm({
   *     title: 'Supprimer cette étape ?',
   *     message: 'Cette action est irréversible.',
   *     danger: true,
   *   });
   *   if (ok) { ... }
   */
  confirm: (options = {}) => new Promise((resolve) => {
    // Si une modale est déjà ouverte, on résout l'ancienne en false avant.
    const previous = get().confirmDialog;
    if (previous && previous._resolve) previous._resolve(false);
    set({
      confirmDialog: {
        title: options.title || 'Confirmation requise',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirmer',
        cancelLabel: options.cancelLabel || 'Annuler',
        danger: !!options.danger,
        _resolve: resolve,
      },
    });
  }),

  /** Résout la modale courante et la ferme. Utilisé par <ConfirmDialog />. */
  resolveConfirm: (value) => {
    const dlg = get().confirmDialog;
    if (dlg && dlg._resolve) dlg._resolve(!!value);
    set({ confirmDialog: null });
  },
}));
