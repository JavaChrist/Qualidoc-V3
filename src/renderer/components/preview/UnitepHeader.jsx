import { useSettingsStore } from '../../store/useSettingsStore.js';

/**
 * En-tête UNITEP/EDF — reproduction exacte du gabarit officiel.
 *
 * Structure :
 *  - Ligne supérieure (hors tableau) : "Document DTEAM-UNITEP" à gauche,
 *    "Accessibilité : Interne" à droite
 *  - Tableau 3 colonnes :
 *      • Col 1 (logo eDF) — rowspan 2
 *      • Col 2 (Titre gras / Référence) — sur 2 lignes
 *      • Col 3 (Indice / Nb Pages / Nb Annexes) — rowspan 2
 */
export default function UnitepHeader({ document, currentPage = 1, totalPages = 1, accessibility, annexCount }) {
  const company = useSettingsStore((s) => s.company);
  const logo = company?.logo;
  const lastIndex = document?.indices?.[document.indices.length - 1];
  const acc = accessibility || document?.cover?.accessibility || 'Interne';
  const formattedAcc = acc.charAt(0).toUpperCase() + acc.slice(1).toLowerCase();
  const annex = annexCount ?? document?.annexCount ?? 0;

  const cellStyle = {
    border: '1px solid #000',
    padding: '4px 6px',
    background: '#fff',
    fontSize: '8.5pt',
    verticalAlign: 'middle',
  };

  return (
    <div className="unitep-header w-full" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Ligne supérieure hors tableau */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '8.5pt',
        marginBottom: '2px',
        padding: '0 2px',
      }}>
        <span>Document DTEAM-UNITEP</span>
        <span>Accessibilité : {formattedAcc}</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '52%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td rowSpan={2} style={{ ...cellStyle, textAlign: 'center', padding: '6px' }}>
              {logo ? (
                <img
                  src={logo}
                  alt="Logo"
                  style={{ maxHeight: '52px', maxWidth: '90%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                />
              ) : (
                <div style={{ color: '#FF6F00', fontWeight: 800, fontSize: '24pt', letterSpacing: '0.5px' }}>
                  eDF
                </div>
              )}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, fontSize: '11pt', lineHeight: 1.2 }}>
              {document?.title || 'Titre du document'}
            </td>
            <td rowSpan={2} style={{ ...cellStyle, fontSize: '9pt', lineHeight: 1.5 }}>
              <div><strong>Indice :</strong> {lastIndex?.letter || 'A'}</div>
              <div><strong>Nb Pages :</strong> {totalPages}</div>
              <div><strong>Nb Annexe(s) :</strong> {annex}</div>
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8pt' }}>
              <strong>Référence :</strong> {document?.reference || '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
