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

// On détecte à la fois une balise HTML (<b>, <span>...) ET une entité HTML
// (&amp;, &#39;...). Sans la détection d'entité, un contenu déjà encodé une
// fois (par ex. `test&#39;`) serait considéré comme texte brut et ré-encodé
// en `test&amp;#39;` à chaque cycle d'édition → boucle de double-encoding
// qui fait sauter le curseur et empile les entités.
const HTML_PROBE = /<\/?[a-z][^>]*>|&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;

/** Vrai si la chaîne contient au moins une balise ou entité HTML. */
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
const SHORT_COLOR_RE = /^#[0-9a-fA-F]{3}$/;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i;
const SIZE_RE = /^(\d{1,2})pt$/;

/**
 * Normalise une couleur CSS (#RGB, #RRGGBB, rgb(r,g,b), rgba(...)) en
 * `#RRGGBB`. Retourne null si la valeur n'est pas reconnue.
 */
function normalizeColor(value) {
  if (!value) return null;
  const v = value.trim();
  if (COLOR_RE.test(v)) return v.toUpperCase();
  if (SHORT_COLOR_RE.test(v)) {
    // #abc → #aabbcc
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  }
  const m = v.match(RGB_RE);
  if (m) {
    const hex = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`.toUpperCase();
  }
  return null;
}

/**
 * Nettoie l'attribut `style` pour ne garder que `color` (en #RRGGBB) et
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
    if (prop === 'color') {
      const hex = normalizeColor(val);
      if (hex) kept.push(`color: ${hex}`);
    } else if (prop === 'font-size' && SIZE_RE.test(val)) {
      kept.push(`font-size: ${val}`);
    }
  }
  return kept.join('; ');
}

/**
 * Renvoie une version "safe" de l'HTML, exploitable par
 * `dangerouslySetInnerHTML` et l'export DOCX.
 *
 * Le résultat est **idempotent** : sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x).
 * On passe toujours par DOMParser (jamais par escapeHtml direct) : c'est
 * lui qui sait gérer à la fois le texte brut et l'HTML, et son
 * `innerHTML` ne ré-encode que `<`, `>`, `&` — les apostrophes restent
 * intactes, ce qui supprime le risque de double-encoding.
 */
export function sanitizeHtml(content) {
  if (!content) return '';
  // On préserve les sauts de ligne du texte brut en les convertissant en
  // <br> avant parsing. Pour le reste, le DOMParser interprète tout le
  // texte tel quel — il ré-encodera ce qu'il faut au moment de innerHTML.
  const html = String(content).replaceAll('\n', '<br>');
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

    // <font color="..." size="..."> est généré par document.execCommand
    // ('foreColor'/'fontSize') en mode legacy. On le convertit en
    // <span style="color: ...; font-size: ..."> qui est dans la whitelist
    // et exporté correctement vers DOCX.
    if (tag === 'FONT') {
      const span = node.ownerDocument.createElement('span');
      const styleParts = [];
      const color = child.getAttribute('color');
      const hex = normalizeColor(color);
      if (hex) styleParts.push(`color: ${hex}`);
      // Les attributs `size` legacy ("1".."7") ne sont pas mappés en pt
      // de manière fiable, on les ignore. Si l'utilisateur a utilisé notre
      // dropdown, la taille a été appliquée via <span style="font-size:...">.
      if (styleParts.length > 0) span.setAttribute('style', styleParts.join('; '));
      while (child.firstChild) span.appendChild(child.firstChild);
      node.replaceChild(span, child);
      walkSanitize(span);
      continue;
    }

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
    // Un <span> sans style utile n'apporte rien : on l'aplatit pour
    // éviter d'accumuler des wrappers vides au fil des éditions.
    if (tag === 'SPAN' && !child.getAttribute('style')) {
      while (child.firstChild) node.insertBefore(child.firstChild, child);
      child.remove();
      continue;
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
  // Idem `sanitizeHtml` : DOMParser systématique, pas de re-escape (qui
  // doublait les entités sur chaque cycle de sauvegarde). Les <br> sont
  // insérés pour les sauts de ligne du texte brut.
  const html = String(content).replaceAll('\n', '<br>');
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
    // <font color="..."> legacy → on récupère quand même la couleur, au
    // cas où un vieux contenu non sanitizé arrive ici (sécurité ceinture-bretelles).
    if (tag === 'FONT') {
      const hex = normalizeColor(node.getAttribute('color'));
      if (hex) s.color = hex.slice(1).toUpperCase();
    }
    if (tag === 'SPAN' && node.getAttribute('style')) {
      const decls = node.getAttribute('style').split(';');
      for (const d of decls) {
        const [k, v] = d.split(':').map((x) => (x || '').trim());
        if (k === 'color') {
          const hex = normalizeColor(v);
          // docx attend la couleur sans le `#`.
          if (hex) s.color = hex.slice(1).toUpperCase();
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
