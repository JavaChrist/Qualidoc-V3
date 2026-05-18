/**
 * Wrapper minimaliste autour de l'API Chat Completions Mistral (https://api.mistral.ai/v1).
 *
 * Pas de dépendance npm : on utilise fetch natif (Node 18+, Electron embarque
 * un Chromium/Node récent). Cela évite d'ajouter @mistralai/mistralai au bundle.
 *
 * Toute la logique réseau est confinée au processus principal Electron :
 *  - la clé API ne transite jamais par le renderer ;
 *  - le renderer demande l'IA via IPC (handlers ai:* dans main.js) ;
 *  - les erreurs réseau / API sont traduites en messages clairs côté UI.
 */

import {
  MISTRAL_API_KEY,
  MISTRAL_API_BASE,
  MISTRAL_MODELS,
  TIMEOUTS,
  isApiKeyConfigured,
} from './config.js';

class MistralError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'MistralError';
    this.status = status;
    this.code = code;
  }
}

function ensureKeyConfigured() {
  if (!isApiKeyConfigured()) {
    throw new MistralError(
      'Clé API Mistral non configurée. Contactez le support Qualidoc V3.',
      { code: 'NO_KEY' }
    );
  }
}

async function callChat({ model, messages, responseFormat, timeout, temperature }) {
  ensureKeyConfigured();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || TIMEOUTS.chat);

  let res;
  try {
    res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.2,
        max_tokens: 1500,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new MistralError('Délai dépassé lors de l\'appel Mistral.', { code: 'TIMEOUT' });
    }
    throw new MistralError(
      `Impossible de joindre api.mistral.ai (${err.message}). Vérifiez la connexion / le proxy.`,
      { code: 'NETWORK' }
    );
  }
  clearTimeout(timer);

  let body;
  try {
    body = await res.json();
  } catch {
    throw new MistralError(`Réponse Mistral invalide (HTTP ${res.status}).`, {
      status: res.status,
      code: 'BAD_RESPONSE',
    });
  }

  if (!res.ok) {
    const msg = body?.error?.message || body?.message || `Erreur HTTP ${res.status}`;
    throw new MistralError(msg, { status: res.status, code: body?.error?.code });
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new MistralError('Réponse Mistral vide.', { code: 'EMPTY' });
  }
  return content;
}

/**
 * Force un parsing JSON robuste : si Mistral encadre la réponse de ```json ... ```
 * ou ajoute une phrase, on extrait le premier objet JSON valide.
 */
function parseJsonResponse(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback : extraction du premier objet { ... } équilibré
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Analyse d'une capture d'écran + contexte produit/section.
 * Retourne un objet { action, title, noteSuggeree, etapeCritique } ou throw MistralError.
 */
export async function chatVision({ systemPrompt, userText, imageDataUrl }) {
  const content = await callChat({
    model: MISTRAL_MODELS.vision,
    timeout: TIMEOUTS.vision,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${systemPrompt}\n\n${userText || ''}`.trim() },
          { type: 'image_url', image_url: imageDataUrl },
        ],
      },
    ],
  });
  const parsed = parseJsonResponse(content);
  if (!parsed) {
    throw new MistralError('La réponse de Mistral n\'est pas un JSON valide.', { code: 'PARSE' });
  }
  return parsed;
}

/**
 * Extraction d'informations depuis un HTML constructeur.
 */
export async function chatExtractFromHtml({ systemPrompt, html }) {
  const content = await callChat({
    model: MISTRAL_MODELS.extraction,
    timeout: TIMEOUTS.chat,
    responseFormat: { type: 'json_object' },
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Contenu HTML de la page produit :\n\n${html}` },
    ],
  });
  const parsed = parseJsonResponse(content);
  if (!parsed) {
    throw new MistralError('Extraction Mistral : JSON invalide.', { code: 'PARSE' });
  }
  return parsed;
}

/**
 * Reformulation simple d'un texte au ton UNITEP.
 */
export async function chatReformulate({ systemPrompt, text }) {
  const content = await callChat({
    model: MISTRAL_MODELS.reformulation,
    timeout: TIMEOUTS.chat,
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
  });
  const parsed = parseJsonResponse(content);
  return parsed?.text || text;
}

/**
 * Test de connexion Mistral (utilisé par l'onglet Paramètres → IA).
 * Renvoie { ok: true, model } ou { ok: false, error, code }.
 */
export async function testConnection() {
  if (!isApiKeyConfigured()) {
    return { ok: false, code: 'NO_KEY', error: 'Clé API non configurée dans cette installation.' };
  }
  try {
    const content = await callChat({
      model: MISTRAL_MODELS.reformulation,
      timeout: 15_000,
      messages: [
        { role: 'user', content: 'Réponds uniquement par "OK".' },
      ],
    });
    return { ok: true, model: MISTRAL_MODELS.reformulation, sample: content?.slice(0, 32) };
  } catch (err) {
    return { ok: false, code: err.code || 'UNKNOWN', error: err.message };
  }
}

export { MistralError };
