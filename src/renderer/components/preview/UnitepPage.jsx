import StepPreview, { StepTableHeader } from './StepPreview.jsx';
import { clampLevel } from '../../utils/format.js';
import { titleColor } from '../../utils/theme.js';
import { sanitizeHtml } from '../../utils/richText.js';

/**
 * Page complète UNITEP : header + zone contenu + footer.
 * Utilisée à la fois par la prévisualisation et par l'export PDF.
 */
export default function UnitepPage({ children, pageNumber, totalPages, document, header, footer, accessibility }) {
  return (
    <div className="unitep-page" data-page={pageNumber}>
      <div style={{ position: 'absolute', top: '6mm', left: '6mm', right: '6mm' }}>
        {header}
      </div>
      <div className="unitep-page-content" style={{ marginTop: '14mm' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', bottom: '6mm', left: '6mm', right: '6mm' }}>
        {footer}
      </div>
    </div>
  );
}

/**
 * Rendu d'une section dans la preview / export PDF.
 *
 * Le numéro hiérarchique (1, 1.1, 1.1.1) est passé en prop `number` —
 * calculé en amont par computeSectionNumbers() pour garder la cohérence
 * avec l'arborescence éditeur et la table des matières.
 *
 * Le niveau pilote :
 *   - le style typographique (h1/h2/h3)
 *   - l'indentation horizontale ;
 *   - la décision d'afficher ou non le tableau d'étapes (contentType).
 */
// Largeur en pourcentage selon le réglage utilisateur pour un bloc image.
const IMAGE_WIDTH_PERCENT = {
  full: '100%',
  large: '75%',
  medium: '50%',
  small: '33%',
};

export function SectionRender({ section, number }) {
  const level = clampLevel(section.level);
  const contentType = section.contentType || 'mixed';
  const showBlocks = contentType !== 'steps-only';
  const showSteps = contentType !== 'text-only' && (section.steps || []).length > 0;

  const HeadingTag = level === 1 ? 'h2' : 'h3';
  const headingClass = level === 1 ? 'unitep-h1' : 'unitep-h2';
  const titleStyle = {
    fontSize: level === 1 ? '11pt' : level === 2 ? '10.5pt' : '10pt',
    fontWeight: 700,
    textTransform: level === 3 ? 'none' : 'uppercase',
    marginTop: level === 1 ? '12pt' : '8pt',
    marginBottom: '4pt',
    // Charte EDF/UNITEP : niveau 1 en orange, niveaux 2 et 3 en gris foncé.
    color: titleColor(level),
  };

  // Indentation horizontale pour bien marquer la hiérarchie visuelle dans
  // la preview, sans modifier la zone utile A4 (on indente le contenu
  // intérieur d'une section niveau 2 et 3, pas le tableau d'étapes pour
  // éviter de casser le gabarit UNITEP des étapes).
  const wrapperStyle = {
    marginBottom: '8pt',
    paddingLeft: level === 2 ? '4mm' : level === 3 ? '8mm' : 0,
  };

  // Compatibilité descendante : si la section n'a pas de blocs mais un body
  // texte (cas non encore migré), on génère un bloc texte unique à la volée.
  const blocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks
    : (section.body
        ? [{ id: 'legacy-body', kind: 'text', content: section.body }]
        : []);

  return (
    <div style={wrapperStyle}>
      <HeadingTag className={headingClass} style={titleStyle}>
        {number ? `${number}. ` : ''}
        {level === 3 ? (section.title || '') : (section.title?.toUpperCase() || '')}
      </HeadingTag>
      {showBlocks && blocks.map((b) => (
        <BlockRender key={b.id} block={b} />
      ))}
      {showSteps && (
        <div style={{ marginTop: 8 }}>
          <StepTableHeader />
          {section.steps.map((step, si) => (
            <StepPreview key={step.id} step={step} number={si + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Rendu d'un bloc de contenu de section :
 *  - 'text'  : paragraphe justifié, taille UNITEP standard
 *  - 'image' : image en pleine largeur (ou réduite selon `width`), centrée,
 *              avec légende optionnelle en italique dessous
 */
function BlockRender({ block }) {
  if (block.kind === 'text') {
    if (!block.content) return null;
    // Rendu rich text : on autorise gras/italique/souligné/taille/couleur
    // grâce à sanitizeHtml, qui gère aussi le cas du texte brut hérité.
    return (
      <div
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: '10pt',
          lineHeight: 1.45,
          textAlign: 'justify',
          marginBottom: 6,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
      />
    );
  }
  if (block.kind === 'image') {
    if (!block.image) return null;
    const widthPct = IMAGE_WIDTH_PERCENT[block.width || 'full'];
    return (
      <div style={{
        textAlign: 'center',
        margin: '8pt 0',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      }}>
        <img
          src={block.image}
          alt=""
          style={{
            width: widthPct,
            maxWidth: '100%',
            height: 'auto',
            display: 'inline-block',
            border: '1px solid #C9D1DC',
          }}
        />
        {block.caption && (
          <div style={{
            fontSize: '9pt',
            fontStyle: 'italic',
            color: '#444',
            marginTop: '3pt',
            textAlign: 'center',
          }}>
            {block.caption}
          </div>
        )}
      </div>
    );
  }
  return null;
}
