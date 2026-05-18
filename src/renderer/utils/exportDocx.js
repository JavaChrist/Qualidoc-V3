import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, ImageRun, Media, TableOfContents,
  PageBreak, LevelFormat, convertInchesToTwip, NumberFormat,
  HeightRule, VerticalAlign,
} from 'docx';
import { computeSectionNumbers, clampLevel } from './format.js';
import { COLORS, titleColorHex } from './theme.js';
import { richTextToParagraphs } from './richText.js';

const NAVY = '003366';
const STEP = 'FF6F00';
// En-tête bleu marine pour les tableaux d'étapes (charte EDF).
const TABLE_HEADER_BG = COLORS.tableHeaderBgHex;
const TABLE_HEADER_TX = COLORS.tableHeaderTextHex;
const WARN_BG = 'FFF3CD';
const WARN_BD = 'FFC107';
const INFO_BG = 'D1ECF1';
const INFO_BD = '17A2B8';
const DANGER_BG = 'F8D7DA';
const DANGER_BD = 'DC3545';
const STEP_BG = 'FFF8E1';

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const blackBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const allBlackBorders = {
  top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder,
  insideHorizontal: blackBorder, insideVertical: blackBorder,
};

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl) return null;
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function tx(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: 'Arial', ...opts });
}

function p(children, opts = {}) {
  const arr = Array.isArray(children) ? children : [children];
  return new Paragraph({
    spacing: { before: 60, after: 60, ...(opts.spacing || {}) },
    ...opts,
    children: arr.map((c) => typeof c === 'string' ? tx(c) : c),
  });
}

/**
 * Construit une liste de Paragraph docx à partir d'un contenu rich text
 * (HTML restreint produit par RichTextEditor) ou d'un texte brut.
 *
 * - Chaque "paragraphe logique" (séparé par <br>, <p> ou <div>) devient
 *   un `new Paragraph(...)` avec ses runs typés.
 * - Si la conversion ne donne rien (contenu vide), un paragraphe vide
 *   est renvoyé pour conserver la mise en page Word existante.
 * - `defaultRun` permet d'imposer une taille / police par défaut quand
 *   l'utilisateur n'a rien spécifié (ex: 20 half-pt = 10pt pour les blocs
 *   texte de section, 18 = 9pt pour la cellule "ACTION" des étapes).
 */
function paragraphsFromRichText(content, paragraphOpts = {}, defaultRun = {}) {
  const groups = richTextToParagraphs(content);
  if (groups.length === 0) {
    return [new Paragraph({ ...paragraphOpts, children: [tx(' ', defaultRun)] })];
  }
  return groups.map((runs) => new Paragraph({
    ...paragraphOpts,
    children: runs.map((r) => {
      const opts = { ...defaultRun };
      if (r.bold) opts.bold = true;
      if (r.italics) opts.italics = true;
      if (r.underline) opts.underline = {};
      if (r.strike) opts.strike = true;
      if (r.color) opts.color = r.color;
      // r.size est en pt, docx attend des half-points => * 2
      if (r.size) opts.size = r.size * 2;
      return tx(r.text, opts);
    }),
  }));
}

function shadedCell({ color, children, width, vertical = VerticalAlign.TOP, rowSpan, columnSpan }) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: color ? { type: ShadingType.SOLID, color, fill: color } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: vertical,
    rowSpan, columnSpan,
    children: Array.isArray(children) ? children : [children],
  });
}

/* ─── Header / Footer ─── */

function buildHeader(doc, settings) {
  const company = settings.company;
  const lastIndex = doc.indices?.[doc.indices.length - 1];
  const logoBuf = company?.logo ? dataUrlToBuffer(company.logo) : null;
  const acc = doc.cover?.accessibility || 'Interne';
  const accFormatted = acc.charAt(0).toUpperCase() + acc.slice(1).toLowerCase();
  const annexCount = doc.annexCount || 0;

  // Logo cell (rowspan 2)
  const logoCell = shadedCell({
    width: 22,
    vertical: VerticalAlign.CENTER,
    rowSpan: 2,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoBuf
          ? [new ImageRun({ data: logoBuf, transformation: { width: 90, height: 45 } })]
          : [tx('eDF', { color: STEP, bold: true, size: 36 })],
      }),
    ],
  });

  // Title cell (1st row of middle column)
  const titleCell = shadedCell({
    width: 52,
    vertical: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [tx(doc.title || '', { bold: true, size: 22 })],
      }),
    ],
  });

  // Indice / Nb Pages / Nb Annexes cell (rowspan 2)
  const indCell = shadedCell({
    width: 26,
    rowSpan: 2,
    children: [
      new Paragraph({ children: [tx('Indice : ', { bold: true, size: 18 }), tx(lastIndex?.letter || 'A', { size: 18 })] }),
      new Paragraph({
        children: [
          tx('Nb Pages : ', { bold: true, size: 18 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18 }),
        ],
      }),
      new Paragraph({
        children: [tx('Nb Annexe(s) : ', { bold: true, size: 18 }), tx(String(annexCount), { size: 18 })],
      }),
    ],
  });

  // Référence (2nd row of middle column)
  const refCell = shadedCell({
    width: 52,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [tx('Référence : ', { bold: true, size: 16 }), tx(doc.reference || '—', { size: 16 })],
      }),
    ],
  });

  // Top text row above table
  const topRow = new Paragraph({
    spacing: { before: 0, after: 40 },
    tabStops: [{ type: 'right', position: 9000 }],
    children: [
      tx('Document DTEAM-UNITEP', { size: 17 }),
      new TextRun({ text: '\t', font: 'Arial' }),
      tx(`Accessibilité : ${accFormatted}`, { size: 17 }),
    ],
  });

  return new Header({
    children: [
      topRow,
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: allBlackBorders,
        rows: [
          new TableRow({ children: [logoCell, titleCell, indCell] }),
          new TableRow({ children: [refCell] }),
        ],
      }),
    ],
  });
}

function buildFooter(settings, isCover = false) {
  const c = settings.company;
  if (isCover) {
    return new Footer({
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(c?.name || 'EDF', { bold: true, size: 14 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(c?.address || '', { size: 14 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(c?.legalLine || '', { italics: true, size: 12 })] }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            tx('Page ', { bold: true, size: 14 }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14 }),
            tx(' / ', { size: 14 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 14 }),
          ],
        }),
      ],
    });
  }
  return new Footer({
    children: [
      new Paragraph({ children: [tx(`Copyright ${(c?.name || 'EDF').split(' ')[0]}`, { bold: true, size: 14 })] }),
      new Paragraph({ children: [tx(c?.copyright?.replace(/^Copyright\s+\S+\s*-?\s*/i, '') || "Ce document est la propriété d'EDF...", { italics: true, size: 12 })] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          tx('Page ', { bold: true, size: 14 }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14 }),
          tx(' / ', { size: 14 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 14 }),
        ],
      }),
    ],
  });
}

/* ─── Page de garde ─── */

function buildCoverPage(doc, settings) {
  const c = settings.company;
  const cover = doc.cover || {};
  const blocks = [];
  const acc = cover.accessibility || 'INTERNE';
  const accFormatted = acc.charAt(0) + acc.slice(1).toLowerCase();

  // Division : texte NOIR gras, sans trait — conformément au gabarit
  // DTEAM-UNITEP de référence.
  if (c?.division) {
    blocks.push(new Paragraph({
      children: [tx(c.division.toUpperCase(), { bold: true, size: 17, color: '000000' })],
      spacing: { before: 100, after: 200 },
    }));
  }

  // Entité émettrice + logo UNITEP
  const logoUnitepBuf = c?.logoSecondary ? dataUrlToBuffer(c.logoSecondary) : null;
  blocks.push(new Paragraph({
    spacing: { before: 100, after: 200 },
    children: [
      tx('Entité émettrice : ', { bold: true, size: 19 }),
      ...(logoUnitepBuf
        ? [new ImageRun({ data: logoUnitepBuf, transformation: { width: 90, height: 28 } })]
        : [tx(cover.entity || 'UNITEP', { bold: true, italics: true, color: '1E5AA8', size: 19 })]),
    ],
  }));

  // Tableau cover (Résumé + Documents associés)
  const coverRows = [
    ['Résumé', cover.summary],
    ['Documents associés', cover.associatedDocs],
  ];
  blocks.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBlackBorders,
    rows: coverRows.map(([label, value]) => new TableRow({
      children: [
        // Fond transparent comme la prévisualisation (gabarit UNITEP).
        shadedCell({
          width: 22,
          vertical: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(label, { bold: true, size: 19 })] })],
        }),
        shadedCell({
          width: 78,
          vertical: VerticalAlign.CENTER,
          children: [p(tx(value || ' ', { size: 19 }))],
        }),
      ],
    })),
  }));

  // Champs texte simple
  const textFields = [
    ['Type', `${doc.type || ''}${doc.title ? ' : ' + doc.title : ''}`],
    ['Processus', cover.process || ''],
    ["Périmètre d'application", cover.perimeter || ''],
    ["Date d'applicabilité", cover.applicabilityDate || ''],
  ];
  blocks.push(new Paragraph({ children: [tx(' ', { size: 16 })], spacing: { before: 120 } }));
  textFields.forEach(([label, value]) => {
    blocks.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [tx(`${label} : `, { bold: true, size: 19 }), tx(value, { size: 19 })],
    }));
  });

  // Espace avant le tableau d'indices (la consigne italique est désormais
  // intégrée au tableau lui-même, cf. buildRevisionTable).
  blocks.push(new Paragraph({ children: [tx(' ', { size: 12 })], spacing: { before: 100 } }));

  blocks.push(buildRevisionTable(doc.indices || []));

  // Accessibilité : bandeau encadré, fond transparent (gabarit UNITEP).
  blocks.push(new Paragraph({
    border: {
      top: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      left: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      right: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
    },
    alignment: AlignmentType.CENTER,
    children: [tx(`Accessibilité du document : ${accFormatted}`, { bold: true, size: 20 })],
    spacing: { before: 240, after: 120 },
  }));

  const accRows = [
    ['LIBRE', '(C=0)', "L'information peut être rendue publique à l'intérieur et hors de l'entreprise"],
    ['INTERNE', '(C=1)', "L'information est destinée à être traitée au sein du périmètre de l'entreprise. Elle peut être partagée avec des externes dès lors que l'accès à cette information leur est nécessaire dans le cadre de leur relation avec l'entreprise."],
    ['RESTREINT', '(C=2)', "L'accès de l'information est limité à des personnes (internes ou externes à l'entreprise), fonctions ou à un périmètre restreint lié à une activité, une mission ou un projet (usage DOCTEAM : par commodité, il est possible de déclarer le document comme « Restreint UNITEP » directement depuis la FID ; tout autre périmètre de restriction est possible via le choix « Restreint » en association d'une diffusion plus ciblée)"],
    ['CONFIDENTIEL', '(C=3)', "L'information n'est destinée qu'à des personnes (internes/externes à l'entreprise) nommément désignées (C3 non admis DOCTEAM)"],
  ];
  accRows.forEach(([code, level, desc]) => {
    const current = acc.toUpperCase().startsWith(code);
    blocks.push(new Paragraph({
      shading: current ? { type: ShadingType.SOLID, color: STEP_BG, fill: STEP_BG } : undefined,
      spacing: { before: 40, after: 40 },
      children: [
        tx(code, { bold: true, size: 15 }),
        tx(` ${level} ${desc}`, { size: 15 }),
      ],
    }));
  });

  // Liste de diffusion : bandeau encadré, fond transparent.
  blocks.push(new Paragraph({
    border: {
      top: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      left: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
      right: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 4 },
    },
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 0 },
    children: [
      tx('Liste de diffusion ', { bold: true, size: 20 }),
      tx('(à remplir en cas de diffusion restreinte)', { italics: true, size: 16 }),
    ],
  }));
  const orgPrefix = (c?.name || 'EDF').split(/[\s-]/)[0];
  blocks.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBlackBorders,
    rows: [
      new TableRow({
        children: [
          // En-têtes Destinataire : fond transparent (gabarit UNITEP).
          shadedCell({ width: 50, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(`Destinataire(s) ${orgPrefix} (Nom/Prénom/Entité)`, { bold: true, size: 17 })] })] }),
          shadedCell({ width: 50, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(`Destinataire(s) externes ${orgPrefix} (Nom/Prénom/Société)`, { bold: true, size: 17 })] })] }),
        ],
      }),
      new TableRow({
        height: { value: 800, rule: HeightRule.ATLEAST },
        children: [
          shadedCell({ children: [p(tx(cover.diffusionInternal || ' ', { size: 17 }))] }),
          shadedCell({ children: [p(tx(cover.diffusionExternal || ' ', { size: 17 }))] }),
        ],
      }),
    ],
  }));

  blocks.push(new Paragraph({ children: [new PageBreak()] }));
  return blocks;
}

// Rouge "signature" UNITEP — équivalent du Rouge foncé Word standard.
const SIGN_RED = 'C00000';

function buildRevisionTable(indices) {
  const headers = ['Ind.', 'Date', 'Nature des dernières évolutions', 'Rédacteur(s)', 'Vérificateur(s)', 'Approbateur'];
  const widths = [6, 12, 40, 14, 14, 14];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBlackBorders,
    rows: [
      // 1) En-tête (fond transparent, gabarit UNITEP)
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => shadedCell({
          width: widths[i],
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(h, { bold: true, color: '000000', size: 16 })] })],
        })),
      }),
      // 2) Ligne italique de consigne (colspan = 6), fond transparent
      new TableRow({
        children: [
          shadedCell({
            columnSpan: 6,
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [tx("Veillez à conserver les informations liées à l'indice A (création) + informations des deux derniers indices", { italics: true, size: 14 })],
            })],
          }),
        ],
      }),
      // 3) Lignes d'indices — Rédacteur / Vérificateur / Approbateur en ROUGE gras
      ...indices.map((r) => new TableRow({
        children: [
          shadedCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(r.letter, { bold: true, size: 16 })] })] }),
          shadedCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(r.date, { size: 16 })] })] }),
          shadedCell({ children: [p(tx(r.nature, { size: 16 }))] }),
          shadedCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(r.writer, { bold: true, color: SIGN_RED, size: 16 })] })] }),
          shadedCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(r.verifier, { bold: true, color: SIGN_RED, size: 16 })] })] }),
          shadedCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(r.approver, { bold: true, color: SIGN_RED, size: 16 })] })] }),
        ],
      })),
    ],
  });
}

/* ─── Sections + étapes (hiérarchie 3 niveaux) ─── */

// Largeur cible en EMU (1pt = 12700 EMU) pour les blocs image pleine page.
// Page A4 zone utile ≈ 17 cm = ~482 pt → 480 pt en 'full', diminué selon le réglage.
const BLOCK_IMAGE_WIDTH_PT = {
  full: 480,
  large: 360,
  medium: 240,
  small: 160,
};

/**
 * Rend un bloc de contenu de section Word :
 *  - 'text'  : paragraphes justifiés (un par retour à la ligne)
 *  - 'image' : ImageRun centré (avec largeur configurable) + légende italique
 *
 * Les dimensions de l'image sont estimées par rapport à un ratio 4/3 en
 * largeur réelle, ce qui évite des distortions tout en conservant un visuel
 * proche du gabarit UNITEP papier.
 */
function buildBlock(block) {
  const out = [];
  if (block.kind === 'text') {
    if (!block.content) return out;
    // Rich text (gras/italique/souligné/taille/couleur) ou texte brut.
    // Taille par défaut 20 half-pt = 10pt pour les paragraphes de section.
    const paras = paragraphsFromRichText(
      block.content,
      { alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 60 } },
      { size: 20 },
    );
    out.push(...paras);
    return out;
  }
  if (block.kind === 'image') {
    const buf = block.image ? dataUrlToBuffer(block.image) : null;
    if (!buf) return out;
    const widthPt = BLOCK_IMAGE_WIDTH_PT[block.width || 'full'] || BLOCK_IMAGE_WIDTH_PT.full;
    // Conversion pt → pixels docx (1pt ≈ 1.333 px), ratio 4/3 en hauteur par défaut.
    const widthPx = Math.round(widthPt * 1.333);
    const heightPx = Math.round(widthPx * 0.55); // un peu plus aplati pour les schémas
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ data: buf, transformation: { width: widthPx, height: heightPx } })],
    }));
    if (block.caption) {
      out.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [tx(block.caption, { italics: true, size: 18, color: '444444' })],
      }));
    }
    return out;
  }
  return out;
}

/**
 * Rend une section Word selon son niveau (1/2/3) :
 *  - Heading Word approprié pour que la table des matières native fonctionne ;
 *  - Numéro hiérarchique préfixé au titre (ex: "2.2.1") ;
 *  - Blocs (texte/image) affichés si contentType ≠ 'steps-only' ;
 *  - Tableau Action/Illustration affiché si contentType ≠ 'text-only' et
 *    s'il y a au moins une étape.
 */
function buildSection(section, number) {
  const out = [];
  const level = clampLevel(section.level);
  const contentType = section.contentType || 'mixed';
  const showBlocks = contentType !== 'steps-only';
  const showSteps = contentType !== 'text-only' && (section.steps || []).length > 0;

  const heading = level === 1 ? HeadingLevel.HEADING_1
    : level === 2 ? HeadingLevel.HEADING_2
    : HeadingLevel.HEADING_3;

  // Taille de titre en "half-points" Word :
  //  niveau 1 = 24 (12pt), niveau 2 = 22 (11pt), niveau 3 = 21 (10.5pt).
  const titleSize = level === 1 ? 24 : level === 2 ? 22 : 21;
  const titleText = level === 3
    ? (section.title || '')
    : (section.title || '').toUpperCase();

  out.push(new Paragraph({
    heading,
    spacing: {
      before: level === 1 ? 240 : level === 2 ? 200 : 160,
      after: level === 1 ? 120 : 80,
    },
    children: [tx(`${number}. ${titleText}`, {
      bold: true,
      size: titleSize,
      // Charte EDF/UNITEP : niveau 1 en orange, niveaux 2/3 en gris foncé.
      color: titleColorHex(level),
    })],
  }));

  if (showBlocks) {
    // Compatibilité descendante : si la section n'a pas encore migré (pas
    // de blocks[]) mais possède l'ancien `body`, on l'expose comme un bloc
    // texte unique pour conserver le contenu existant à l'export.
    const blocks = Array.isArray(section.blocks) && section.blocks.length > 0
      ? section.blocks
      : (section.body ? [{ kind: 'text', content: section.body }] : []);
    blocks.forEach((b) => {
      out.push(...buildBlock(b));
    });
  }
  if (showSteps) {
    out.push(buildStepsTable(section.steps));
  }
  return out;
}

/**
 * Concatène les champs texte d'une étape pour l'export, en respectant le
 * rich text de `description` (HTML) tout en restant compatible avec les
 * anciens champs `action`/`expected` (texte brut).
 *
 * Si `description` contient du HTML, les éventuels champs legacy sont
 * convertis en HTML eux-mêmes avant concaténation pour éviter de mélanger
 * deux formats incompatibles côté DOMParser.
 */
function composeStepText(step) {
  const hasHtmlDesc = typeof step.description === 'string' && /<\/?[a-z][^>]*>/i.test(step.description);
  if (!hasHtmlDesc) {
    const parts = [];
    if (step.description) parts.push(step.description);
    if (step.action) parts.push(step.action);
    if (step.expected) parts.push(`Résultat attendu : ${step.expected}`);
    return parts.join('\n');
  }
  const parts = [step.description];
  const escape = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  if (step.action) parts.push(`<p>${escape(step.action).replaceAll('\n', '<br>')}</p>`);
  if (step.expected) parts.push(`<p>Résultat attendu : ${escape(step.expected).replaceAll('\n', '<br>')}</p>`);
  return parts.join('');
}

/**
 * Tableau d'étapes au format UNITEP : header (ACTION/ILLUSTRATION) + N lignes.
 *
 * Chaque ligne est construite selon `step.layout` :
 *  - 'mixed'      → N° | Texte | Illustration | Check     (4 cellules)
 *  - 'text-only'  → N° | Texte (columnSpan=2) | Check     (3 cellules)
 *  - 'image-only' → N° | Illustration (columnSpan=2) | Check (3 cellules)
 *
 * La case à cocher de validation opérateur est toujours présente.
 */
function buildStepsTable(steps) {
  // En-tête bleu marine EDF + texte blanc (charte UNITEP).
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      shadedCell({ width: 6, color: TABLE_HEADER_BG, children: [p(tx(' ', { bold: true, size: 18, color: TABLE_HEADER_TX }))] }),
      shadedCell({ width: 46, color: TABLE_HEADER_BG, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx('ACTION À RÉALISER', { bold: true, size: 18, color: TABLE_HEADER_TX })] })] }),
      shadedCell({ width: 42, color: TABLE_HEADER_BG, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx('ILLUSTRATION', { bold: true, size: 18, color: TABLE_HEADER_TX })] })] }),
      shadedCell({ width: 6, color: TABLE_HEADER_BG, children: [p(tx(' ', { bold: true, size: 18, color: TABLE_HEADER_TX }))] }),
    ],
  });

  const rows = steps.map((step, si) => {
    const num = si + 1;
    const layout = step.layout || 'mixed';
    const imgBuf = step.image ? dataUrlToBuffer(step.image) : null;
    const text = composeStepText(step);

    // Description de l'étape : rich text supporté (description) +
    // rétrocompat action/expected (texte brut). Taille de base 18 half-pt = 9pt.
    const textParas = paragraphsFromRichText(text, { spacing: { before: 40, after: 40 } }, { size: 18 });

    if (step.note?.text) {
      const labels = { info: 'NOTE', warning: 'ATTENTION', danger: 'DANGER' };
      const bgs = { info: INFO_BG, warning: WARN_BG, danger: DANGER_BG };
      textParas.push(new Paragraph({
        shading: { type: ShadingType.SOLID, color: bgs[step.note.type] || INFO_BG, fill: bgs[step.note.type] || INFO_BG },
        children: [tx(`${labels[step.note.type] || 'NOTE'} : `, { bold: true, size: 18 }), tx(step.note.text, { size: 18 })],
        spacing: { before: 80, after: 80 },
      }));
    }

    // Pour les étapes 'image-only', l'illustration peut prendre toute la
    // largeur (Action+Illustration) : on agrandit l'image pour ne pas
    // garder un visuel ridiculement étroit dans une ligne pleine largeur.
    const imgDimensions = layout === 'image-only'
      ? { width: 480, height: 280 }
      : { width: 240, height: 160 };
    const imgPara = imgBuf
      ? new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: imgBuf, transformation: imgDimensions })],
        })
      : p(tx("(Capture d'écran)", { italics: true, color: '9AA5B5', size: 16 }), { alignment: AlignmentType.CENTER });

    // Case à cocher Word : caractère vide encadré (rendu via texte ☐)
    const checkbox = p(tx('☐', { size: 28 }), { alignment: AlignmentType.CENTER });

    const numCell = shadedCell({
      width: 6,
      color: step.critical ? STEP_BG : 'F4F6F8',
      vertical: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [tx(String(num), { bold: true, color: step.critical ? STEP : NAVY, size: 22 })] })],
    });
    const checkCell = shadedCell({ width: 6, vertical: VerticalAlign.CENTER, children: [checkbox] });

    let middleCells;
    if (layout === 'text-only') {
      middleCells = [shadedCell({ width: 88, columnSpan: 2, children: textParas })];
    } else if (layout === 'image-only') {
      middleCells = [shadedCell({ width: 88, columnSpan: 2, vertical: VerticalAlign.CENTER, children: [imgPara] })];
    } else {
      middleCells = [
        shadedCell({ width: 46, children: textParas }),
        shadedCell({ width: 42, vertical: VerticalAlign.CENTER, children: [imgPara] }),
      ];
    }

    return new TableRow({
      cantSplit: true,
      children: [numCell, ...middleCells, checkCell],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBlackBorders,
    rows: [headerRow, ...rows],
  });
}

/* ─── Document principal ─── */

export async function buildDocx(doc, settings) {
  const document = new Document({
    creator: settings.company?.name || 'UNITEP',
    title: doc.title,
    description: doc.cover?.summary || doc.title,
    // Force Word à recalculer les champs (table des matières, n° de pages,
    // PageNumber.TOTAL_PAGES…) à l'ouverture du document. Sans ce flag,
    // la TOC affiche "1" partout tant que l'utilisateur n'a pas fait
    // "Clic droit → Mettre à jour les champs".
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
      paragraphStyles: [
        // Heading 1 = orange EDF, Heading 2 et 3 = gris foncé (charte UNITEP).
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', quickFormat: true, run: { font: 'Arial', size: 24, bold: true, color: COLORS.titleLevel1Hex }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', quickFormat: true, run: { font: 'Arial', size: 22, bold: true, color: COLORS.titleLevel2Hex }, paragraph: { spacing: { before: 200, after: 80 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', quickFormat: true, run: { font: 'Arial', size: 21, bold: true, color: COLORS.titleLevel3Hex }, paragraph: { spacing: { before: 160, after: 80 } } },
      ],
    },
    sections: [
      // Page de garde
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 2200, bottom: 1800, left: 1300, right: 1300, header: 400, footer: 400 },
          },
        },
        headers: { default: buildHeader(doc, settings) },
        footers: { default: buildFooter(settings, true) },
        children: buildCoverPage(doc, settings),
      },
      // Corps + TOC
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 2200, bottom: 1800, left: 1300, right: 1300, header: 400, footer: 400 },
          },
        },
        headers: { default: buildHeader(doc, settings) },
        footers: { default: buildFooter(settings, false) },
        children: [
          new Paragraph({
            shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
            children: [tx('Table des matières', { bold: true, color: 'FFFFFF', size: 22 })],
            spacing: { before: 100, after: 240 },
          }),
          new TableOfContents('Sommaire', {
            hyperlink: true,
            headingStyleRange: '1-3',
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...((() => {
            const nums = computeSectionNumbers(doc.sections || []);
            return (doc.sections || []).flatMap((s, i) => buildSection(s, nums[i]?.number || `${i + 1}`));
          })()),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  return blob;
}
