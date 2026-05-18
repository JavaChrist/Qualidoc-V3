import { clampLevel } from '../../utils/format.js';
import { titleColor, COLORS } from '../../utils/theme.js';

/**
 * Table des matières automatique reproduisant le style UNITEP avec lignes
 * pointillées et numéros de page.
 *
 * Sections plates : la hiérarchie est portée par `section.level` (1/2/3) ;
 * la numérotation est précalculée dans `numberById` côté UnitepDocument
 * pour rester cohérente avec le rendu visible (mêmes numéros affichés
 * dans la TOC, dans le titre de section et dans l'arbre éditeur).
 */
export default function TableOfContents({ sections = [], pageMap = {}, numberById = {} }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{
        background: COLORS.tableHeaderBg, color: COLORS.tableHeaderText, padding: '4px 8px',
        fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase', marginBottom: '8pt',
      }}>
        Table des matières
      </div>

      {sections.map((s) => {
        const level = clampLevel(s.level);
        const number = numberById[s.id] || '';
        const page = pageMap[s.id] || '';
        // Reprise de la charte : niveau 1 en orange (et gras), niveaux 2/3
        // en gris foncé, comme dans les titres du corps du document.
        return (
          <TocLine
            key={s.id}
            label={`${number}. ${level === 3 ? (s.title || '') : (s.title?.toUpperCase() || '')}`}
            page={page}
            indent={level - 1}
            bold={level === 1}
            color={titleColor(level)}
          />
        );
      })}
    </div>
  );
}

function TocLine({ label, page, indent = 0, bold = false, color = '#000' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      paddingLeft: `${indent * 16}px`,
      fontSize: bold ? '10pt' : '9pt',
      fontWeight: bold ? 700 : 400,
      color,
      marginBottom: 2,
    }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        flex: 1,
        borderBottom: '1px dotted #888',
        margin: '0 4px',
        position: 'relative',
        top: '-3px',
      }} />
      <span>{page}</span>
    </div>
  );
}
