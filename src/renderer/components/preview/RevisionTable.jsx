/**
 * Tableau des indices de révision — gabarit UNITEP/EDF.
 *
 * Détails conformes au modèle de référence :
 *  - En-têtes : fond gris clair (#E7E6E6), texte noir, gras
 *  - Sous l'en-tête, une ligne italique (colspan=6) rappelle aux rédacteurs
 *    quels indices conserver (création + 2 derniers).
 *  - Les colonnes Rédacteur / Vérificateur / Approbateur sont en ROUGE,
 *    signature visuelle imposée par le gabarit DTEAM-UNITEP.
 */
// Rouge "signature" du gabarit UNITEP (équivalent du Word "Rouge foncé").
const SIGN_RED = '#C00000';

export default function RevisionTable({ indices = [] }) {
  const rows = indices.length ? indices : [{ letter: 'A', date: '', nature: '', writer: '', verifier: '', approver: '' }];

  const th = {
    border: '1px solid #000',
    background: 'transparent',
    color: '#000',
    fontWeight: 700,
    padding: '4px 6px',
    fontSize: '8.5pt',
    textAlign: 'center',
  };
  const td = {
    border: '1px solid #000',
    padding: '4px 6px',
    fontSize: '8.5pt',
    background: 'transparent',
    textAlign: 'center',
    verticalAlign: 'middle',
  };
  const signCell = {
    ...td,
    color: SIGN_RED,
    fontWeight: 700,
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={{ ...th, width: '6%' }}>Ind.</th>
          <th style={{ ...th, width: '12%' }}>Date</th>
          <th style={{ ...th, width: '40%' }}>Nature des dernières évolutions</th>
          <th style={{ ...th, width: '14%' }}>Rédacteur(s)</th>
          <th style={{ ...th, width: '14%' }}>Vérificateur(s)</th>
          <th style={{ ...th, width: '14%' }}>Approbateur</th>
        </tr>
      </thead>
      <tbody>
        {/* Ligne de consigne (intégrée au tableau comme dans le gabarit). */}
        <tr>
          <td
            colSpan={6}
            style={{
              ...td,
              fontStyle: 'italic',
              fontSize: '8pt',
              padding: '3px 6px',
            }}
          >
            Veillez à conserver les informations liées à l'indice A (création) + informations des deux derniers indices
          </td>
        </tr>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...td, fontWeight: 700 }}>{r.letter}</td>
            <td style={td}>{r.date}</td>
            <td style={{ ...td, textAlign: 'left' }}>{r.nature}</td>
            <td style={signCell}>{r.writer}</td>
            <td style={signCell}>{r.verifier}</td>
            <td style={signCell}>{r.approver}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
