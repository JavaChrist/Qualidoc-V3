import { create } from 'zustand';
import { storage } from '../utils/storage.js';
import { uid, formatDate, nextIndex, clampLevel } from '../utils/format.js';
import { buildDemoDocument } from '../utils/demo.js';

const STORE_KEY = 'documents';

/**
 * Type de contenu d'une section. Permet à l'utilisateur de choisir quand
 * afficher le tableau Action/Illustration UNITEP :
 *  - 'mixed'      : body texte + tableau d'étapes (par défaut)
 *  - 'text-only'  : uniquement le body texte (ex: chapitre OBJET, CONVENTIONS)
 *  - 'steps-only' : uniquement le tableau d'étapes (ex: chapitre opératoire pur)
 */
const VALID_CONTENT_TYPES = new Set(['mixed', 'text-only', 'steps-only']);

function normalizeContentType(t, fallback) {
  if (typeof t === 'string' && VALID_CONTENT_TYPES.has(t)) return t;
  return fallback || 'mixed';
}

/**
 * Mise en page d'une étape (ligne du tableau Action/Illustration UNITEP) :
 *  - 'mixed'      : colonne Action + colonne Illustration (par défaut)
 *  - 'text-only'  : ligne pleine largeur, uniquement le texte (pas d'image)
 *  - 'image-only' : ligne pleine largeur, uniquement l'illustration
 *
 * Permet d'avoir, dans une même section, des étapes purement explicatives
 * (texte sans capture) ou purement illustratives (schéma sans légende) tout
 * en conservant la cohérence visuelle du tableau UNITEP.
 */
const VALID_STEP_LAYOUTS = new Set(['mixed', 'text-only', 'image-only']);

function normalizeStepLayout(l, fallback) {
  if (typeof l === 'string' && VALID_STEP_LAYOUTS.has(l)) return l;
  return fallback || 'mixed';
}

/**
 * Bloc de contenu d'une section. Permet d'alterner librement, dans n'importe
 * quel ordre, des paragraphes de texte et des images en pleine largeur de
 * page (par ex. : texte → schéma → texte → tableau d'étapes).
 *
 *   - kind 'text'  : { content: string }
 *   - kind 'image' : { image: dataUrl, caption: string, width: 'full'|'large'|'medium'|'small' }
 *
 * Les anciens documents (champ `section.body`) sont migrés automatiquement
 * en un unique bloc texte au premier chargement.
 */
const VALID_BLOCK_KINDS = new Set(['text', 'image']);
const VALID_BLOCK_WIDTHS = new Set(['full', 'large', 'medium', 'small']);

function normalizeBlockWidth(w, fallback) {
  if (typeof w === 'string' && VALID_BLOCK_WIDTHS.has(w)) return w;
  return fallback || 'full';
}

function normalizeBlock(b) {
  if (!b || !VALID_BLOCK_KINDS.has(b.kind)) return null;
  if (b.kind === 'text') {
    return {
      id: b.id || uid('blk'),
      kind: 'text',
      content: typeof b.content === 'string' ? b.content : '',
    };
  }
  return {
    id: b.id || uid('blk'),
    kind: 'image',
    image: typeof b.image === 'string' ? b.image : null,
    caption: typeof b.caption === 'string' ? b.caption : '',
    width: normalizeBlockWidth(b.width, 'full'),
  };
}

/**
 * Migre un document V2/V3 ancien vers la structure plate hiérarchique :
 *  - Chaque section.children[] devient une section plate de niveau 2,
 *    insérée juste après son parent.
 *  - Toute section reçoit level (1 par défaut) et contentType.
 *  - Retourne le document inchangé si rien à migrer (préserve les références).
 */
function migrateDocument(doc) {
  if (!doc || !Array.isArray(doc.sections)) return doc;
  let touched = false;

  // Migration d'une étape : déduit le `layout` quand absent à partir du
  // contenu présent (image et/ou description). Une étape avec seulement
  // une image → 'image-only', avec seulement du texte → 'text-only',
  // sinon 'mixed' (le défaut UNITEP standard).
  const migrateStep = (st) => {
    if (st && typeof st.layout === 'string' && VALID_STEP_LAYOUTS.has(st.layout)) return st;
    const hasImage = !!st?.image;
    const hasText = !!(st?.description && st.description.trim()) || !!(st?.title && st.title.trim());
    const inferred = hasImage && !hasText
      ? 'image-only'
      : hasText && !hasImage
        ? 'text-only'
        : 'mixed';
    touched = true;
    return { ...st, layout: inferred };
  };

  // Construit la liste de blocs d'une section. Si la section a déjà des
  // blocs valides, on les normalise ; sinon on convertit l'ancien `body`
  // texte en un unique bloc 'text' pour préserver le contenu existant.
  const buildBlocks = (s) => {
    if (Array.isArray(s.blocks) && s.blocks.length > 0) {
      const normalized = s.blocks.map(normalizeBlock).filter(Boolean);
      const changed = JSON.stringify(normalized) !== JSON.stringify(s.blocks);
      if (changed) touched = true;
      return normalized;
    }
    if (typeof s.body === 'string' && s.body.trim().length > 0) {
      touched = true;
      return [{ id: uid('blk'), kind: 'text', content: s.body }];
    }
    return [];
  };

  const flat = [];
  doc.sections.forEach((s) => {
    const level = clampLevel(s.level);
    const hasSteps = Array.isArray(s.steps) && s.steps.length > 0;
    const hasBody = !!(s.body && s.body.trim());
    // Déduit contentType pour un document ancien dépourvu du champ :
    // si seulement body → 'text-only', si seulement steps → 'steps-only', sinon 'mixed'.
    const inferredContent = hasSteps && !hasBody
      ? 'steps-only'
      : hasBody && !hasSteps
        ? 'text-only'
        : 'mixed';
    const migratedSteps = Array.isArray(s.steps) ? s.steps.map(migrateStep) : [];
    const migratedBlocks = buildBlocks(s);
    const migrated = {
      ...s,
      level,
      contentType: normalizeContentType(s.contentType, inferredContent),
      steps: migratedSteps,
      blocks: migratedBlocks,
    };
    if (migrated.contentType !== s.contentType || migrated.level !== s.level) touched = true;
    // Détache d'éventuels children pour les promouvoir en sections plates niveau 2.
    const children = Array.isArray(s.children) ? s.children : null;
    if (children) {
      touched = true;
      delete migrated.children;
    }
    flat.push(migrated);
    if (children) {
      children.forEach((c) => {
        const childHasSteps = Array.isArray(c.steps) && c.steps.length > 0;
        const childHasBody = !!(c.body && c.body.trim());
        const childContent = childHasSteps && !childHasBody
          ? 'steps-only'
          : childHasBody && !childHasSteps
            ? 'text-only'
            : 'mixed';
        flat.push({
          ...c,
          level: 2,
          contentType: normalizeContentType(c.contentType, childContent),
          steps: (Array.isArray(c.steps) ? c.steps : []).map(migrateStep),
          blocks: buildBlocks(c),
        });
      });
    }
  });
  if (!touched) return doc;
  return { ...doc, sections: flat };
}

export const useDocumentsStore = create((set, get) => ({
  documents: [],
  loaded: false,
  selectedId: null,

  hydrate: async () => {
    let docs = (await storage.get(STORE_KEY)) || [];
    if (!docs || docs.length === 0) {
      docs = [buildDemoDocument()];
      await storage.set(STORE_KEY, docs);
    }
    // Migration douce des documents V2/V3 antérieurs :
    //  - aplatit les anciennes "section.children[]" en sections plates niveau 2 ;
    //  - garantit les champs level / contentType sur chaque section ;
    //  - laisse intacts les documents déjà au nouveau format.
    let migrated = false;
    docs = docs.map((d) => {
      const out = migrateDocument(d);
      if (out !== d) migrated = true;
      return out;
    });
    if (migrated) await storage.set(STORE_KEY, docs);
    set({ documents: docs, loaded: true });
  },

  persist: async () => {
    await storage.set(STORE_KEY, get().documents);
  },

  getById: (id) => get().documents.find((d) => d.id === id),

  create: async (data) => {
    const now = new Date().toISOString();
    const doc = {
      id: uid('doc'),
      title: data.title || 'Nouveau document',
      reference: data.reference || '',
      type: data.type || 'Procédure',
      category: data.category || 'Caméra',
      product: data.product || { brand: '', model: '', hwVersion: '', firmware: '' },
      status: 'draft',
      indices: [{
        letter: 'A', date: formatDate(), nature: 'Création du document',
        writer: data.writer || '', verifier: '', approver: '',
      }],
      cover: {
        entity: data.entity || '',
        summary: data.summary || data.title || '',
        associatedDocs: data.associatedDocs || '',
        process: data.process || '',
        perimeter: data.perimeter || '',
        applicabilityDate: data.applicabilityDate || 'dès approbation',
        accessibility: data.accessibility || 'INTERNE',
        diffusionInternal: '',
        diffusionExternal: '',
      },
      writer: data.writer || '',
      verifier: data.verifier || '',
      approver: data.approver || '',
      createdAt: now,
      updatedAt: now,
      sections: data.sections || [],
    };
    set({ documents: [doc, ...get().documents] });
    await get().persist();
    return doc;
  },

  update: async (id, patch) => {
    set({
      documents: get().documents.map((d) => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d),
    });
    await get().persist();
  },

  remove: async (id) => {
    set({ documents: get().documents.filter((d) => d.id !== id) });
    await get().persist();
  },

  duplicate: async (id) => {
    const src = get().getById(id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('doc');
    copy.title = `${src.title} (copie)`;
    copy.reference = `${src.reference}-COPY`;
    copy.status = 'draft';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    set({ documents: [copy, ...get().documents] });
    await get().persist();
    return copy;
  },

  /**
   * Sérialise un document en chaîne JSON .qdoc (format d'échange Qualidoc).
   * Le fichier embarque tout (texte, structure, images base64, annotations).
   */
  exportToJson: (id) => {
    const doc = get().getById(id);
    if (!doc) return null;
    const payload = {
      __qualidoc: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      document: doc,
    };
    return JSON.stringify(payload, null, 2);
  },

  /**
   * Importe un document depuis une chaîne JSON .qdoc.
   * - Si l'id existe déjà → nouvel id pour éviter d'écraser
   * - Statut forcé à 'draft' (le repreneur doit re-valider)
   * - Référence suffixée " - IMPORT" pour la distinguer
   */
  importFromJson: async (jsonStr) => {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      throw new Error('Fichier illisible (JSON invalide).');
    }
    const src = data?.document || data; // accepte aussi un doc brut
    if (!src || typeof src !== 'object' || !src.title) {
      throw new Error('Format Qualidoc non reconnu.');
    }
    const now = new Date().toISOString();
    const existingIds = new Set(get().documents.map((d) => d.id));
    const imported = JSON.parse(JSON.stringify(src));
    if (existingIds.has(imported.id)) {
      imported.id = uid('doc');
      imported.reference = `${imported.reference || ''} - IMPORT`.trim();
    }
    imported.status = 'draft';
    imported.updatedAt = now;
    if (!imported.createdAt) imported.createdAt = now;
    set({ documents: [imported, ...get().documents] });
    await get().persist();
    return imported;
  },

  archive: async (id) => {
    await get().update(id, { status: 'archived' });
  },

  validate: async (id) => {
    await get().update(id, { status: 'approved' });
  },

  newRevision: async (id, evolution, writer = '', verifier = '', approver = '') => {
    const doc = get().getById(id);
    if (!doc) return;
    const last = doc.indices[doc.indices.length - 1];
    const newLetter = nextIndex(last?.letter || '');
    const indices = [
      ...doc.indices.slice(-2),
      { letter: newLetter, date: formatDate(), nature: evolution, writer, verifier, approver },
    ];
    await get().update(id, { indices, status: 'draft' });
  },

  /* ─── Sections (structure plate avec champ `level` 1/2/3) ─── */
  addSection: async (docId, section) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const newSection = {
      id: uid('sec'),
      level: 1,
      type: 'section',
      title: 'Nouvelle section',
      body: '',
      blocks: [],
      steps: [],
      contentType: 'mixed',
      ...section,
    };
    newSection.level = clampLevel(newSection.level);
    newSection.contentType = normalizeContentType(newSection.contentType, 'mixed');
    if (!Array.isArray(newSection.blocks)) newSection.blocks = [];
    await get().update(docId, { sections: [...doc.sections, newSection] });
    return newSection;
  },

  /**
   * Insère une sous-section juste après la section parente, avec level = parent.level + 1.
   * Si une sous-section frère existe déjà après la parente, la nouvelle est insérée
   * à la suite de la dernière sous-section (descendants directs ou indirects) pour
   * apparaître naturellement à la fin du sous-arbre.
   */
  addSubsection: async (docId, parentId, patch = {}) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const parentIdx = doc.sections.findIndex((s) => s.id === parentId);
    if (parentIdx === -1) return;
    const parent = doc.sections[parentIdx];
    const parentLevel = clampLevel(parent.level);
    if (parentLevel >= 3) return; // pas de niveau 4
    const childLevel = parentLevel + 1;
    // Trouve le dernier descendant du parent pour insérer à la fin du sous-arbre.
    let insertAt = parentIdx + 1;
    for (let i = parentIdx + 1; i < doc.sections.length; i++) {
      const lvl = clampLevel(doc.sections[i].level);
      if (lvl <= parentLevel) break;
      insertAt = i + 1;
    }
    const newSection = {
      id: uid('sec'),
      level: childLevel,
      type: 'section',
      title: 'Nouvelle sous-section',
      body: '',
      blocks: [],
      steps: [],
      contentType: 'mixed',
      ...patch,
    };
    newSection.level = clampLevel(newSection.level);
    newSection.contentType = normalizeContentType(newSection.contentType, 'mixed');
    if (!Array.isArray(newSection.blocks)) newSection.blocks = [];
    const sections = [
      ...doc.sections.slice(0, insertAt),
      newSection,
      ...doc.sections.slice(insertAt),
    ];
    await get().update(docId, { sections });
    return newSection;
  },

  /** Diminue le niveau d'une section (1 ← 2 ← 3). Aucun effet si déjà à 1. */
  promoteSection: async (docId, sectionId) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const lvl = clampLevel(s.level);
      if (lvl <= 1) return s;
      return { ...s, level: lvl - 1 };
    });
    await get().update(docId, { sections });
  },

  /** Augmente le niveau d'une section (1 → 2 → 3). Aucun effet si déjà à 3. */
  demoteSection: async (docId, sectionId) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const lvl = clampLevel(s.level);
      if (lvl >= 3) return s;
      return { ...s, level: lvl + 1 };
    });
    await get().update(docId, { sections });
  },

  updateSection: async (docId, sectionId, patch) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const merged = { ...s, ...patch };
      if ('level' in patch) merged.level = clampLevel(patch.level);
      if ('contentType' in patch) merged.contentType = normalizeContentType(patch.contentType, s.contentType);
      return merged;
    });
    await get().update(docId, { sections });
  },

  /**
   * Supprime une section ET tous ses descendants (sections de niveau supérieur
   * qui la suivent immédiatement). Évite les orphelins type "2.1" sans "2.".
   */
  removeSection: async (docId, sectionId) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const idx = doc.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const target = doc.sections[idx];
    const targetLevel = clampLevel(target.level);
    let end = idx + 1;
    while (end < doc.sections.length && clampLevel(doc.sections[end].level) > targetLevel) end += 1;
    const sections = [
      ...doc.sections.slice(0, idx),
      ...doc.sections.slice(end),
    ];
    await get().update(docId, { sections });
  },

  /**
   * Déplace une section et tout son sous-arbre (descendants contigus de niveau
   * supérieur) vers le haut ou le bas, en l'échangeant avec le bloc voisin.
   */
  moveSection: async (docId, sectionId, direction) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.slice();
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const level = clampLevel(sections[idx].level);
    // Étendue du bloc courant : tout descendant immédiat de niveau supérieur.
    let blockEnd = idx + 1;
    while (blockEnd < sections.length && clampLevel(sections[blockEnd].level) > level) blockEnd += 1;
    const block = sections.slice(idx, blockEnd);

    if (direction === 'up') {
      // On cherche le précédent voisin de niveau ≤ courant.
      let prev = idx - 1;
      while (prev >= 0 && clampLevel(sections[prev].level) > level) prev -= 1;
      if (prev < 0) return;
      // Étendue du voisin : prev … idx-1 (déjà groupé).
      const neighbor = sections.slice(prev, idx);
      const next = [
        ...sections.slice(0, prev),
        ...block,
        ...neighbor,
        ...sections.slice(blockEnd),
      ];
      await get().update(docId, { sections: next });
    } else {
      // Voisin suivant de niveau ≤ courant
      let nextStart = blockEnd;
      if (nextStart >= sections.length) return;
      if (clampLevel(sections[nextStart].level) > level) return; // pas de voisin
      let nextEnd = nextStart + 1;
      while (nextEnd < sections.length && clampLevel(sections[nextEnd].level) > level) nextEnd += 1;
      const neighbor = sections.slice(nextStart, nextEnd);
      const out = [
        ...sections.slice(0, idx),
        ...neighbor,
        ...block,
        ...sections.slice(nextEnd),
      ];
      await get().update(docId, { sections: out });
    }
  },

  /* ─── Blocs de contenu d'une section (texte/image en pleine largeur) ─── */

  /**
   * Insère un bloc dans la section. Si `atIndex` est fourni, on l'insère
   * à cet index, sinon on l'ajoute à la fin. `block.kind` doit valoir
   * 'text' ou 'image'.
   */
  addBlock: async (docId, sectionId, block, atIndex) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const normalized = normalizeBlock({
      kind: block?.kind || 'text',
      content: block?.content || '',
      image: block?.image || null,
      caption: block?.caption || '',
      width: block?.width || 'full',
    });
    if (!normalized) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const blocks = Array.isArray(s.blocks) ? [...s.blocks] : [];
      const idx = (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= blocks.length)
        ? atIndex
        : blocks.length;
      blocks.splice(idx, 0, normalized);
      return { ...s, blocks };
    });
    await get().update(docId, { sections });
    return normalized;
  },

  updateBlock: async (docId, sectionId, blockId, patch) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const blocks = (s.blocks || []).map((b) => {
        if (b.id !== blockId) return b;
        const merged = { ...b, ...patch };
        if ('width' in patch) merged.width = normalizeBlockWidth(patch.width, b.width);
        return merged;
      });
      return { ...s, blocks };
    });
    await get().update(docId, { sections });
  },

  removeBlock: async (docId, sectionId, blockId) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, blocks: (s.blocks || []).filter((b) => b.id !== blockId) };
    });
    await get().update(docId, { sections });
  },

  moveBlock: async (docId, sectionId, blockId, direction) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const blocks = [...(s.blocks || [])];
      const idx = blocks.findIndex((b) => b.id === blockId);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || target < 0 || target >= blocks.length) return s;
      [blocks[idx], blocks[target]] = [blocks[target], blocks[idx]];
      return { ...s, blocks };
    });
    await get().update(docId, { sections });
  },

  /* ─── Steps ─── */
  addStep: async (docId, sectionId, step) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const newStep = {
      id: uid('step'), title: '', description: '',
      image: null, annotations: [], note: null, critical: false,
      layout: 'mixed',
      ...step,
    };
    newStep.layout = normalizeStepLayout(newStep.layout, 'mixed');
    const sections = doc.sections.map((s) =>
      s.id === sectionId ? { ...s, steps: [...(s.steps || []), newStep] } : s
    );
    await get().update(docId, { sections });
    return newStep;
  },

  updateStep: async (docId, sectionId, stepId, patch) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        steps: s.steps.map((st) => {
          if (st.id !== stepId) return st;
          const merged = { ...st, ...patch };
          if ('layout' in patch) merged.layout = normalizeStepLayout(patch.layout, st.layout);
          return merged;
        }),
      };
    });
    await get().update(docId, { sections });
  },

  removeStep: async (docId, sectionId, stepId) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, steps: s.steps.filter((st) => st.id !== stepId) };
    });
    await get().update(docId, { sections });
  },

  moveStep: async (docId, sectionId, stepId, direction) => {
    const doc = get().getById(docId);
    if (!doc) return;
    const sections = doc.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const idx = s.steps.findIndex((st) => st.id === stepId);
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || target < 0 || target >= s.steps.length) return s;
      const steps = [...s.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...s, steps };
    });
    await get().update(docId, { sections });
  },

  setSelected: (id) => set({ selectedId: id }),
}));
