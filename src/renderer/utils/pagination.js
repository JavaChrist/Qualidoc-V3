/**
 * Algorithme de pagination utilisé par l'export PDF (Puppeteer ne peut pas
 * mesurer le DOM côté renderer avant rendu, donc on garde une estimation
 * heuristique calibrée).
 *
 * Pour la preview, on utilise une mesure DOM réelle (cf. UnitepDocument.jsx).
 */

// A4 zone utile ≈ 247 mm de hauteur. Avec font 10pt × line-height 1.4,
// 1 ligne ≈ 4.8 mm → environ 51 lignes utiles par page.
// On vise un budget légèrement inférieur pour laisser du jeu (header décalé).
const PAGE_BUDGET = 950;

// Hauteurs unitaires (en "unités" virtuelles, ≈ pixels CSS)
const TITLE_H = 32;
const LINE_H = 14;
const STEP_HEADER_H = 24;       // ligne d'en-tête de tableau d'étapes (1 fois par section)
const STEP_BASE_H = 35;         // hauteur minimum d'une ligne d'étape (sans contenu)
const IMAGE_H = 200;            // hauteur d'une étape avec capture
const NOTE_H = 50;
const SUB_TITLE_H = 24;

/**
 * Estimation de la hauteur d'une section plate (titre + body éventuel +
 * tableau d'étapes éventuel) en respectant son contentType :
 *  - 'text-only'  : titre + body, pas de steps ;
 *  - 'steps-only' : titre + steps, pas de body ;
 *  - 'mixed'      : titre + body + steps.
 *
 * Les sections de niveau 2 et 3 utilisent un titre plus compact (SUB_TITLE_H).
 */
export function estimateSectionHeight(s) {
  const level = Math.max(1, Math.min(3, parseInt(s?.level, 10) || 1));
  const contentType = s?.contentType || 'mixed';
  const showBody = contentType !== 'steps-only';
  const showSteps = contentType !== 'text-only';

  let h = level === 1 ? TITLE_H : SUB_TITLE_H;

  if (showBody && s.body) {
    const lines = s.body.split('\n').length;
    h += Math.max(lines * LINE_H, Math.ceil(s.body.length / 90) * LINE_H);
  }

  if (showSteps && (s.steps || []).length > 0) {
    h += STEP_HEADER_H;
    (s.steps || []).forEach((st) => {
      const txt = `${st.description || ''}${st.action || ''}${st.expected || ''}`;
      const lines = txt.split('\n').length;
      const textH = Math.max(STEP_BASE_H, lines * LINE_H + 10);
      const imgH = st.image ? IMAGE_H : 0;
      h += Math.max(textH, imgH);
      if (st.note?.text) h += NOTE_H;
    });
  }

  return h;
}

/**
 * Distribue les sections dans des pages (groupes) de manière séquentielle.
 * Plusieurs petites sections peuvent partager la même page.
 *
 * @param {Object} document
 * @param {Object} [opts]
 * @param {Object<string,string>} [opts.numberById] - map id → numéro hiérarchique
 *   précalculé (1, 1.1, 1.1.1). Si omis, on retombe sur l'index + 1.
 */
export function paginate(document, opts = {}) {
  const groups = [];
  let current = [];
  let currentH = 0;
  const numberById = opts.numberById || {};

  (document.sections || []).forEach((s, i) => {
    const h = estimateSectionHeight(s);
    const item = { section: s, number: numberById[s.id] || `${i + 1}`, h };

    if (currentH > 0 && currentH + h > PAGE_BUDGET) {
      groups.push(current);
      current = [item];
      currentH = h;
    } else {
      current.push(item);
      currentH += h;
    }
  });
  if (current.length) groups.push(current);

  const pageMap = {};
  let pageNumber = 3;
  groups.forEach((group) => {
    group.forEach((it) => { pageMap[it.section.id] = pageNumber; });
    pageNumber += 1;
  });

  return { groups, pageMap, totalPages: 2 + groups.length };
}
