/**
 * Scraping de fiches techniques constructeur (Axis, Bosch, Genetec, Hikvision...).
 *
 * Stratégie :
 *  1. Si l'utilisateur fournit une URL directe, on la fetch via Puppeteer
 *     (déjà installé pour l'export PDF). Pas de service tiers.
 *  2. Sinon, on construit une recherche DuckDuckGo HTML (pas d'API key requise,
 *     pas de JavaScript nécessaire) pour trouver la page officielle.
 *  3. Le HTML brut est nettoyé (suppression scripts/styles/svg) puis tronqué
 *     pour respecter la fenêtre de contexte Mistral.
 *  4. Mistral extrait les champs structurés (cf. prompts.js).
 *
 * Toute la logique tourne dans le main process Electron pour éviter les
 * problèmes CORS et garder Puppeteer côté Node (cf. contextIsolation).
 */

import { SCRAPER_LIMITS } from './config.js';

const KNOWN_BRAND_HOSTS = {
  axis: 'axis.com',
  bosch: 'boschsecurity.com',
  genetec: 'genetec.com',
  hikvision: 'hikvision.com',
  dahua: 'dahuasecurity.com',
  hanwha: 'hanwhavisionamerica.com',
  pelco: 'pelco.com',
  vivotek: 'vivotek.com',
  milesight: 'milesight.com',
};

function brandHostHint(brand) {
  if (!brand) return null;
  const key = brand.toLowerCase().split(/\s|\//)[0];
  return KNOWN_BRAND_HOSTS[key] || null;
}

/**
 * Nettoie un HTML brut pour ne garder que le contenu textuellement utile à
 * Mistral (titre, paragraphes, listes, tableaux de specs). On garde une trace
 * minimale de la structure pour aider l'extraction.
 */
function cleanHtml(html, maxChars = SCRAPER_LIMITS.maxHtmlChars) {
  if (!html) return '';
  let h = String(html);

  h = h
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\s+(class|style|aria-[\w-]+|data-[\w-]+)="[^"]*"/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><');

  if (h.length > maxChars) h = h.slice(0, maxChars);
  return h;
}

async function getBrowser() {
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

/**
 * Récupère le HTML d'une page produit via Puppeteer (suit les redirections,
 * exécute le JS pour les pages SPA des constructeurs récents).
 */
export async function fetchProductPageHtml(url) {
  if (!url) throw new Error('URL produit manquante.');
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const t = req.resourceType();
      if (t === 'image' || t === 'media' || t === 'font') req.abort();
      else req.continue();
    });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_LIMITS.navigationTimeout,
    });
    const html = await page.content();
    const title = await page.title();
    return { url: page.url(), title, html: cleanHtml(html) };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Recherche DuckDuckGo HTML (pas de JS, pas d'API key). On retourne la
 * première URL pointant vers le domaine officiel du constructeur si on
 * en connaît un, sinon la première URL plausible.
 */
export async function searchProductUrl({ brand, model }) {
  if (!brand && !model) throw new Error('Marque ou modèle requis.');
  const query = encodeURIComponent(
    [brand, model, 'datasheet', 'specification'].filter(Boolean).join(' ')
  );
  const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;

  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_LIMITS.navigationTimeout,
    });

    const urls = await page.$$eval('a.result__a, a.result__url', (els) =>
      els
        .map((a) => a.getAttribute('href') || '')
        .filter((href) => href.startsWith('http'))
    );

    const officialHost = brandHostHint(brand);
    const preferred = officialHost
      ? urls.find((u) => u.toLowerCase().includes(officialHost))
      : null;

    return preferred || urls[0] || null;
  } finally {
    await browser.close().catch(() => {});
  }
}
