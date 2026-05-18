/**
 * Pont d'accès à l'IA Mistral côté renderer.
 *
 * Toutes les fonctions retournent une promesse qui résout vers
 *   { ok: true, ... }  ou  { ok: false, code, error }
 * — jamais de throw. Cela simplifie le rendu d'erreurs dans l'UI.
 *
 * En mode "web only" (sans Electron), l'IA est désactivée.
 */

const isElectron =
  typeof window !== 'undefined' && !!window.qualidoc?.ai;

const unavailable = {
  ok: false,
  code: 'NO_ELECTRON',
  error: "L'IA n'est disponible que dans l'application bureau Qualidoc V3.",
};

export const ai = {
  isAvailable: () => isElectron,

  async status() {
    if (!isElectron) return { configured: false, models: null };
    return await window.qualidoc.ai.status();
  },

  async testConnection() {
    if (!isElectron) return unavailable;
    return await window.qualidoc.ai.testConnection();
  },

  /**
   * @param {Object} params
   * @param {string} params.imageDataUrl - capture base64 (data:image/...;base64,...)
   * @param {Object} [params.context]
   * @param {string} [params.context.brand]
   * @param {string} [params.context.model]
   * @param {string} [params.context.sectionTitle]
   * @param {string} [params.context.docType]
   */
  async generateStepText(params) {
    if (!isElectron) return unavailable;
    return await window.qualidoc.ai.generateStepText(params);
  },

  /**
   * @param {Object} params
   * @param {string} [params.url]   - URL constructeur directe (prioritaire)
   * @param {string} [params.brand] - sinon, on recherche brand+model via DuckDuckGo
   * @param {string} [params.model]
   */
  async scrapeProduct(params) {
    if (!isElectron) return unavailable;
    return await window.qualidoc.ai.scrapeProduct(params);
  },

  async reformulate(text) {
    if (!isElectron) return unavailable;
    return await window.qualidoc.ai.reformulate({ text });
  },
};
