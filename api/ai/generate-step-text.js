import {
  setCors, json, readJson, callChat, parseJsonResponse,
  MISTRAL_MODELS, TIMEOUTS, buildVisionPrompt,
} from '../_lib.js';

/**
 * POST /api/ai/generate-step-text
 * Body: { imageDataUrl: "data:image/...;base64,...", context: { brand, model, sectionTitle, docType } }
 * Réponse: { ok: true, result: { action, title, etapeCritique, noteSuggeree } }
 *          ou { ok: false, code, error }
 */
export const config = {
  // Vision pixtral peut traiter des images >2MB → autoriser un body large.
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD', error: 'POST attendu' });

  const body = await readJson(req);
  const imageDataUrl = body?.imageDataUrl;
  const context = body?.context || {};

  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return json(res, 400, {
      ok: false,
      code: 'BAD_IMAGE',
      error: 'imageDataUrl manquant ou invalide (data URL d\'image attendu).',
    });
  }

  const systemPrompt = buildVisionPrompt(context);

  try {
    const content = await callChat({
      model: MISTRAL_MODELS.vision,
      timeout: TIMEOUTS.vision,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: imageDataUrl },
          ],
        },
      ],
    });
    const parsed = parseJsonResponse(content);
    if (!parsed) {
      return json(res, 200, {
        ok: false, code: 'PARSE', error: 'Réponse Mistral non parsable.',
      });
    }
    return json(res, 200, { ok: true, result: parsed });
  } catch (err) {
    return json(res, 200, {
      ok: false,
      code: err.code || 'UNKNOWN',
      error: err.message || 'Erreur inconnue',
    });
  }
}
