import { setCors, json, isApiKeyConfigured, MISTRAL_MODELS } from '../_lib.js';

/**
 * GET /api/ai/status
 * Retourne l'état de configuration de l'IA côté serveur Vercel.
 * N'expose jamais la clé, seulement un booléen + la liste des modèles utilisés.
 */
export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  return json(res, 200, {
    configured: isApiKeyConfigured(),
    models: MISTRAL_MODELS,
    runtime: 'vercel',
  });
}
