import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import UnitepHeader from './UnitepHeader.jsx';
import UnitepFooter from './UnitepFooter.jsx';
import CoverPage from './CoverPage.jsx';
import TableOfContents from './TableOfContents.jsx';
import { SectionRender } from './UnitepPage.jsx';
import { computeSectionNumbers } from '../../utils/format.js';

/**
 * Document UNITEP avec pagination basée sur la mesure DOM réelle.
 *
 * Approche en deux passes :
 *  1) Rendu invisible (offscreen) :
 *     - de toutes les sections empilées dans une zone de la même largeur que
 *       la zone utile A4 → on mesure la position cumulative (offsetTop) de
 *       chaque section, ce qui capture aussi les margins entre sections.
 *     - d'une page UNITEP vide → on mesure la hauteur utile RÉELLE
 *       disponible pour le contenu (entre la zone marginTop du content et la
 *       zone réservée au footer).
 *  2) Distribution séquentielle dans des pages : on remplit chaque page tant
 *     qu'il reste de la place, sans laisser de trou.
 */
export default function UnitepDocument({ document, scale = 1 }) {
  const sectionsRef = useRef(null);
  const samplePageRef = useRef(null);
  const sampleContentRef = useRef(null);
  const [heights, setHeights] = useState(null);
  const [usefulHeight, setUsefulHeight] = useState(800);

  // Numérotation hiérarchique précalculée : utilisée à la fois pour la zone
  // de mesure offscreen, la table des matières et le rendu visible — afin
  // que les trois vues affichent rigoureusement les mêmes numéros.
  const numbers = useMemo(
    () => computeSectionNumbers(document.sections || []),
    [document.sections]
  );
  const numberById = useMemo(() => {
    const m = {};
    numbers.forEach((n) => { m[n.id] = n.number; });
    return m;
  }, [numbers]);

  useLayoutEffect(() => {
    // Mesure réelle de la hauteur utile d'une page A4 vide
    if (samplePageRef.current && sampleContentRef.current) {
      const pageRect = samplePageRef.current.getBoundingClientRect();
      const contentRect = sampleContentRef.current.getBoundingClientRect();
      const offsetTop = contentRect.top - pageRect.top; // zone réservée au header
      const footerSafeArea = 18 * 3.78; // 18mm réservés en bas pour le footer
      const useful = pageRect.height - offsetTop - footerSafeArea;
      if (useful > 100) setUsefulHeight(useful);
    }

    // Mesure des sections : on prend offsetHeight (= hauteur de la box) qui
    // exclut les margins externes. Comme les wrappers ont display:flow-root,
    // les marges internes (h1 margin-top) restent dedans.
    if (sectionsRef.current) {
      const els = sectionsRef.current.querySelectorAll('[data-measure-section]');
      const map = {};
      els.forEach((el) => { map[el.dataset.measureSection] = el.offsetHeight; });
      setHeights(map);
    }
  }, [document]);

  const { groups, pageMap, totalPages } = useMemo(() => {
    if (!heights) {
      const groups = (document.sections || []).map((s) => [{ section: s, number: numberById[s.id] || '' }]);
      const pageMap = {};
      groups.forEach((g, idx) => g.forEach((it) => { pageMap[it.section.id] = 3 + idx; }));
      return { groups, pageMap, totalPages: 2 + groups.length };
    }
    return packPages(document, heights, usefulHeight, numberById);
  }, [document, heights, usefulHeight, numberById]);

  return (
    <>
      {/* ─── Zone de mesure offscreen ─── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-10000px',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Mesure de la hauteur utile d'une vraie page UNITEP rendue vide */}
        <div ref={samplePageRef} className="unitep-page" style={{ marginBottom: 0 }}>
          <div ref={sampleContentRef} className="unitep-page-content" style={{ marginTop: '12mm' }} />
        </div>

        {/* Mesure des hauteurs de section dans une zone identique à la zone utile */}
        <div
          ref={sectionsRef}
          style={{
            width: '170mm',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '10pt',
            lineHeight: 1.4,
          }}
        >
          {(document.sections || []).map((s) => (
            <div
              key={s.id}
              data-measure-section={s.id}
              style={{ display: 'flow-root' }} // empêche margin-collapse → mesure fidèle
            >
              <SectionRender section={s} number={numberById[s.id] || ''} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Rendu visible paginé ─── */}
      <div className="unitep-print-area" style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        paddingBottom: '40px',
      }}>
        <PageWrapper document={document} pageNumber={1} totalPages={totalPages} showLegal>
          <CoverPage document={document} />
        </PageWrapper>

        <PageWrapper document={document} pageNumber={2} totalPages={totalPages}>
          <TableOfContents sections={document.sections} pageMap={pageMap} numberById={numberById} />
        </PageWrapper>

        {groups.map((items, gi) => (
          <PageWrapper key={gi} document={document} pageNumber={3 + gi} totalPages={totalPages}>
            {items.map((item) => (
              <SectionRender key={item.section.id} section={item.section} number={item.number} />
            ))}
          </PageWrapper>
        ))}
      </div>
    </>
  );
}

function PageWrapper({ document, pageNumber, totalPages, showLegal, children }) {
  return (
    <div className="unitep-page" data-page={pageNumber}>
      <div style={{ position: 'absolute', top: '8mm', left: '20mm', right: '20mm' }}>
        <UnitepHeader document={document} currentPage={pageNumber} totalPages={totalPages} />
      </div>
      <div className="unitep-page-content" style={{ marginTop: '12mm' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', bottom: '8mm', left: '20mm', right: '20mm' }}>
        <UnitepFooter currentPage={pageNumber} totalPages={totalPages} showLegal={showLegal} />
      </div>
    </div>
  );
}

/**
 * Distribue les sections dans les pages : on les ajoute séquentiellement à la
 * page courante tant qu'on tient dans `usefulHeight`. Sinon on commence une
 * nouvelle page. Une marge de tolérance de 3% absorbe les imprécisions de
 * mesure (margin collapse, sub-pixel, fonts).
 */
function packPages(document, heights, usefulHeight, numberById) {
  // Marge confortable : on accepte jusqu'à +8% pour éviter les trous quand la
  // mesure offscreen diverge légèrement du rendu réel (font metrics, sub-pixel).
  const TOLERANCE = 1.08;
  const max = usefulHeight * TOLERANCE;

  const groups = [];
  let current = [];
  let currentH = 0;

  (document.sections || []).forEach((s) => {
    const item = { section: s, number: numberById[s.id] || '' };
    const h = heights[s.id] || 0;

    if (currentH > 0 && currentH + h > max) {
      groups.push(current);
      current = [item];
      currentH = h;
    } else {
      current.push(item);
      currentH += h;
    }
  });
  if (current.length) groups.push(current);

  const pageMap = {};
  groups.forEach((g, idx) => g.forEach((it) => { pageMap[it.section.id] = 3 + idx; }));

  return { groups, pageMap, totalPages: 2 + groups.length };
}
