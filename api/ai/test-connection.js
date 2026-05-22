import {
  setCors, json, isApiKeyConfigured, callChat, MISTRAL_MODELS,
} from '../_lib.js';

/**
 * GET /api/ai/test-connection
 * Effectue un mini-appel chat pour vérifier que la clé serveur est valide.
 */
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  if (!isApiKeyConfigured()) {
    return json(res, 200, {
      ok: false,
      code: 'NO_KEY',
      error: 'Clé MISTRAL_API_KEY non définie côté serveur Vercel.',
    });
  }
  try {
    const content = await callChat({
      model: MISTRAL_MODELS.reformulation,
      timeout: 15_000,
      messages: [{ role: 'user', content: 'Réponds uniquement par "OK".' }],
    });
    return json(res, 200, {
      ok: true,
      model: MISTRAL_MODELS.reformulation,
      sample: content?.slice(0, 32),
    });
  } catch (err) {
    return json(res, 200, {
      ok: false,
      code: err.code || 'UNKNOWN',
      error: err.message || 'Erreur inconnue',
    });
  }
}
