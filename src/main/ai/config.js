/**
 * Configuration centrale de l'intégration Mistral AI pour Qualidoc V3.
 *
 * SÉCURITÉ — clé API figée :
 *   Conformément à la décision UNITEP, la clé Mistral est partagée par tous les
 *   postes EDF utilisant Qualidoc V3 et est intégrée au binaire NSIS. Elle reste
 *   confinée au processus Electron principal et n'est jamais exposée au renderer
 *   (pas de window.process, contextIsolation activé).
 *
 *   Ordre de résolution :
 *     1. process.env.MISTRAL_API_KEY (utile pendant le développement / build CI)
 *     2. Constante MISTRAL_API_KEY_BUILTIN ci-dessous (à remplacer avant le build)
 *
 *   Pour remplacer la clé : modifier UNIQUEMENT la constante ci-dessous,
 *   puis exécuter `npm run build`. La clé n'apparaîtra jamais dans le bundle
 *   Vite (qui ne contient que le code renderer).
 */

const MISTRAL_API_KEY_BUILTIN = '9kNe3vCVauekOIhzt436ISuJ9N7C5J8q';

// Valeurs sentinelles que l'on considère NON configurées : utilisées avant
// qu'un administrateur ne colle une vraie clé dans MISTRAL_API_KEY_BUILTIN.
const PLACEHOLDER_KEYS = new Set([
  'REMPLACER_PAR_CLE_MISTRAL_UNITEP',
  'CHANGE_ME',
  '',
]);

export const MISTRAL_API_KEY =
  process.env.MISTRAL_API_KEY || MISTRAL_API_KEY_BUILTIN;

export const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

export const MISTRAL_MODELS = {
  vision: 'pixtral-12b-2409',
  extraction: 'mistral-large-latest',
  reformulation: 'mistral-small-latest',
};

export const TIMEOUTS = {
  chat: 60_000,
  vision: 90_000,
  scraping: 45_000,
};

export const SCRAPER_LIMITS = {
  maxHtmlChars: 60_000,
  navigationTimeout: 30_000,
};

export function isApiKeyConfigured() {
  return (
    typeof MISTRAL_API_KEY === 'string' &&
    MISTRAL_API_KEY.length > 20 &&
    !PLACEHOLDER_KEYS.has(MISTRAL_API_KEY)
  );
}
