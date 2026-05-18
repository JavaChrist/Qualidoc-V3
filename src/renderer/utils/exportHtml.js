/**
 * Génération HTML autonome pour l'export PDF via Puppeteer.
 * Reproduit le gabarit UNITEP avec header/footer répétés sur chaque page.
 * Plusieurs sections peuvent se regrouper sur une même page selon leur
 * taille (algorithme partagé avec la preview).
 */
import { paginate } from './pagination.js';
import { computeSectionNumbers, clampLevel } from './format.js';

const COLORS = {
  navy: '#003366',
  black: '#000000',
  grayHeader: '#E7E6E6',
  warningBg: '#FFF3CD', warningBorder: '#FFC107',
  infoBg: '#D1ECF1', infoBorder: '#17A2B8',
  dangerBg: '#F8D7DA', dangerBorder: '#DC3545',
  stepBg: '#FFF8E1', stepBorder: '#FF6F00',
};

function escape(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nl2br(s) {
  return escape(s).replace(/\n/g, '<br/>');
}

export function buildExportHtml(doc, settings) {
  const company = settings.company;
  const lastIndex = doc.indices?.[doc.indices.length - 1];

  // Numérotation hiérarchique précalculée (1 / 1.1 / 1.1.1), partagée par
  // le sommaire et le corps du document pour garantir la cohérence.
  const nums = computeSectionNumbers(doc.sections || []);
  const numberById = {};
  nums.forEach((n) => { numberById[n.id] = n.number; });

  const { groups, pageMap, totalPages } = paginate(doc, { numberById });
  const annexCount = doc.annexCount || 0;
  const acc = doc.cover?.accessibility || 'Interne';
  const accFormatted = acc.charAt(0).toUpperCase() + acc.slice(1).toLowerCase();

  const headerHtml = () => `
    <div class="up-header">
      <div class="up-h-toprow">
        <span>Document DTEAM-UNITEP</span>
        <span>Accessibilité : ${escape(accFormatted)}</span>
      </div>
      <table>
        <colgroup>
          <col style="width:22%"/><col style="width:52%"/><col style="width:26%"/>
        </colgroup>
        <tr>
          <td rowspan="2" class="up-h-logo">
            ${company?.logo ? `<img src="${company.logo}" />` : `<div class="up-logo-edf">eDF</div>`}
          </td>
          <td class="up-h-title">${escape(doc.title)}</td>
          <td rowspan="2" class="up-h-meta">
            <div><strong>Indice :</strong> ${escape(lastIndex?.letter || 'A')}</div>
            <div><strong>Nb Pages :</strong> ${totalPages}</div>
            <div><strong>Nb Annexe(s) :</strong> ${annexCount}</div>
          </td>
        </tr>
        <tr>
          <td class="up-h-ref"><strong>Référence :</strong> ${escape(doc.reference || '—')}</td>
        </tr>
      </table>
    </div>`;

  const footerHtml = (currentPage, isCover) => isCover ? `
    <div class="up-footer">
      <div class="up-f-name">${escape(company?.name || 'EDF — UNITEP')}</div>
      <div class="up-f-addr">${escape(company?.address || '')}</div>
      ${company?.legalLine ? `<div class="up-f-legal">${escape(company.legalLine)}</div>` : ''}
      <div class="up-f-page">Page ${currentPage} / ${totalPages}</div>
    </div>` : `
    <div class="up-footer">
      <div class="up-f-cr"><strong>Copyright ${escape((company?.name || 'EDF').split(' ')[0])}</strong></div>
      <div class="up-f-cr-text">${escape(company?.copyright?.replace(/^Copyright\s+\S+\s*-?\s*/i, '') || "Ce document est la propriété d'EDF...")}</div>
      <div class="up-f-page">Page ${currentPage} / ${totalPages}</div>
    </div>`;

  const coverPage = `
    <div class="up-page">
      ${headerHtml()}
      <div class="up-content">
        ${company?.division ? `<div class="up-division">${escape(company.division)}</div>` : ''}

        <div class="up-entity-row">
          <span class="up-entity-label">Entité émettrice :</span>
          ${company?.logoSecondary
            ? `<img src="${company.logoSecondary}" class="up-entity-logo" />`
            : `<span class="up-entity-text">${escape(doc.cover?.entity || 'UNITEP')}</span>`}
        </div>

        <table class="up-cover-table">
          <tr>
            <td class="up-cover-label">Résumé</td>
            <td class="up-cover-value">${escape(doc.cover?.summary || '\u00a0')}</td>
          </tr>
          <tr>
            <td class="up-cover-label">Documents<br/>associés</td>
            <td class="up-cover-value">${escape(doc.cover?.associatedDocs || '\u00a0')}</td>
          </tr>
        </table>

        <div class="up-cover-fields">
          <div><strong>Type :</strong> ${escape(doc.type || '')} ${doc.title ? ': ' + escape(doc.title) : ''}</div>
          <div><strong>Processus :</strong> ${escape(doc.cover?.process || '')}</div>
          <div><strong>Périmètre d'application :</strong> ${escape(doc.cover?.perimeter || '')}</div>
          <div><strong>Date d'applicabilité :</strong> ${escape(doc.cover?.applicabilityDate || '')}</div>
        </div>

        <div class="up-italic-small" style="margin-bottom:4pt">
          Veillez à conserver les informations liées à l'indice A (création) + informations des deux derniers indices.
        </div>

        <table class="up-rev-table">
          <thead>
            <tr>
              <th style="width:6%">Ind.</th>
              <th style="width:12%">Date</th>
              <th style="width:40%">Nature des dernières évolutions</th>
              <th style="width:14%">Rédacteur(s)</th>
              <th style="width:14%">Vérificateur(s)</th>
              <th style="width:14%">Approbateur</th>
            </tr>
          </thead>
          <tbody>
            ${(doc.indices || []).map((r) => `
              <tr>
                <td style="text-align:center;font-weight:700">${escape(r.letter)}</td>
                <td style="text-align:center">${escape(r.date)}</td>
                <td>${escape(r.nature)}</td>
                <td style="text-align:center">${escape(r.writer)}</td>
                <td style="text-align:center">${escape(r.verifier)}</td>
                <td style="text-align:center">${escape(r.approver)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="up-acc-banner">Accessibilité du document : ${escape(accFormatted)}</div>
        <div class="up-acc-list">
          ${accessibilityLine('LIBRE', '(C=0)', "L'information peut être rendue publique à l'intérieur et hors de l'entreprise", acc?.toUpperCase().startsWith('LIBRE'))}
          ${accessibilityLine('INTERNE', '(C=1)', "L'information est destinée à être traitée au sein du périmètre de l'entreprise. Elle peut être partagée avec des externes dès lors que l'accès à cette information leur est nécessaire dans le cadre de leur relation avec l'entreprise.", acc?.toUpperCase().startsWith('INTERNE'))}
          ${accessibilityLine('RESTREINT', '(C=2)', "L'accès de l'information est limité à des personnes (internes ou externes à l'entreprise), fonctions ou à un périmètre restreint lié à une activité, une mission ou un projet (usage DOCTEAM : par commodité, il est possible de déclarer le document comme « Restreint UNITEP » directement depuis la FID ; tout autre périmètre de restriction est possible via le choix « Restreint » en association d'une diffusion plus ciblée)", acc?.toUpperCase().startsWith('RESTREINT'))}
          ${accessibilityLine('CONFIDENTIEL', '(C=3)', "L'information n'est destinée qu'à des personnes (internes/externes à l'entreprise) nommément désignées (C3 non admis DOCTEAM)", acc?.toUpperCase().startsWith('CONFIDENTIEL'))}
        </div>

        <div class="up-acc-banner">Liste de diffusion <span style="font-weight:400;font-style:italic;font-size:8pt">(à remplir en cas de diffusion restreinte)</span></div>
        <table class="up-diff-table">
          <thead>
            <tr>
              <th>Destinataire(s) ${escape((company?.name || 'EDF').split(/[\s-]/)[0])} (Nom/Prénom/Entité)</th>
              <th>Destinataire(s) externes ${escape((company?.name || 'EDF').split(/[\s-]/)[0])} (Nom/Prénom/Société)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="height:40pt;white-space:pre-wrap;vertical-align:top">${escape(doc.cover?.diffusionInternal || '\u00a0')}</td>
              <td style="height:40pt;white-space:pre-wrap;vertical-align:top">${escape(doc.cover?.diffusionExternal || '\u00a0')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${footerHtml(1, true)}
    </div>
  `;

  // Table des matières : une ligne par section, indentée selon le niveau.
  // Le titre est rendu en MAJUSCULES sauf au niveau 3 (casse normale).
  const tocPage = `
    <div class="up-page">
      ${headerHtml()}
      <div class="up-content">
        <div class="up-toc-title">Table des matières</div>
        ${(doc.sections || []).map((s, i) => {
          const level = clampLevel(s.level);
          const number = numberById[s.id] || `${i + 1}`;
          const page = pageMap[s.id] || (3 + i);
          const cls = level === 1 ? 'up-toc-main'
            : level === 2 ? 'up-toc-sub'
            : 'up-toc-sub3';
          const title = level === 3
            ? escape(s.title || '')
            : escape((s.title || '').toUpperCase());
          return `
            <div class="up-toc-line ${cls}">
              <span>${number}. ${title}</span>
              <span class="up-toc-dots"></span>
              <span>${page}</span>
            </div>
          `;
        }).join('')}
      </div>
      ${footerHtml(2, false)}
    </div>
  `;

  const composeStepText = (st) => {
    const parts = [];
    if (st.description) parts.push(st.description);
    if (st.action) parts.push(st.action);
    if (st.expected) parts.push(`Résultat attendu : ${st.expected}`);
    return parts.join('\n');
  };

  /**
   * Rend une section au format HTML PDF, en respectant :
   *  - son niveau (h1/h2/h3 + indentation horizontale 4/8mm) ;
   *  - son contentType (body / steps / les deux).
   */
  const renderSection = (s, number) => {
    const level = clampLevel(s.level);
    const contentType = s.contentType || 'mixed';
    const showBody = contentType !== 'steps-only';
    const showSteps = contentType !== 'text-only' && (s.steps || []).length > 0;

    const headingCls = level === 1 ? 'up-h1' : level === 2 ? 'up-h2' : 'up-h3';
    const titleText = level === 3
      ? escape(s.title || '')
      : escape((s.title || '').toUpperCase());
    const wrapperStyle = level === 2
      ? 'padding-left:4mm'
      : level === 3
        ? 'padding-left:8mm'
        : '';

    const stepsRows = (s.steps || []).map((st, si) => `
      <tr>
        <td class="up-step-num ${st.critical ? 'critical' : ''}">
          <div class="up-num-badge ${st.critical ? 'critical' : ''}">${si+1}</div>
        </td>
        <td class="up-step-text">
          <div class="up-step-desc">${nl2br(composeStepText(st))}</div>
          ${st.note ? renderNote(st.note) : ''}
        </td>
        <td class="up-step-img">
          ${renderImageWithAnnotations(st.image, st.annotations)}
        </td>
        <td class="up-step-check">
          <div class="up-checkbox"></div>
        </td>
      </tr>
    `).join('');

    const stepsHtml = showSteps ? `
      <table class="up-table up-step-table">
        <colgroup>
          <col style="width:6%"/><col style="width:46%"/><col style="width:42%"/><col style="width:6%"/>
        </colgroup>
        <thead>
          <tr>
            <th class="up-step-th">&nbsp;</th>
            <th class="up-step-th">ACTION À RÉALISER</th>
            <th class="up-step-th">ILLUSTRATION</th>
            <th class="up-step-th">&nbsp;</th>
          </tr>
        </thead>
        <tbody>${stepsRows}</tbody>
      </table>
    ` : '';

    const HeadingTag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';

    return `
      <section class="up-section" style="${wrapperStyle}">
        <${HeadingTag} class="${headingCls}">${number}. ${titleText}</${HeadingTag}>
        ${showBody && s.body ? `<div class="up-body">${nl2br(s.body)}</div>` : ''}
        ${stepsHtml}
      </section>
    `;
  };

  // Pages de contenu groupées (plusieurs petites sections par page)
  const sectionPages = groups.map((items, gi) => {
    const pageNum = 3 + gi;
    return `
      <div class="up-page">
        ${headerHtml()}
        <div class="up-content">
          ${items.map((it) => renderSection(it.section, it.number)).join('')}
        </div>
        ${footerHtml(pageNum, false)}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escape(doc.title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }

  .up-page {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm 20mm 8mm 20mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .up-page:last-child { page-break-after: auto; }
  .up-content { flex: 1; padding: 2mm 0; }

  .up-header { font-size: 8.5pt; }
  .up-h-toprow { display: flex; justify-content: space-between; padding: 0 2px; margin-bottom: 2px; }
  .up-header table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .up-header td { border: 1px solid #000; padding: 4px 6px; background: #fff; vertical-align: middle; }
  .up-h-logo { text-align: center; padding: 6px; }
  .up-h-logo img { max-height: 52px; max-width: 90%; object-fit: contain; display: block; margin: 0 auto; }
  .up-logo-edf { color: ${COLORS.stepBorder}; font-weight: 800; font-size: 22pt; }
  .up-h-title { text-align: center; font-weight: 700; font-size: 11pt; line-height: 1.2; }
  .up-h-meta { font-size: 9pt; line-height: 1.5; }
  .up-h-ref { text-align: center; font-size: 8pt; }

  .up-footer { font-size: 7.5pt; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
  .up-f-cr { font-weight: 700; }
  .up-f-cr-text { font-style: italic; font-size: 7pt; }
  .up-f-page { text-align: right; font-weight: 600; margin-top: 2px; }
  .up-f-name { text-align: center; font-weight: 600; }
  .up-f-addr { text-align: center; font-size: 7pt; }
  .up-f-legal { text-align: center; margin-top: 3px; font-size: 6.5pt; font-style: italic; }

  .up-h1 { font-size: 12pt; font-weight: 700; text-transform: uppercase; margin: 12pt 0 6pt 0; }
  .up-h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 10pt 0 5pt 0; }
  .up-h3 { font-size: 10.5pt; font-weight: 700; margin: 8pt 0 4pt 0; }
  .up-body { font-size: 10pt; text-align: justify; line-height: 1.45; white-space: pre-wrap; margin-bottom: 6pt; }

  .up-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8pt; }
  .up-table th, .up-table td { border: 1px solid ${COLORS.black}; padding: 4px 6px; vertical-align: top; }
  .up-table th { background: ${COLORS.navy}; color: white; font-weight: 700; text-align: left; }

  /* Cover-page styles (gabarit EDF/UNITEP) */
  .up-division { font-weight: 700; font-size: 7pt; text-transform: uppercase; margin-top: 0; margin-bottom: 8pt; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .up-entity-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12pt; min-height: 32px; }
  .up-entity-label { font-weight: 600; }
  .up-entity-logo { max-height: 28px; object-fit: contain; }
  .up-entity-text { color: #1E5AA8; font-weight: 700; font-style: italic; }

  .up-cover-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 4pt; }
  .up-cover-label { border: 1px solid #000; background: ${COLORS.grayHeader}; font-weight: 600; text-align: center; width: 22%; padding: 8px 6px; vertical-align: middle; }
  .up-cover-value { border: 1px solid #000; padding: 8px 10px; white-space: pre-wrap; vertical-align: middle; background: #fff; }
  .up-cover-fields { margin: 10pt 0; line-height: 1.7; font-size: 9.5pt; }
  .up-cover-fields div { margin-bottom: 2pt; }

  .up-rev-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8pt; }
  .up-rev-table th { background: ${COLORS.grayHeader}; color: #000; font-weight: 700; padding: 4px 6px; border: 1px solid #000; text-align: center; }
  .up-rev-table td { border: 1px solid #000; padding: 4px 6px; background: #fff; }

  .up-acc-banner { background: ${COLORS.grayHeader}; border: 1px solid #000; padding: 4px 8px; font-weight: 700; font-size: 10pt; text-align: center; margin-top: 12pt; margin-bottom: 6pt; }
  .up-acc-list { font-size: 7.5pt; line-height: 1.4; }
  .up-acc-item { margin-bottom: 4pt; padding: 0; }
  .up-acc-item.current { background: ${COLORS.stepBg}; padding: 2pt 4pt; }

  .up-diff-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 0; }
  .up-diff-table th { background: ${COLORS.grayHeader}; color: #000; font-weight: 600; padding: 4px 6px; border: 1px solid #000; text-align: center; }
  .up-diff-table td { border: 1px solid #000; padding: 6px; background: #fff; }

  .up-section-title { font-weight: 700; margin: 8pt 0 4pt 0; font-size: 9.5pt; }
  .up-italic-small { font-style: italic; font-size: 7.5pt; margin-top: 3pt; margin-bottom: 8pt; }

  .up-toc-title { background: ${COLORS.navy}; color: white; padding: 4px 8px; font-weight: 700; font-size: 11pt; text-transform: uppercase; margin-bottom: 12pt; }
  .up-toc-line { display: flex; align-items: baseline; margin-bottom: 3px; font-size: 9.5pt; }
  .up-toc-main { font-weight: 700; font-size: 10pt; margin-top: 4px; }
  .up-toc-sub { padding-left: 20px; font-size: 9pt; color: #222; }
  .up-toc-sub3 { padding-left: 40px; font-size: 8.5pt; color: #444; }
  .up-toc-dots { flex: 1; border-bottom: 1px dotted #888; margin: 0 4px; position: relative; top: -3px; }

  .up-step-table { margin-bottom: 8pt; }
  .up-step-table tr { page-break-inside: avoid; }
  .up-step-th { background: ${COLORS.grayHeader} !important; color: #000 !important; font-weight: 700 !important; text-align: center !important; padding: 4px 6px; font-size: 9.5pt; border: 1px solid #000; }
  .up-step-num { background: #F4F6F8; text-align: center; vertical-align: middle; }
  .up-step-num.critical { background: ${COLORS.stepBg}; border-left: 4px solid ${COLORS.stepBorder} !important; }
  .up-num-badge { width: 22px; height: 22px; border-radius: 50%; background: ${COLORS.navy}; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10pt; }
  .up-num-badge.critical { background: ${COLORS.stepBorder}; }
  .up-step-text { padding: 8pt 10pt; vertical-align: top; font-size: 9.5pt; line-height: 1.5; }
  .up-step-desc { white-space: pre-wrap; }
  .up-step-img { text-align: center; vertical-align: middle; padding: 4pt; background: #fff; }
  .up-step-img img { max-width: 100%; max-height: 180pt; display: block; margin: 0 auto; border: 1px solid #C9D1DC; }
  .up-step-check { text-align: center; vertical-align: middle; padding: 4pt; background: #fff; }
  .up-checkbox { width: 14px; height: 14px; border: 1.5px solid #000; margin: 0 auto; background: #fff; }
  .up-img-wrap { position: relative; display: inline-block; max-width: 100%; }
  .up-img-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

  .up-note { padding: 6pt 10pt; margin: 6pt 0; font-size: 9pt; border-radius: 2px; border-left-width: 4px; border-left-style: solid; }
  .up-note-info { background: ${COLORS.infoBg}; border: 1px solid ${COLORS.infoBorder}; border-left-color: ${COLORS.infoBorder}; color: #0c5460; }
  .up-note-warning { background: ${COLORS.warningBg}; border: 1px solid ${COLORS.warningBorder}; border-left-color: ${COLORS.warningBorder}; color: #856404; }
  .up-note-danger { background: ${COLORS.dangerBg}; border: 1px solid ${COLORS.dangerBorder}; border-left-color: ${COLORS.dangerBorder}; color: #721c24; }
</style>
</head>
<body>
  ${coverPage}
  ${tocPage}
  ${sectionPages}
</body>
</html>`;
}

function accessibilityLine(code, level, desc, current) {
  return `<div class="up-acc-item${current ? ' current' : ''}">
    <strong>${escape(code)}</strong> ${escape(level)} ${escape(desc)}
  </div>`;
}

function renderNote(note) {
  const labels = { info: 'NOTE', warning: 'ATTENTION', danger: 'DANGER' };
  return `<div class="up-note up-note-${note.type}">
    <strong>${labels[note.type]} :</strong> ${escape(note.text)}
  </div>`;
}

function renderImageWithAnnotations(image, annotations) {
  if (!image) {
    return `<div style="border:1px dashed #C9D1DC;background:#F9FAFB;color:#9AA5B5;font-size:8pt;padding:20pt 8pt;font-style:italic">(Capture d'écran)</div>`;
  }
  const annSvg = (annotations && annotations.length) ? `
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" class="up-img-svg">
      ${annotations.map((a) => annSvgEl(a)).join('')}
    </svg>` : '';
  return `<div class="up-img-wrap"><img src="${image}" />${annSvg}</div>`;
}

function annSvgEl(a) {
  const s = a.color || '#FF0000';
  const sw = 4;
  switch (a.type) {
    case 'rect': return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="none" stroke="${s}" stroke-width="${sw}" />`;
    case 'circle': return `<ellipse cx="${a.x + a.w/2}" cy="${a.y + a.h/2}" rx="${Math.abs(a.w/2)}" ry="${Math.abs(a.h/2)}" fill="none" stroke="${s}" stroke-width="${sw}" />`;
    case 'highlight': return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${s}" fill-opacity="0.35" />`;
    case 'arrow': {
      const dx = a.x2 - a.x1; const dy = a.y2 - a.y1;
      const angle = Math.atan2(dy, dx);
      const head = 30;
      const ax = a.x2 - head * Math.cos(angle - Math.PI / 7);
      const ay = a.y2 - head * Math.sin(angle - Math.PI / 7);
      const bx = a.x2 - head * Math.cos(angle + Math.PI / 7);
      const by = a.y2 - head * Math.sin(angle + Math.PI / 7);
      return `<g><line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${s}" stroke-width="${sw}" /><polygon points="${a.x2},${a.y2} ${ax},${ay} ${bx},${by}" fill="${s}" /></g>`;
    }
    case 'number': return `<g><circle cx="${a.x}" cy="${a.y}" r="22" fill="${s}" stroke="white" stroke-width="2" /><text x="${a.x}" y="${a.y + 7}" text-anchor="middle" font-size="22" fill="white" font-weight="bold" font-family="Arial">${escape(a.text)}</text></g>`;
    case 'text': return `<text x="${a.x}" y="${a.y}" font-size="22" fill="${s}" font-family="Arial" font-weight="bold">${escape(a.text)}</text>`;
    default: return '';
  }
}
