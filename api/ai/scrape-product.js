import { setCors, json } from '../_lib.js';

/**
 * POST /api/ai/scrape-product
 *
 * Le scraping repose sur Puppeteer + un Chromium headless. Ce stack n'est
 * pas embarquable dans une serverless function Vercel standard (binaire
 * Chromium > taille limite de bundle).
 *
 * On répond donc explicitement par 503 SCRAPING_DISABLED côté front, qui
 * affichera un message clair et masquera le bouton "Récupérer les infos
 * en ligne" en mode web. La fonctionnalité reste disponible dans l'app
 * Electron desktop.
 */
export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  return json(res, 200, {
    ok: false,
    code: 'SCRAPING_DISABLED',
    error: "Le scraping constructeur n'est disponible que dans l'application Qualidoc V3 desktop.",
  });
}
