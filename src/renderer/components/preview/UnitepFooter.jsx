import { useSettingsStore } from '../../store/useSettingsStore.js';

export default function UnitepFooter({ currentPage = 1, totalPages = 1, showLegal = false }) {
  const company = useSettingsStore((s) => s.company);

  return (
    <div className="unitep-footer w-full" style={{ fontFamily: 'Arial, sans-serif', fontSize: '7.5pt', color: '#000' }}>
      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
        {showLegal ? (
          <>
            <div style={{ textAlign: 'center', fontWeight: 600 }}>
              {company?.name || 'EDF - DPNT - DTEAM - UNITEP'}
            </div>
            <div style={{ textAlign: 'center' }}>
              {company?.address || '300 Avenue du Prado - immeuble Prado 13800 MARSEILLE'}
            </div>
            {company?.legalLine && (
              <div style={{ textAlign: 'center', marginTop: '3px', fontSize: '6.5pt', fontStyle: 'italic' }}>
                {company.legalLine}
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: '2px', fontWeight: 600 }}>
              Page {currentPage} / {totalPages}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700 }}>Copyright {(company?.name || 'EDF').split(' ')[0]}</div>
            <div style={{ fontSize: '7pt', fontStyle: 'italic' }}>
              {company?.copyright?.replace(/^Copyright\s+\S+\s*-?\s*/i, '') ||
                "Ce document est la propriété d'EDF. Toute communication, reproduction, publication, même partielle, est interdite sauf autorisation écrite."}
            </div>
            <div style={{ textAlign: 'right', marginTop: '2px', fontWeight: 600 }}>
              Page {currentPage} / {totalPages}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
