/**
 * Pont d'accès à l'IA Mistral côté renderer — bi-runtime.
 *
 *  - Mode Electron desktop (app installée) :
 *      Les appels passent par les handlers IPC déclarés dans `src/main/main.js`
 *      (`ai:status`, `ai:generateStepText`, etc.) ; la clé Mistral est figée
 *      dans le binaire et ne quitte jamais le main process.
 *
 *  - Mode Web (build Vite déployé sur Vercel ou autre hébergeur de l'API
 *    `/api/ai/*`) :
 *      Les appels passent par fetch HTTP vers les fonctions serverless
 *      qui détiennent `process.env.MISTRAL_API_KEY` côté serveur. La clé
 *      ne transite jamais par le browser.
 *
 * Toutes les fonctions retournent { ok: true, ... } ou { ok: false, code, error }
 * — jamais de throw — pour simplifier le rendu d'erreurs dans l'UI.
 */

const isElectron =
  typeof window !== 'undefined' && !!window.qualidoc?.ai;

// Si on est dans un browser standard, on suppose qu'une API HTTP `/api/ai/*`
// est exposée par l'hébergeur (Vercel functions par défaut). Activable côté
// build via VITE_DISABLE_WEB_AI=1 si on veut forcer la désactivation.
const isWebApiEnabled =
  typeof window !== 'undefined' &&
  !isElectron &&
  import.meta?.env?.VITE_DISABLE_WEB_AI !== '1';

const API_BASE = (import.meta?.env?.VITE_AI_API_BASE || '/api/ai').replace(/\/$/, '');

const unavailable = {
  ok: false,
  code: 'NO_RUNTIME',
  error: "L'IA n'est pas disponible sur cet environnement.",
};

async function getJson(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return await res.json();
  } catch (err) {
    return { ok: false, code: 'NETWORK', error: err?.message || 'Erreur réseau' };
  }
}

async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, code: 'NETWORK', error: err?.message || 'Erreur réseau' };
  }
}

export const ai = {
  /**
   * `true` si l'IA est utilisable depuis ce contexte :
   *  - app Electron (preload ai) ;
   *  - OU build web avec endpoints /api/ai/* disponibles.
   *
   * Le UI s'appuie là-dessus pour afficher / masquer les boutons.
   */
  isAvailable: () => isElectron || isWebApiEnabled,

  /** Précise quel runtime est utilisé (utile pour Settings → IA Mistral). */
  runtime: () => (isElectron ? 'electron' : isWebApiEnabled ? 'web' : 'none'),

  async status() {
    if (isElectron) return await window.qualidoc.ai.status();
    if (isWebApiEnabled) {
      const r = await getJson(`${API_BASE}/status`);
      return {
        configured: !!r?.configured,
        models: r?.models || null,
        runtime: 'web',
      };
    }
    return { configured: false, models: null, runtime: 'none' };
  },

  async testConnection() {
    if (isElectron) return await window.qualidoc.ai.testConnection();
    if (isWebApiEnabled) return await getJson(`${API_BASE}/test-connection`);
    return unavailable;
  },

  /**
   * @param {Object} params
   * @param {string} params.imageDataUrl - capture base64 (data:image/...;base64,...)
   * @param {Object} [params.context]
   */
  async generateStepText(params) {
    if (isElectron) return await window.qualidoc.ai.generateStepText(params);
    if (isWebApiEnabled) {
      return await postJson(`${API_BASE}/generate-step-text`, {
        imageDataUrl: params?.imageDataUrl,
        context: params?.context || {},
      });
    }
    return unavailable;
  },

  /**
   * Scraping constructeur : ne fonctionne que côté Electron (Puppeteer).
   * En mode web, le serveur renvoie SCRAPING_DISABLED → l'UI affichera
   * un message clair et masquera le bouton "Récupérer les infos en ligne".
   */
  async scrapeProduct(params) {
    if (isElectron) return await window.qualidoc.ai.scrapeProduct(params);
    if (isWebApiEnabled) {
      return await postJson(`${API_BASE}/scrape-product`, params || {});
    }
    return unavailable;
  },

  async reformulate(text) {
    if (isElectron) return await window.qualidoc.ai.reformulate({ text });
    if (isWebApiEnabled) return await postJson(`${API_BASE}/reformulate`, { text });
    return unavailable;
  },
};
