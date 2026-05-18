export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(d) {
  const date = d ? new Date(d) : new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(d) {
  const date = d ? new Date(d) : new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mn = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mn}`;
}

export function nextIndex(letter) {
  if (!letter) return 'A';
  const code = letter.toUpperCase().charCodeAt(0);
  if (code < 65 || code >= 90) return 'A';
  return String.fromCharCode(code + 1);
}

/**
 * Calcule la numérotation hiérarchique d'une liste de sections plates.
 *
 * Les sections sont stockées en tableau plat, leur niveau (1, 2 ou 3)
 * détermine la sous-arborescence. Une section niveau 2 « appartient »
 * à la section niveau 1 qui la précède immédiatement, etc.
 *
 *  Entrée :  [ {level:1}, {level:2}, {level:2}, {level:3}, {level:1} ]
 *  Sortie :  [ '1', '1.1', '1.2', '1.2.1', '2' ]
 *
 * Si on rencontre un niveau 2 sans niveau 1 précédent (édition incomplète),
 * on force un compteur de niveau 1 à 1 pour produire « 1.1 » plutôt qu'un
 * affichage cassé. Idem pour les sauts de niveau 1 → 3 : on garantit un
 * compteur niveau 2 ≥ 1.
 *
 * @param {Array<{level?: number}>} sections
 * @returns {Array<{ id?: string, number: string, level: number, l1: number, l2: number, l3: number }>}
 */
export function computeSectionNumbers(sections = []) {
  let c1 = 0, c2 = 0, c3 = 0;
  return sections.map((s) => {
    const level = clampLevel(s?.level);
    if (level === 1) { c1 += 1; c2 = 0; c3 = 0; }
    else if (level === 2) {
      if (c1 === 0) c1 = 1;
      c2 += 1; c3 = 0;
    } else {
      if (c1 === 0) c1 = 1;
      if (c2 === 0) c2 = 1;
      c3 += 1;
    }
    const number = level === 1 ? `${c1}` : level === 2 ? `${c1}.${c2}` : `${c1}.${c2}.${c3}`;
    return { id: s?.id, number, level, l1: c1, l2: c2, l3: c3 };
  });
}

/** Borne un niveau dans [1, 3]. Toute valeur invalide retombe à 1. */
export function clampLevel(level) {
  const n = parseInt(level, 10);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > 3) return 3;
  return n;
}

export function generateReference(type, category) {
  const typeMap = {
    'Procédure': 'PRO',
    'Mode Opératoire': 'MOP',
    'Note technique': 'NOT',
    'Guide installation': 'GUI',
  };
  const catMap = {
    'Caméra': 'CAM',
    'NVR': 'NVR',
    'DVR': 'DVR',
    'Switch PoE': 'SWP',
    'VMS': 'VMS',
    'Accessoire': 'ACC',
  };
  const t = typeMap[type] || 'DOC';
  const c = catMap[category] || 'GEN';
  const yy = String(new Date().getFullYear()).slice(2);
  const seq = Math.floor(Math.random() * 900) + 100;
  return `UNITEP-VID-${t}-${c}-${yy}${seq}`;
}
