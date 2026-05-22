import { create } from 'zustand';
import { ai } from '../utils/ai.js';

/**
 * Store global pour l'intégration Mistral :
 *  - statut de configuration (clé présente ou non) ;
 *  - état de chargement par "tâche" (visionStep, scrapeProduct, reformulate) ;
 *  - dernière erreur lisible ;
 *  - cache des dernières générations pour faciliter le debug / la relance.
 *
 * On garde le store volontairement simple : pas de persistance, les états
 * disparaissent au reload.
 */
export const useAiStore = create((set, get) => ({
  available: ai.isAvailable(),
  // 'electron' | 'web' | 'none' — utile pour différencier dans l'UI les
  // capacités du runtime (ex: scraping désactivé en mode web).
  runtime: ai.runtime(),
  configured: null,
  models: null,
  loading: {
    vision: false,
    scrape: false,
    reformulate: false,
    testConnection: false,
  },
  lastError: null,

  async refreshStatus() {
    if (!ai.isAvailable()) {
      set({ available: false, runtime: 'none', configured: false });
      return;
    }
    const s = await ai.status();
    set({
      available: true,
      runtime: s?.runtime || ai.runtime(),
      configured: !!s?.configured,
      models: s?.models || null,
    });
  },

  async testConnection() {
    set((st) => ({ loading: { ...st.loading, testConnection: true }, lastError: null }));
    const res = await ai.testConnection();
    set((st) => ({ loading: { ...st.loading, testConnection: false } }));
    if (!res.ok) set({ lastError: res.error });
    return res;
  },

  async generateStepText(params) {
    set((st) => ({ loading: { ...st.loading, vision: true }, lastError: null }));
    const res = await ai.generateStepText(params);
    set((st) => ({ loading: { ...st.loading, vision: false } }));
    if (!res.ok) set({ lastError: res.error });
    return res;
  },

  async scrapeProduct(params) {
    set((st) => ({ loading: { ...st.loading, scrape: true }, lastError: null }));
    const res = await ai.scrapeProduct(params);
    set((st) => ({ loading: { ...st.loading, scrape: false } }));
    if (!res.ok) set({ lastError: res.error });
    return res;
  },

  async reformulate(text) {
    set((st) => ({ loading: { ...st.loading, reformulate: true }, lastError: null }));
    const res = await ai.reformulate(text);
    set((st) => ({ loading: { ...st.loading, reformulate: false } }));
    if (!res.ok) set({ lastError: res.error });
    return res;
  },
}));
