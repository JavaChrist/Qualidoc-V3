/**
 * Utilitaires pour le rich text minimal supporté par Qualidoc V3.
 *
 * Pour rester compatible avec l'export DOCX et le rendu PDF, on n'autorise
 * qu'une whitelist de balises et d'attributs très restreinte :
 *
 *  - Mise en forme inline : <b>, <strong>, <i>, <em>, <u>, <s>, <span>
 *  - Sauts de ligne : <br>
 *  - Paragraphes : <p>, <div> (convertis en sauts de ligne à l'export)
 *  - Attributs sur <span> : style="color: #RRGGBB" et style="font-size: Xpt"
 *
 * Tout le reste (scripts, liens, classes, autres attributs) est strippé pour
 * éviter toute injection et garantir un rendu déterministe.
 *
 * Les contenus saisis dans des `<textarea>` avant l'ajout du rich text
 * (sans aucune balise HTML) restent supportés : ils sont rendus tels quels,
 * avec respect des retours à la ligne, à la fois dans la preview et le DOCX.
 */

// ─── Détection texte brut vs HTML ─────────────────────────────────────────

const HTML_PROBE = /<\/?[a-z][^>]*>/i;

/** Vrai si la chaîne contient au moins une balise HTML. */
export function isHtml(content) {
  return typeof content === 'string' && HTML_PROBE.test(content);
}

/** Échappe les caractères spéciaux HTML pour un affichage texte brut. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ─── Sanitization (côté preview) ───────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'BR', 'P', 'DIV',
]);

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const SIZE_RE = /^(\d{1,2})pt$/;

/**
 * Nettoie l'attribut `style` pour ne garder que `color` (en hex) et
 * `font-size` (en pt). Tout autre style est supprimé.
 */
function sanitizeStyle(style) {
  if (!style) return '';
  const decls = style.split(';').map((d) => d.trim()).filter(Boolean);
  const kept = [];
  for (const decl of decls) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (prop === 'color' && COLOR_RE.test(val)) {
      kept.push(`color: ${val.toUpperCase()}`);
    } else if (prop === 'font-size' && SIZE_RE.test(val)) {
      kept.push(`font-size: ${val}`);
    }
  }
  return kept.join('; ');
}

/** Renvoie une version "safe" de l'HTML, exploitable par dangerouslySetInnerHTML. */
export function sanitizeHtml(html) {
  if (!html) return '';
  if (!isHtml(html)) {
    // Texte brut : on échappe et on respecte les retours à la ligne.
    return escapeHtml(html).replaceAll('\n', '<br>');
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  walkSanitize(root);
  return root.innerHTML;
}

function walkSanitize(node) {
  // On itère sur une copie, car on peut remplacer des enfants au passage.
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const tag = child.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      // On remplace par ses enfants (on garde le texte).
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      child.remove();
      continue;
    }
    // On enlève tous les attributs sauf `style` (lui-même nettoyé) pour
    // <span>. Pour les autres balises on dégage tout (pas besoin de classes).
    const attrs = Array.from(child.attributes);
    for (const a of attrs) {
      if (tag === 'SPAN' && a.name === 'style') {
        const safe = sanitizeStyle(a.value);
        if (safe) child.setAttribute('style', safe);
        else child.removeAttribute('style');
      } else {
        child.removeAttribute(a.name);
      }
    }
    walkSanitize(child);
  }
}

// ─── Conversion vers runs DOCX ────────────────────────────────────────────

/**
 * Convertit du rich text (HTML restreint) en une liste de paragraphes
 * formatés pour docx.js. Chaque paragraphe contient une liste de runs avec
 * les attributs `{ text, bold, italics, underline, color, size }`.
 *
 * Les blocs <p>/<div> et les <br> introduisent un nouveau paragraphe.
 *
 * Le résultat est volontairement un objet "plain" pour rester découplé
 * de la lib docx — c'est exportDocx.js qui convertit en TextRun/Paragraph.
 */
export function richTextToParagraphs(content) {
  if (!content) return [];
  const html = isHtml(content)
    ? content
    : escapeHtml(content).replaceAll('\n', '<br>');
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const paragraphs = [];
  let current = [];

  const pushParagraph = () => {
    paragraphs.push(current);
    current = [];
  };

  const visit = (node, style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      if (text) current.push({ text, ...style });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;

    if (tag === 'BR') {
      pushParagraph();
      return;
    }
    if (tag === 'P' || tag === 'DIV') {
      // Si on a déjà du contenu dans le paragraphe courant, on le ferme
      // avant d'ouvrir celui-ci pour éviter des paragraphes vides intempestifs.
      if (current.length > 0) pushParagraph();
      node.childNodes.forEach((c) => visit(c, style));
      pushParagraph();
      return;
    }

    let s = { ...style };
    if (tag === 'B' || tag === 'STRONG') s.bold = true;
    if (tag === 'I' || tag === 'EM') s.italics = true;
    if (tag === 'U') s.underline = true;
    if (tag === 'S') s.strike = true;
    if (tag === 'SPAN' && node.getAttribute('style')) {
      const decls = node.getAttribute('style').split(';');
      for (const d of decls) {
        const [k, v] = d.split(':').map((x) => (x || '').trim());
        if (k === 'color' && COLOR_RE.test(v)) {
          // docx attend la couleur sans le `#`.
          s.color = v.slice(1).toUpperCase();
        } else if (k === 'font-size') {
          const m = v.match(SIZE_RE);
          if (m) s.size = parseInt(m[1], 10); // en pt, on convertira en half-pt
        }
      }
    }

    node.childNodes.forEach((c) => visit(c, s));
  };

  root.childNodes.forEach((c) => visit(c, {}));
  if (current.length > 0) pushParagraph();
  return paragraphs.filter((para) => para.length > 0);
}

/**
 * Extrait le texte brut d'un contenu rich text (utile pour des recherches,
 * des prévisualisations courtes, l'envoi à l'IA, etc.).
 */
export function richTextToPlain(content) {
  if (!content) return '';
  if (!isHtml(content)) return content;
  const doc = new DOMParser().parseFromString(`<div>${content}</div>`, 'text/html');
  return doc.body.textContent || '';
}
