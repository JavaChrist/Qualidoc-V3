import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, Save, Settings as SettingsIcon, History, Lock, FileText,
  ChevronRight, Info, PlusCircle, Sparkles, PanelRightClose, PanelRight,
  AlignLeft, Rows3, LayoutGrid, ArrowUp, ArrowDown, Trash2, Image as ImageIcon,
  Type,
} from 'lucide-react';
import { useDocumentsStore } from '../store/useDocumentsStore.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useUiStore } from '../store/useUiStore.js';
import DocumentTree from '../components/editor/DocumentTree.jsx';
import StepEditor from '../components/editor/StepEditor.jsx';
import ImageDropzone from '../components/editor/ImageDropzone.jsx';
import RichTextEditor from '../components/editor/RichTextEditor.jsx';
import ProgressBar from '../components/preview/ProgressBar.jsx';
import { formatDateTime, computeSectionNumbers, clampLevel } from '../utils/format.js';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDocumentsStore((s) => s.documents.find((d) => d.id === id));
  const update = useDocumentsStore((s) => s.update);
  const addSection = useDocumentsStore((s) => s.addSection);
  const addSubsection = useDocumentsStore((s) => s.addSubsection);
  const promoteSection = useDocumentsStore((s) => s.promoteSection);
  const demoteSection = useDocumentsStore((s) => s.demoteSection);
  const updateSection = useDocumentsStore((s) => s.updateSection);
  const removeSection = useDocumentsStore((s) => s.removeSection);
  const moveSection = useDocumentsStore((s) => s.moveSection);
  const addStep = useDocumentsStore((s) => s.addStep);
  const updateStep = useDocumentsStore((s) => s.updateStep);
  const removeStep = useDocumentsStore((s) => s.removeStep);
  const moveStep = useDocumentsStore((s) => s.moveStep);
  const addBlock = useDocumentsStore((s) => s.addBlock);
  const updateBlock = useDocumentsStore((s) => s.updateBlock);
  const removeBlock = useDocumentsStore((s) => s.removeBlock);
  const moveBlock = useDocumentsStore((s) => s.moveBlock);
  const newRevision = useDocumentsStore((s) => s.newRevision);
  const updateIndex = useDocumentsStore((s) => s.updateIndex);
  const validate = useDocumentsStore((s) => s.validate);
  const notify = useUiStore((s) => s.notify);
  const confirmDialog = useUiStore((s) => s.confirm);

  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [rightOpen, setRightOpen] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const readOnly = doc?.status === 'approved';

  useEffect(() => {
    if (doc && !selectedSection && doc.sections?.length) {
      setSelectedSection(doc.sections[0].id);
    }
  }, [doc, selectedSection]);

  const stats = useMemo(() => {
    if (!doc) return { totalSteps: 0, completedSteps: 0, withImage: 0 };
    const allSteps = (doc.sections || []).flatMap((s) => s.steps || []);
    return {
      totalSteps: allSteps.length,
      completedSteps: allSteps.filter((st) => (st.description || st.action) && (st.description?.length > 5 || st.action)).length,
      withImage: allSteps.filter((st) => st.image).length,
    };
  }, [doc]);

  // Numérotation hiérarchique 1 / 1.1 / 1.1.1 calculée à partir du champ
  // section.level. Utilisée pour l'affichage de la section sélectionnée et
  // pour préfixer le numéro d'étape dans StepEditor (ex: "2.2.1 → 2.2.1.1").
  const numbering = useMemo(
    () => doc ? computeSectionNumbers(doc.sections || []) : [],
    [doc]
  );
  const numberFor = (sectionId) => {
    const info = numbering.find((n) => n.id === sectionId);
    return info?.number || '';
  };

  const onSave = useCallback(async () => {
    if (!doc) return;
    await update(doc.id, { updatedAt: new Date().toISOString() });
    setLastSaved(new Date());
    notify('success', 'Document sauvegardé');
  }, [doc, update, notify]);

  useEffect(() => {
    if (!doc) return;
    const interval = setInterval(() => setLastSaved(new Date()), 30000);
    return () => clearInterval(interval);
  }, [doc]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); navigate(`/preview/${id}`); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N' && selectedSection) {
        e.preventDefault();
        handleAddStep(selectedSection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!doc) {
    return (
      <div className="p-12 text-center text-slate-500">
        Document introuvable. <button onClick={() => navigate('/dashboard')} className="text-unitep-navy underline">Retour</button>
      </div>
    );
  }

  const selectedSec = doc.sections?.find((s) => s.id === selectedSection);
  const selectedStepObj = selectedSec?.steps?.find((st) => st.id === selectedStep);

  /* ─── Handlers ─── */
  const handleAddAnnex = async () => {
    const sec = await addSection(doc.id, {
      title: `ANNEXE ${(doc.sections.filter((s) => s.title?.startsWith('ANNEXE')).length || 0) + 1}`,
    });
    setSelectedSection(sec.id);
    notify('info', 'Annexe ajoutée');
  };
  const handleAddSubsection = async (parentId) => {
    const sec = await addSubsection(doc.id, parentId, { title: 'Nouvelle sous-section' });
    if (!sec) return;
    setSelectedSection(sec.id);
    setSelectedStep(null);
    // Scroll + flash visuel pour rendre la nouvelle sous-section évidente
    // (sinon l'utilisateur peut croire qu'il modifie toujours la section parente).
    requestAnimationFrame(() => {
      const el = window.document.getElementById(`section-${sec.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        }, 1500);
      }
    });
    notify('info', `Sous-section ajoutée (niveau ${sec.level})`);
  };
  const handleAddSection = async () => {
    const sec = await addSection(doc.id, { title: 'NOUVELLE SECTION' });
    setSelectedSection(sec.id);
    setSelectedStep(null);
    requestAnimationFrame(() => {
      const el = window.document.getElementById(`section-${sec.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        }, 1500);
      }
    });
    notify('info', 'Section ajoutée');
  };
  const handleAddStep = async (sectionId) => {
    const st = await addStep(doc.id, sectionId, { title: 'Nouvelle étape' });
    if (!st) return;
    setSelectedSection(sectionId);
    setSelectedStep(st.id);
    // Scroll automatique + flash visuel vers la nouvelle étape : sans cela,
    // sur une section longue, l'étape ajoutée arrive en bas hors viewport et
    // l'utilisateur peut croire que le bouton n'a rien fait.
    requestAnimationFrame(() => {
      const el = window.document.getElementById(`step-${st.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-unitep-navy', 'ring-offset-2');
        }, 1200);
      }
    });
    notify('success', 'Étape ajoutée');
  };
  const handleStepChange = async (sectionId, stepId, patch) => {
    await updateStep(doc.id, sectionId, stepId, patch);
  };
  const handleSectionChange = async (sectionId, patch) => {
    await updateSection(doc.id, sectionId, patch);
  };
  const handleNewRevision = async () => {
    const evolution = prompt("Nature de l'évolution pour ce nouvel indice :", '');
    if (!evolution) return;
    await newRevision(doc.id, evolution);
    notify('success', 'Nouvelle révision créée');
  };
  const handleValidate = async () => {
    const ok = await confirmDialog({
      title: 'Approuver ce document ?',
      message: "Le document sera marqué APPROUVÉ et passera en lecture seule.\nVous pourrez créer une nouvelle révision pour le modifier à nouveau.",
      confirmLabel: 'Approuver',
      cancelLabel: 'Annuler',
    });
    if (!ok) return;
    await validate(doc.id);
    notify('success', 'Document approuvé — en lecture seule');
  };
  const handleRemoveStep = async (sectionId, stepId) => {
    const ok = await confirmDialog({
      title: 'Supprimer cette étape ?',
      message: 'Le contenu de l\'étape (texte, illustration, annotations) sera définitivement perdu.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await removeStep(doc.id, sectionId, stepId);
    notify('info', 'Étape supprimée');
  };
  const handleRemoveSection = async (sectionId) => {
    const idx = doc.sections.findIndex((s) => s.id === sectionId);
    const hasKids = idx !== -1 && doc.sections[idx + 1] && clampLevel(doc.sections[idx + 1].level) > clampLevel(doc.sections[idx].level);
    const ok = await confirmDialog({
      title: hasKids ? 'Supprimer la section et ses sous-sections ?' : 'Supprimer cette section ?',
      message: hasKids
        ? 'Toutes les sous-sections et étapes contenues seront également supprimées.'
        : 'Les étapes contenues dans cette section seront supprimées.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await removeSection(doc.id, sectionId);
    if (selectedSection === sectionId) setSelectedSection(null);
    notify('info', 'Section supprimée');
  };

  return (
    <div className="h-full flex flex-col">
      {/* ─── Toolbar ─── */}
      <div className="bg-white border-b border-unitep-border px-4 py-2 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Tableau de bord
        </button>
        <div className="border-l border-unitep-border h-6" />

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <input
              type="text"
              value={doc.title}
              onChange={(e) => update(doc.id, { title: e.target.value })}
              disabled={readOnly}
              className="font-bold text-sm text-unitep-navy bg-transparent border-0 outline-none w-full focus:bg-slate-50 px-1 py-0.5 rounded"
            />
            <div className="text-[11px] text-slate-500 font-mono px-1">
              {doc.reference} · Indice {doc.indices?.[doc.indices.length - 1]?.letter || 'A'}
              {readOnly && <span className="ml-2 text-emerald-600 font-bold">· APPROUVÉ</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setRightOpen(!rightOpen)} className="btn-ghost text-xs" title="Panneau latéral">
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </button>
          <button onClick={onSave} disabled={readOnly} className="btn-secondary text-xs">
            <Save className="w-3.5 h-3.5" /> Enregistrer
          </button>
          <button onClick={() => navigate(`/preview/${id}`)} className="btn-primary text-xs">
            <Eye className="w-3.5 h-3.5" /> Prévisualiser
          </button>
        </div>
      </div>

      {/* ─── 3 colonnes ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Colonne gauche */}
        <aside className="w-64 bg-white border-r border-unitep-border flex flex-col shrink-0">
          <DocumentTree
            document={doc}
            selectedSection={selectedSection}
            selectedStep={selectedStep}
            onSelectSection={(id) => { setSelectedSection(id); setSelectedStep(null); }}
            onSelectStep={(secId, stepId) => { setSelectedSection(secId); setSelectedStep(stepId); }}
            onAddSection={handleAddSection}
            onAddStep={handleAddStep}
            onAddAnnex={handleAddAnnex}
            onAddSubsection={handleAddSubsection}
            onPromoteSection={(sid) => promoteSection(doc.id, sid)}
            onDemoteSection={(sid) => demoteSection(doc.id, sid)}
            onRemoveSection={handleRemoveSection}
            onRemoveStep={(sid, stid) => handleRemoveStep(sid, stid)}
            onMoveSection={(sid, dir) => moveSection(doc.id, sid, dir)}
            onMoveStep={(sid, stid, dir) => moveStep(doc.id, sid, stid, dir)}
            readOnly={readOnly}
          />
        </aside>

        {/* Colonne centrale */}
        <main className="flex-1 overflow-auto bg-unitep-gray">
          <div className="max-w-4xl mx-auto p-6">
            {readOnly && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-md mb-4 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4" />
                <span><strong>Document approuvé.</strong> Lecture seule. Créez une nouvelle révision pour modifier.</span>
                <button onClick={handleNewRevision} className="ml-auto text-xs underline font-medium">
                  Créer une révision
                </button>
              </div>
            )}

            {selectedSec && (
              <div id={`section-${selectedSec.id}`} className="transition-all duration-300 rounded-lg">
                <SectionEditor
                  section={selectedSec}
                  number={numberFor(selectedSec.id)}
                  readOnly={readOnly}
                  onChange={(patch) => handleSectionChange(selectedSec.id, patch)}
                  onAddBlock={(block, atIndex) => addBlock(doc.id, selectedSec.id, block, atIndex)}
                  onUpdateBlock={(blockId, patch) => updateBlock(doc.id, selectedSec.id, blockId, patch)}
                  onRemoveBlock={(blockId) => removeBlock(doc.id, selectedSec.id, blockId)}
                  onMoveBlock={(blockId, dir) => moveBlock(doc.id, selectedSec.id, blockId, dir)}
                />
              </div>
            )}

            {selectedSec && selectedSec.contentType !== 'text-only' && (
              <div className="mt-4 space-y-3">
                {(selectedSec.steps || []).map((st, i) => (
                  <div key={st.id} id={`step-${st.id}`} className="transition-all duration-300 rounded-md">
                    <StepEditor
                      step={st}
                      number={i + 1}
                      sectionNumber={numberFor(selectedSec.id)}
                      readOnly={readOnly}
                      onChange={(p) => handleStepChange(selectedSec.id, st.id, p)}
                      onRemove={() => handleRemoveStep(selectedSec.id, st.id)}
                      onMoveUp={() => moveStep(doc.id, selectedSec.id, st.id, 'up')}
                      onMoveDown={() => moveStep(doc.id, selectedSec.id, st.id, 'down')}
                      canMoveUp={i > 0}
                      canMoveDown={i < (selectedSec.steps?.length || 0) - 1}
                      aiContext={{
                        brand: doc.product?.brand,
                        model: doc.product?.model,
                        sectionTitle: selectedSec.title,
                        docType: doc.type,
                      }}
                    />
                  </div>
                ))}

                {!readOnly && (
                  <button
                    onClick={() => handleAddStep(selectedSec.id)}
                    className="w-full py-3 border-2 border-dashed border-unitep-border rounded-md text-slate-500 hover:border-unitep-navy hover:text-unitep-navy hover:bg-white transition-all flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Ajouter une étape (Ctrl+Shift+N)
                  </button>
                )}
              </div>
            )}

            {!selectedSec && (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500 mb-4">Sélectionnez une section dans l'arborescence</div>
                {!readOnly && (
                  <button onClick={handleAddSection} className="btn-primary">
                    <PlusCircle className="w-4 h-4" /> Créer une section
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Colonne droite */}
        {rightOpen && (
          <aside className="w-72 bg-white border-l border-unitep-border flex flex-col shrink-0 overflow-auto">
            <RightPanel
              doc={doc}
              stats={stats}
              lastSaved={lastSaved}
              readOnly={readOnly}
              selectedStep={selectedStepObj}
              onUpdate={(p) => update(doc.id, p)}
              onValidate={handleValidate}
              onNewRevision={handleNewRevision}
              onUpdateIndex={(pos, patch) => updateIndex(doc.id, pos, patch)}
            />
          </aside>
        )}
      </div>

      <div className="bg-white border-t border-unitep-border px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span><strong>{stats.totalSteps}</strong> étapes</span>
          <span>·</span>
          <span><strong>{stats.completedSteps}</strong> complètes</span>
          <span>·</span>
          <span><strong>{stats.withImage}</strong> illustrées</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Dernière sauvegarde : {lastSaved ? formatDateTime(lastSaved) : formatDateTime(doc.updatedAt)}</span>
          <span className="text-emerald-600">● Autosave actif</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Éditeur d'une section avec son numéro hiérarchique (1 / 1.1 / 1.1.1),
 * le titre, le body texte et le sélecteur de type de contenu.
 *
 * Style adapté au niveau :
 *  - Niveau 1 : titre MAJUSCULES gras 16pt, bandeau navy
 *  - Niveau 2 : titre MAJUSCULES gras 14pt
 *  - Niveau 3 : titre casse normale gras 13pt
 */
function SectionEditor({
  section, number, readOnly, onChange,
  onAddBlock, onUpdateBlock, onRemoveBlock, onMoveBlock,
}) {
  const level = clampLevel(section.level);
  const contentType = section.contentType || 'mixed';

  const titleClass =
    level === 1 ? 'font-bold text-base uppercase text-unitep-navy'
    : level === 2 ? 'font-bold text-sm uppercase text-unitep-navy'
    : 'font-semibold text-sm text-unitep-navy';
  const placeholder =
    level === 1 ? 'TITRE DE LA SECTION'
    : level === 2 ? 'TITRE DE LA SOUS-SECTION'
    : 'Titre de la sous-sous-section';

  const showBlocks = contentType !== 'steps-only';
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];

  return (
    <div className={`card p-4 mb-3 ${level === 1 ? 'border-l-4 border-l-unitep-navy' : level === 2 ? 'border-l-2 border-l-unitep-navy/60' : 'border-l-2 border-l-unitep-navy/30'}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`badge font-mono ${level === 1 ? 'bg-unitep-navy text-white' : 'bg-unitep-navy/10 text-unitep-navy'}`}>
          {number}.
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Niveau {level}
        </span>
        <input
          type="text"
          value={section.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={readOnly}
          className={`flex-1 bg-transparent border-0 outline-none focus:bg-slate-50 px-2 py-1 rounded ${titleClass}`}
          placeholder={placeholder}
        />
      </div>

      {!readOnly && (
        <div className="bg-slate-50 border border-unitep-border rounded-md px-3 py-2 mb-3">
          <ContentTypeSelector
            value={contentType}
            onChange={(v) => onChange({ contentType: v })}
          />
        </div>
      )}

      {showBlocks && (
        <div className="space-y-3">
          {blocks.length === 0 && !readOnly && (
            <div className="text-xs text-slate-400 italic px-1">
              Aucun bloc — ajoutez un paragraphe ou une image en pleine largeur ci-dessous.
            </div>
          )}
          {blocks.map((b, i) => (
            <BlockEditor
              key={b.id}
              block={b}
              readOnly={readOnly}
              canMoveUp={i > 0}
              canMoveDown={i < blocks.length - 1}
              onChange={(patch) => onUpdateBlock(b.id, patch)}
              onRemove={() => onRemoveBlock(b.id)}
              onMoveUp={() => onMoveBlock(b.id, 'up')}
              onMoveDown={() => onMoveBlock(b.id, 'down')}
            />
          ))}
          {!readOnly && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onAddBlock({ kind: 'text', content: '' })}
                className="flex-1 py-2 border-2 border-dashed border-unitep-border rounded-md text-slate-500 hover:border-unitep-navy hover:text-unitep-navy hover:bg-white transition-all flex items-center justify-center gap-2 text-xs font-medium"
              >
                <Type className="w-3.5 h-3.5" />
                Ajouter un paragraphe
              </button>
              <button
                type="button"
                onClick={() => onAddBlock({ kind: 'image', image: null, caption: '', width: 'full' })}
                className="flex-1 py-2 border-2 border-dashed border-unitep-border rounded-md text-slate-500 hover:border-unitep-navy hover:text-unitep-navy hover:bg-white transition-all flex items-center justify-center gap-2 text-xs font-medium"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Ajouter une image pleine largeur
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BLOCK_WIDTH_OPTIONS = [
  { id: 'full', label: '100 %', hint: 'Pleine largeur de la zone utile' },
  { id: 'large', label: '75 %', hint: 'Image large centrée' },
  { id: 'medium', label: '50 %', hint: 'Image moyenne centrée' },
  { id: 'small', label: '33 %', hint: 'Petite image centrée' },
];

/**
 * Éditeur d'un bloc de contenu de section : paragraphe texte ou image
 * en pleine largeur avec légende et taille configurable.
 *
 * Les blocs s'affichent dans l'ordre saisi par l'utilisateur, ce qui permet
 * d'intercaler texte → image → texte → ... avant le tableau d'étapes UNITEP.
 */
function BlockEditor({
  block, readOnly, canMoveUp, canMoveDown,
  onChange, onRemove, onMoveUp, onMoveDown,
}) {
  const isText = block.kind === 'text';
  const headerLabel = isText ? 'Paragraphe' : 'Image pleine largeur';
  const HeaderIcon = isText ? Type : ImageIcon;

  return (
    <div className="border border-unitep-border rounded-md bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50/60 border-b border-unitep-border">
        <HeaderIcon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          {headerLabel}
        </span>
        <div className="flex-1" />
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <BlockIconBtn
              icon={ArrowUp}
              title={canMoveUp ? 'Monter le bloc' : 'Déjà en première position'}
              onClick={onMoveUp}
              disabled={!canMoveUp}
            />
            <BlockIconBtn
              icon={ArrowDown}
              title={canMoveDown ? 'Descendre le bloc' : 'Déjà en dernière position'}
              onClick={onMoveDown}
              disabled={!canMoveDown}
            />
            <BlockIconBtn icon={Trash2} title="Supprimer le bloc" onClick={onRemove} danger />
          </div>
        )}
      </div>
      <div className="p-3">
        {isText ? (
          <RichTextEditor
            value={block.content || ''}
            onChange={(html) => onChange({ content: html })}
            disabled={readOnly}
            placeholder="Saisissez le texte du paragraphe (gras, italique, taille, couleur…)"
            minHeight={100}
          />
        ) : (
          <div className="space-y-2">
            <ImageDropzone
              value={block.image}
              onChange={(img) => onChange({ image: img })}
              height={180}
            />
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) => onChange({ caption: e.target.value })}
              disabled={readOnly}
              placeholder="Légende (optionnelle, affichée sous l'image en italique)"
              className="input text-xs"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Largeur :
              </span>
              {BLOCK_WIDTH_OPTIONS.map((opt) => {
                const active = (block.width || 'full') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ width: opt.id })}
                    disabled={readOnly}
                    title={opt.hint}
                    className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-unitep-navy bg-unitep-navy text-white'
                        : 'border-unitep-border bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockIconBtn({ icon: Icon, title, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
        danger ? 'text-slate-400 hover:bg-red-50 hover:text-unitep-danger' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

/**
 * Sélecteur compact "type de contenu" : Texte / Texte + Étapes / Étapes seules.
 * Permet à l'utilisateur de cacher le tableau Action/Illustration UNITEP quand
 * la section ne contient que du texte introductif (ex: chapitre OBJET).
 */
function ContentTypeSelector({ value, onChange }) {
  const opts = [
    { id: 'text-only', label: 'Texte seul', icon: AlignLeft, hint: 'Paragraphe(s) uniquement, sans tableau Action/Illustration' },
    { id: 'mixed', label: 'Texte + Étapes', icon: LayoutGrid, hint: 'Body texte suivi du tableau d\'étapes UNITEP' },
    { id: 'steps-only', label: 'Étapes seules', icon: Rows3, hint: "Uniquement le tableau Action/Illustration" },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-1">
        Contenu :
      </span>
      {opts.map(({ id, label, icon: Icon, hint }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={hint}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              active
                ? 'border-unitep-navy bg-unitep-navy text-white'
                : 'border-unitep-border bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RightPanel({ doc, stats, lastSaved, readOnly, selectedStep, onUpdate, onValidate, onNewRevision, onUpdateIndex }) {
  const users = useSettingsStore((s) => s.users);
  const [tab, setTab] = useState('meta');
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-unitep-border flex">
        {[
          { id: 'meta', label: 'Métadonnées', icon: SettingsIcon },
          { id: 'cover', label: 'Page de garde', icon: FileText },
          { id: 'history', label: 'Historique', icon: History },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-2 text-[11px] font-medium border-b-2 flex items-center justify-center gap-1 ${
              tab === t.id ? 'border-unitep-navy text-unitep-navy' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {tab === 'meta' && (
          <>
            <div>
              <ProgressBar value={stats.completedSteps} max={Math.max(stats.totalSteps, 1)} label="Étapes complètes" color="success" />
              <ProgressBar value={stats.withImage} max={Math.max(stats.totalSteps, 1)} label="Étapes illustrées" color="navy" />
            </div>

            <div className="card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Document</div>
              <Mini label="Type" value={doc.type} />
              <Mini label="Catégorie" value={doc.category} />
              <Mini label="Statut" value={doc.status === 'draft' ? 'Brouillon' : doc.status === 'approved' ? 'Approuvé' : 'Archivé'} />
              <Mini label="Sections" value={doc.sections?.length || 0} />
            </div>

            {doc.product?.model && (
              <div className="card p-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Produit</div>
                <Mini label="Marque" value={doc.product.brand} />
                <Mini label="Modèle" value={doc.product.model} />
                <Mini label="Version HW" value={doc.product.hwVersion} />
                <Mini label="Firmware" value={doc.product.firmware} />
              </div>
            )}

            {selectedStep && (
              <div className="card p-3 border-unitep-navy/30 bg-unitep-navy/5">
                <div className="text-[10px] uppercase font-bold tracking-wider text-unitep-navy mb-2">Étape sélectionnée</div>
                <div className="text-xs font-semibold mb-1">{selectedStep.title}</div>
                <div className="flex flex-wrap gap-1">
                  {selectedStep.critical && <span className="badge bg-unitep-step text-white">Critique</span>}
                  {selectedStep.image && <span className="badge bg-emerald-100 text-emerald-800">Illustrée</span>}
                  {selectedStep.note && <span className={`badge ${selectedStep.note.type === 'danger' ? 'bg-unitep-danger text-white' : selectedStep.note.type === 'warning' ? 'bg-unitep-warning text-amber-900' : 'bg-unitep-info text-white'}`}>Note {selectedStep.note.type}</span>}
                </div>
              </div>
            )}

            {!readOnly && (
              <div className="space-y-2 pt-2">
                <button onClick={onValidate} className="btn-primary w-full text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Valider et approuver
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'cover' && (
          <CoverEditor doc={doc} readOnly={readOnly} onUpdate={onUpdate} />
        )}

        {tab === 'history' && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Indices de révision</div>
            {(doc.indices || []).map((ind, i) => (
              <div key={i} className="card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-unitep-navy text-white font-mono">Ind. {ind.letter}</span>
                  <span className="text-xs text-slate-500">{ind.date}</span>
                </div>
                <div className="text-xs text-slate-700 mb-1">{ind.nature}</div>
                {readOnly ? (
                  <div className="text-[11px] text-slate-500 grid grid-cols-3 gap-1 mt-2">
                    <div><div className="text-[9px] uppercase opacity-70">Réd.</div>{ind.writer || '—'}</div>
                    <div><div className="text-[9px] uppercase opacity-70">Vér.</div>{ind.verifier || '—'}</div>
                    <div><div className="text-[9px] uppercase opacity-70">Appr.</div>{ind.approver || '—'}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <SignataireSelect
                      label="Réd." role="Rédacteur" users={users} value={ind.writer}
                      onChange={(v) => onUpdateIndex(i, { writer: v })}
                    />
                    <SignataireSelect
                      label="Vér." role="Vérificateur" users={users} value={ind.verifier}
                      onChange={(v) => onUpdateIndex(i, { verifier: v })}
                    />
                    <SignataireSelect
                      label="Appr." role="Approbateur" users={users} value={ind.approver}
                      onChange={(v) => onUpdateIndex(i, { approver: v })}
                    />
                  </div>
                )}
              </div>
            ))}
            {!readOnly && (
              <button onClick={onNewRevision} className="btn-secondary w-full text-xs mt-2">
                <PlusCircle className="w-3.5 h-3.5" /> Nouvelle révision
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sélecteur de signataire (rédacteur / vérificateur / approbateur) alimenté par
 * la liste vivante des utilisateurs (Paramètres > Utilisateurs), filtrée par
 * rôle. La valeur courante stockée sur l'indice est toujours conservée comme
 * option même si l'utilisateur a été retiré ou ne correspond plus à un compte
 * existant, afin de ne pas casser les affectations des documents déjà créés.
 */
function SignataireSelect({ label, role, users, value, onChange }) {
  const options = (users || []).filter((u) => u.role === role);
  const currentMatches = options.some((u) => `${u.firstName}${u.lastName}` === value);
  return (
    <label className="block">
      <div className="text-[9px] uppercase opacity-70 text-slate-500">{label}</div>
      <select
        className="input text-[11px] py-1 px-1 w-full"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Aucun —</option>
        {value && !currentMatches && <option value={value}>{value}</option>}
        {options.map((u) => (
          <option key={u.id} value={`${u.firstName}${u.lastName}`}>
            {u.firstName} {u.lastName} — {u.entity}
          </option>
        ))}
      </select>
    </label>
  );
}

function Mini({ label, value }) {
  return (
    <div className="flex justify-between gap-2 text-xs py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value || '—'}</span>
    </div>
  );
}

function CoverEditor({ doc, readOnly, onUpdate }) {
  const cover = doc.cover || {};
  const set = (key, val) => onUpdate({ cover: { ...cover, [key]: val } });
  return (
    <div className="space-y-2">
      <Cf label="Entité émettrice" value={cover.entity} onChange={(v) => set('entity', v)} disabled={readOnly} />
      <Cf label="Résumé" value={cover.summary} onChange={(v) => set('summary', v)} disabled={readOnly} multiline />
      <Cf label="Documents associés" value={cover.associatedDocs} onChange={(v) => set('associatedDocs', v)} disabled={readOnly} />
      <Cf label="Processus" value={cover.process} onChange={(v) => set('process', v)} disabled={readOnly} />
      <Cf label="Périmètre" value={cover.perimeter} onChange={(v) => set('perimeter', v)} disabled={readOnly} multiline />
      <Cf label="Date d'applicabilité" value={cover.applicabilityDate} onChange={(v) => set('applicabilityDate', v)} disabled={readOnly} />
      <div>
        <div className="label">Accessibilité</div>
        <select
          className="input text-xs"
          value={cover.accessibility || 'INTERNE'}
          onChange={(e) => set('accessibility', e.target.value)}
          disabled={readOnly}
        >
          {['LIBRE', 'INTERNE', 'RESTREINT', 'CONFIDENTIEL'].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <Cf label="Diffusion interne" value={cover.diffusionInternal} onChange={(v) => set('diffusionInternal', v)} disabled={readOnly} multiline />
      <Cf label="Diffusion externe" value={cover.diffusionExternal} onChange={(v) => set('diffusionExternal', v)} disabled={readOnly} multiline />
    </div>
  );
}

function Cf({ label, value, onChange, disabled, multiline }) {
  return (
    <div>
      <div className="label">{label}</div>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="input text-xs min-h-[50px]"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="input text-xs"
        />
      )}
    </div>
  );
}
