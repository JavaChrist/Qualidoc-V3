import RevisionTable from './RevisionTable.jsx';
import { useSettingsStore } from '../../store/useSettingsStore.js';

const accessibilityRows = [
  { code: 'LIBRE', level: '(C=0)', desc: "L'information peut être rendue publique à l'intérieur et hors de l'entreprise" },
  { code: 'INTERNE', level: '(C=1)', desc: "L'information est destinée à être traitée au sein du périmètre de l'entreprise. Elle peut être partagée avec des externes dès lors que l'accès à cette information leur est nécessaire dans le cadre de leur relation avec l'entreprise." },
  { code: 'RESTREINT', level: '(C=2)', desc: "L'accès de l'information est limité à des personnes (internes ou externes à l'entreprise), fonctions ou à un périmètre restreint lié à une activité, une mission ou un projet (usage DOCTEAM : par commodité, il est possible de déclarer le document comme « Restreint UNITEP » directement depuis la FID ; tout autre périmètre de restriction est possible via le choix « Restreint » en association d'une diffusion plus ciblée)" },
  { code: 'CONFIDENTIEL', level: '(C=3)', desc: "L'information n'est destinée qu'à des personnes (internes/externes à l'entreprise) nommément désignées (C3 non admis DOCTEAM)" },
];

/**
 * Page de garde reproduisant fidèlement le gabarit UNITEP/EDF :
 *  - Division d'entreprise en texte simple (pas de bandeau coloré)
 *  - "Entité émettrice :" + logo UNITEP
 *  - Petit tableau (Résumé / Documents associés)
 *  - Champs "Type / Processus / Périmètre / Date" en texte simple
 *  - Tableau des indices (en-têtes gris clair)
 *  - Bloc d'accessibilité (texte, pas tableau)
 *  - Tableau de la liste de diffusion (en-têtes gris clair)
 */
export default function CoverPage({ document }) {
  const company = useSettingsStore((s) => s.company);
  const cover = document?.cover || {};
  const accessibility = cover.accessibility || 'INTERNE';
  const formattedAcc = accessibility.charAt(0) + accessibility.slice(1).toLowerCase();
  const logoUnitep = company?.logoSecondary;
  const isCompactType = (document?.type || '').length + (document?.title || '').length < 80;

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9.5pt', color: '#000', lineHeight: 1.35 }}>
      {/* Division : texte NOIR gras, sans trait — conformément au gabarit
          DTEAM-UNITEP de référence (pas de soulignement). */}
      {company?.division && (
        <div style={{
          fontWeight: 700,
          fontSize: '8pt',
          textTransform: 'uppercase',
          color: '#000',
          marginTop: '4pt',
          marginBottom: '10pt',
          letterSpacing: '0.2px',
        }}>
          {company.division}
        </div>
      )}

      {/* Entité émettrice + logo UNITEP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12pt', minHeight: '32px' }}>
        <span style={{ fontWeight: 600 }}>Entité émettrice :</span>
        {logoUnitep ? (
          <img src={logoUnitep} alt="UNITEP" style={{ maxHeight: '28px', objectFit: 'contain' }} />
        ) : (
          <span style={{ color: '#1E5AA8', fontWeight: 700, fontStyle: 'italic' }}>
            {cover.entity || 'UNITEP'}
          </span>
        )}
      </div>

      {/* Tableau résumé / documents associés */}
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={labelCell}>Résumé</td>
            <td style={valueCell}>{cover.summary || '\u00a0'}</td>
          </tr>
          <tr>
            <td style={labelCell}>Documents<br />associés</td>
            <td style={valueCell}>{cover.associatedDocs || '\u00a0'}</td>
          </tr>
        </tbody>
      </table>

      {/* Champs texte simple */}
      <div style={{ marginTop: '10pt', marginBottom: '10pt', lineHeight: 1.7 }}>
        <div><strong>Type :</strong> {isCompactType ? `${document?.type || ''} : ${document?.title || ''}` : (document?.type || '')}</div>
        <div><strong>Processus :</strong> {cover.process || ''}</div>
        <div><strong>Périmètre d'application :</strong> {cover.perimeter || ''}</div>
        <div><strong>Date d'applicabilité :</strong> {cover.applicabilityDate || ''}</div>
      </div>

      <RevisionTable indices={document?.indices || []} />

      {/* Accessibilité — texte */}
      <div style={{ marginTop: '14pt' }}>
        <div style={{
          background: 'transparent',
          border: '1px solid #000',
          padding: '4px 8px',
          fontWeight: 700,
          fontSize: '10pt',
          textAlign: 'center',
          marginBottom: '6pt',
        }}>
          Accessibilité du document : {formattedAcc}
        </div>
        <div style={{ fontSize: '7.5pt', lineHeight: 1.4 }}>
          {accessibilityRows.map((r) => {
            const isCurrent = accessibility.toUpperCase().startsWith(r.code);
            return (
              <div key={r.code} style={{
                marginBottom: '4pt',
                background: isCurrent ? '#FFF8E1' : 'transparent',
                padding: isCurrent ? '2pt 4pt' : '0',
              }}>
                <strong>{r.code}</strong> {r.level} {r.desc}
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste de diffusion */}
      <div style={{ marginTop: '12pt' }}>
        <div style={{
          background: 'transparent',
          border: '1px solid #000',
          padding: '4px 8px',
          fontWeight: 700,
          fontSize: '10pt',
          textAlign: 'center',
          marginBottom: 0,
          borderBottom: 'none',
        }}>
          Liste de diffusion <span style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '8pt' }}>(à remplir en cas de diffusion restreinte)</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, width: '50%' }}>
                Destinataire(s) {(company?.name || 'EDF').split(/[\s-]/)[0]} (Nom/Prénom/Entité)
              </th>
              <th style={{ ...headerCell, width: '50%' }}>
                Destinataire(s) externes {(company?.name || 'EDF').split(/[\s-]/)[0]} (Nom/Prénom/Société)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...valueCell, height: '40pt', whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>
                {cover.diffusionInternal || '\u00a0'}
              </td>
              <td style={{ ...valueCell, height: '40pt', whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>
                {cover.diffusionExternal || '\u00a0'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '9.5pt',
};

const labelCell = {
  border: '1px solid #000',
  background: 'transparent',
  fontWeight: 600,
  textAlign: 'center',
  width: '22%',
  padding: '8px 6px',
  verticalAlign: 'middle',
};

const valueCell = {
  border: '1px solid #000',
  padding: '8px 10px',
  whiteSpace: 'pre-wrap',
  verticalAlign: 'middle',
  background: 'transparent',
};

const headerCell = {
  border: '1px solid #000',
  background: 'transparent',
  padding: '4px 6px',
  fontWeight: 600,
  textAlign: 'center',
  fontSize: '9pt',
  color: '#000',
};
