/**
 * Mini-client Mistral partagé entre toutes les fonctions serverless Vercel
 * (`api/ai/*.js`). Aucune dépendance npm, on s'appuie sur `fetch` natif Node 18+.
 *
 * La clé API est lue depuis `process.env.MISTRAL_API_KEY` (à définir dans
 * les variables d'environnement du projet Vercel). Elle n'est JAMAIS
 * renvoyée au client : le front parle uniquement à `/api/ai/*`, jamais
 * directement à `api.mistral.ai`.
 */

export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
export const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

export const MISTRAL_MODELS = {
  vision: 'pixtral-12b-2409',
  extraction: 'mistral-large-latest',
  reformulation: 'mistral-small-latest',
};

export const TIMEOUTS = {
  chat: 60_000,
  vision: 90_000,
};

export function isApiKeyConfigured() {
  return typeof MISTRAL_API_KEY === 'string' && MISTRAL_API_KEY.length > 20;
}

/**
 * Lit le body JSON d'une requête HTTP serverless (Vercel n'auto-parse pas
 * toujours selon le runtime). Renvoie {} si le body est vide ou invalide.
 */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Active CORS pour les appels depuis l'app Vite déployée sur Vercel
 * (même origine en général) et depuis localhost en dev.
 */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Helper pour répondre en JSON avec un statut HTTP donné.
 */
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * Appel générique vers l'endpoint chat completions de Mistral.
 * Retourne le contenu texte du premier choice, ou jette une erreur
 * normalisée { ok: false, code, error, status }.
 */
export async function callChat({ model, messages, responseFormat, timeout, temperature }) {
  if (!isApiKeyConfigured()) {
    const err = new Error('Clé MISTRAL_API_KEY absente des variables d\'environnement Vercel.');
    err.code = 'NO_KEY';
    throw err;
  }
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
    const e = new Error(
      err.name === 'AbortError'
        ? 'Délai dépassé lors de l\'appel Mistral.'
        : `Impossible de joindre api.mistral.ai (${err.message}).`,
    );
    e.code = err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    throw e;
  }
  clearTimeout(timer);

  let body;
  try { body = await res.json(); } catch {
    const e = new Error(`Réponse Mistral invalide (HTTP ${res.status}).`);
    e.code = 'BAD_RESPONSE'; e.status = res.status; throw e;
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || `Erreur HTTP ${res.status}`;
    const e = new Error(msg);
    e.code = body?.error?.code || 'HTTP_ERROR';
    e.status = res.status;
    throw e;
  }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    const e = new Error('Réponse Mistral vide.');
    e.code = 'EMPTY';
    throw e;
  }
  return content;
}

/** Parsing JSON tolérant (extrait le premier { ... } équilibré si bavardage). */
export function parseJsonResponse(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {
    const s = trimmed.indexOf('{');
    const e = trimmed.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { return JSON.parse(trimmed.slice(s, e + 1)); } catch { return null; }
    }
    return null;
  }
}

/**
 * Prompt système Vision (généralisé). Doit rester aligné avec
 * `src/main/ai/prompts.js`/buildVisionPrompt côté Electron.
 */
export function buildVisionPrompt({ brand, model, sectionTitle, docType }) {
  const ctx = [];
  if (brand) ctx.push(`Marque : ${brand}`);
  if (model) ctx.push(`Modèle : ${model}`);
  if (sectionTitle) ctx.push(`Section en cours : ${sectionTitle}`);
  if (docType) ctx.push(`Type de document : ${docType}`);
  const ctxStr = ctx.length ? `Contexte :\n${ctx.join('\n')}\n\n` : '';

  return `Tu es un assistant de rédaction technique pour des procédures EDF/UNITEP.
Style attendu :
- Phrases courtes, ton procédural et direct.
- Verbes d'action à l'impératif présent (Cliquer, Saisir, Vérifier, Cocher, Sélectionner...).
- Aucune politesse, pas de commentaire personnel.
- Une action = une ligne, préfixée par un tiret "-".
- Mettre les libellés exacts des BOUTONS et MENUS entre crochets, ex : [Maintenance].

${ctxStr}À partir de la capture d'écran fournie de l'interface de configuration, génère UNIQUEMENT le libellé de l'action à réaliser par l'opérateur.

Tu DOIS répondre par un objet JSON STRICT au format suivant (sans backticks, sans bavardage) :
{
  "action": "string — 1 à 4 lignes maximum, chaque ligne préfixée par '- '",
  "title": "string — titre court de l'étape (3-6 mots) ou null",
  "etapeCritique": "boolean",
  "noteSuggeree": { "type": "info|warning|danger", "text": "string" } | null
}

Règles :
- "etapeCritique" = true uniquement si l'action est irréversible ou impacte la disponibilité du système.
- "title" doit refléter l'écran visible, pas l'action (ex: "Onglet Maintenance", "Configuration IP").`;
}

/**
 * Prompt système Reformulation (généralisé), aligné avec
 * `src/main/ai/prompts.js`/buildReformulationPrompt.
 */
export function buildReformulationPrompt() {
  return `Tu es un assistant de rédaction technique pour des procédures EDF/UNITEP.
Reformule le texte fourni au ton UNITEP (procédural, impératif, sans politesse).
Réponds UNIQUEMENT par un objet JSON { "text": "..." } sans bavardage.`;
}
