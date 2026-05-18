import StepNumber from './StepNumber.jsx';
import WarningBlock from './WarningBlock.jsx';
import { COLORS } from '../../utils/theme.js';
import { sanitizeHtml, isHtml } from '../../utils/richText.js';

/**
 * Rendu fidèle d'une étape technique au format UNITEP.
 *
 * Tableau adaptatif selon la mise en page choisie pour chaque étape :
 *  - layout 'mixed'      → 4 colonnes : N° | Action | Illustration | Check
 *  - layout 'text-only'  → 3 colonnes : N° | Action (pleine largeur) | Check
 *  - layout 'image-only' → 3 colonnes : N° | Illustration (pleine largeur) | Check
 *
 * La case à cocher de validation opérateur est toujours présente, comme
 * dans le gabarit EDF de référence.
 */
export default function StepPreview({ step, number }) {
  const layout = step.layout || 'mixed';
  // Rétrocompatibilité : si d'anciens documents ont action/expected, on les
  // concatène à la description pour ne rien perdre.
  const text = composeText(step);

  const numberCellStyle = {
    textAlign: 'center',
    verticalAlign: 'middle',
    fontWeight: 700,
    background: step.critical ? '#FFF8E1' : '#F4F6F8',
    borderLeft: step.critical ? '4px solid #FF6F00' : '1px solid #000',
    borderTop: '1px solid #000',
    borderRight: '1px solid #000',
    borderBottom: '1px solid #000',
    padding: 6,
  };
  const checkCellStyle = {
    textAlign: 'center',
    verticalAlign: 'middle',
    border: '1px solid #000',
    background: '#fff',
    padding: 4,
  };

  const textCell = (
    <td style={{ padding: '8pt 10pt', verticalAlign: 'top', border: '1px solid #000', fontSize: '9.5pt', lineHeight: 1.5 }}>
      <RichDescription text={text} />
      {step.note?.text && (
        <WarningBlock type={step.note.type || 'info'} text={step.note.text} compact />
      )}
    </td>
  );

  const imageCell = (
    <td style={{ padding: '6pt', verticalAlign: 'middle', textAlign: 'center', background: '#fff', border: '1px solid #000' }}>
      {step.image ? (
        <RenderImageWithAnnotations image={step.image} annotations={step.annotations} />
      ) : (
        <div style={{
          border: '1px dashed #C9D1DC',
          background: '#F9FAFB',
          color: '#9AA5B5',
          fontSize: '8pt',
          padding: '20pt 8pt',
          fontStyle: 'italic',
        }}>
          (Capture d'écran à insérer)
        </div>
      )}
    </td>
  );

  // Cellule fusionnée (colSpan=2) pour layouts text-only et image-only,
  // afin d'occuper la largeur Action+Illustration du gabarit UNITEP.
  const mergedTextCell = (
    <td colSpan={2} style={{ padding: '8pt 10pt', verticalAlign: 'top', border: '1px solid #000', fontSize: '9.5pt', lineHeight: 1.5 }}>
      <RichDescription text={text} />
      {step.note?.text && (
        <WarningBlock type={step.note.type || 'info'} text={step.note.text} compact />
      )}
    </td>
  );

  const mergedImageCell = (
    <td colSpan={2} style={{ padding: '6pt', verticalAlign: 'middle', textAlign: 'center', background: '#fff', border: '1px solid #000' }}>
      {step.image ? (
        <RenderImageWithAnnotations image={step.image} annotations={step.annotations} fullWidth />
      ) : (
        <div style={{
          border: '1px dashed #C9D1DC',
          background: '#F9FAFB',
          color: '#9AA5B5',
          fontSize: '8pt',
          padding: '20pt 8pt',
          fontStyle: 'italic',
        }}>
          (Capture d'écran à insérer)
        </div>
      )}
    </td>
  );

  let middleCells;
  if (layout === 'text-only') middleCells = mergedTextCell;
  else if (layout === 'image-only') middleCells = mergedImageCell;
  else middleCells = <>{textCell}{imageCell}</>;

  return (
    <div style={{ marginBottom: '6pt', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <table className="unitep-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '46%' }} />
          <col style={{ width: '42%' }} />
          <col style={{ width: '6%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={numberCellStyle}>
              <StepNumber n={number} critical={step.critical} size="sm" />
            </td>
            {middleCells}
            <td style={checkCellStyle}>
              <div style={{
                width: 14, height: 14,
                border: '1.5px solid #000',
                margin: '0 auto',
                background: '#fff',
              }} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * En-tête de tableau d'étapes (à afficher avant la première étape d'une section).
 * Reproduit la ligne "ACTION A REALISER | ILLUSTRATION" du gabarit UNITEP.
 */
export function StepTableHeader() {
  const th = {
    // Charte EDF : en-têtes de tableaux en bleu marine + texte blanc.
    background: COLORS.tableHeaderBg,
    color: COLORS.tableHeaderText,
    fontWeight: 700,
    padding: '4px 6px',
    textAlign: 'center',
    fontSize: '9.5pt',
    border: '1px solid #000',
  };
  return (
    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '-1px' }}>
      <colgroup>
        <col style={{ width: '6%' }} />
        <col style={{ width: '46%' }} />
        <col style={{ width: '42%' }} />
        <col style={{ width: '6%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={th}>&nbsp;</th>
          <th style={th}>ACTION À RÉALISER</th>
          <th style={th}>ILLUSTRATION</th>
          <th style={th}>&nbsp;</th>
        </tr>
      </thead>
    </table>
  );
}

function composeText(step) {
  // Si description est en rich text (HTML), on convertit aussi les champs
  // legacy en HTML pour éviter de casser le rendu sanitizeHtml ; sinon on
  // fait un simple join \n comme avant.
  const hasHtmlDesc = isHtml(step.description);
  if (!hasHtmlDesc) {
    const parts = [];
    if (step.description) parts.push(step.description);
    if (step.action) parts.push(step.action);
    if (step.expected) parts.push(`Résultat attendu : ${step.expected}`);
    return parts.join('\n');
  }
  const esc = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const parts = [step.description];
  if (step.action) parts.push(`<p>${esc(step.action).replaceAll('\n', '<br>')}</p>`);
  if (step.expected) parts.push(`<p>Résultat attendu : ${esc(step.expected).replaceAll('\n', '<br>')}</p>`);
  return parts.join('');
}

/**
 * Rendu de la description (rich text ou texte brut). On passe par
 * sanitizeHtml pour autoriser les balises de mise en forme tout en
 * conservant le respect des retours à la ligne pour le contenu hérité.
 */
function RichDescription({ text }) {
  if (!text) return null;
  return (
    <div
      style={{ whiteSpace: isHtml(text) ? 'normal' : 'pre-wrap' }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
    />
  );
}

function RenderImageWithAnnotations({ image, annotations = [], fullWidth = false }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <img
        src={image}
        alt=""
        style={{
          maxWidth: '100%',
          maxHeight: fullWidth ? '260pt' : '180pt',
          display: 'block',
          border: '1px solid #C9D1DC',
        }}
      />
      {annotations.length > 0 && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {annotations.map((a, i) => <Annotation key={a.id || i} a={a} />)}
        </svg>
      )}
    </div>
  );
}

function Annotation({ a }) {
  const stroke = a.color || '#FF0000';
  const sw = 3;
  switch (a.type) {
    case 'rect':
      return <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="none" stroke={stroke} strokeWidth={sw} />;
    case 'circle':
      return <ellipse cx={a.x + a.w / 2} cy={a.y + a.h / 2} rx={Math.abs(a.w / 2)} ry={Math.abs(a.h / 2)} fill="none" stroke={stroke} strokeWidth={sw} />;
    case 'arrow': {
      const dx = a.x2 - a.x1;
      const dy = a.y2 - a.y1;
      const angle = Math.atan2(dy, dx);
      const head = 24;
      const ax = a.x2 - head * Math.cos(angle - Math.PI / 7);
      const ay = a.y2 - head * Math.sin(angle - Math.PI / 7);
      const bx = a.x2 - head * Math.cos(angle + Math.PI / 7);
      const by = a.y2 - head * Math.sin(angle + Math.PI / 7);
      return (
        <g>
          <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={sw} />
          <polygon points={`${a.x2},${a.y2} ${ax},${ay} ${bx},${by}`} fill={stroke} />
        </g>
      );
    }
    case 'number':
      return (
        <g>
          <circle cx={a.x} cy={a.y} r={20} fill={stroke} />
          <text x={a.x} y={a.y + 6} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial">
            {a.text}
          </text>
        </g>
      );
    case 'text':
      return (
        <text x={a.x} y={a.y} fontSize="20" fill={stroke} fontFamily="Arial" fontWeight="bold">
          {a.text}
        </text>
      );
    case 'highlight':
      return <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={stroke} fillOpacity={0.35} />;
    default:
      return null;
  }
}
