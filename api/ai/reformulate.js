import {
  setCors, json, readJson, callChat, parseJsonResponse,
  MISTRAL_MODELS, buildReformulationPrompt,
} from '../_lib.js';

/**
 * POST /api/ai/reformulate
 * Body: { text: string }
 * Réponse: { ok: true, text: string } ou { ok: false, code, error }
 */
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD', error: 'POST attendu' });

  const body = await readJson(req);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return json(res, 400, { ok: false, code: 'BAD_INPUT', error: 'Champ "text" requis.' });

  try {
    const content = await callChat({
      model: MISTRAL_MODELS.reformulation,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildReformulationPrompt() },
        { role: 'user', content: text },
      ],
    });
    const parsed = parseJsonResponse(content);
    return json(res, 200, { ok: true, text: parsed?.text || text });
  } catch (err) {
    return json(res, 200, {
      ok: false,
      code: err.code || 'UNKNOWN',
      error: err.message || 'Erreur inconnue',
    });
  }
}
