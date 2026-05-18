import { useState } from 'react';
import {
  GripVertical, AlertTriangle, Info, OctagonAlert, Trash2, ArrowUp, ArrowDown,
  Edit3, AlertCircle, AlignLeft, Image as ImageIcon, LayoutGrid,
} from 'lucide-react';
import StepNumber from '../preview/StepNumber.jsx';
import ImageDropzone from './ImageDropzone.jsx';
import AnnotationCanvas from './AnnotationCanvas.jsx';
import AIGenerateButton from '../ai/AIGenerateButton.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import { useAiStore } from '../../store/useAiStore.js';
import { useUiStore } from '../../store/useUiStore.js';

const NOTE_TYPES = [
  { id: 'info', label: 'Note', icon: Info, color: 'bg-unitep-info-bg border-unitep-info text-cyan-900' },
  { id: 'warning', label: 'Attention', icon: AlertTriangle, color: 'bg-unitep-warning-bg border-unitep-warning text-amber-900' },
  { id: 'danger', label: 'Danger', icon: OctagonAlert, color: 'bg-unitep-danger-bg border-unitep-danger text-red-900' },
];

const LAYOUT_OPTIONS = [
  { id: 'mixed', label: 'Texte + Illustration', icon: LayoutGrid, hint: 'Mise en page UNITEP standard (Action / Illustration)' },
  { id: 'text-only', label: 'Texte seul', icon: AlignLeft, hint: 'Étape sans illustration (texte sur toute la largeur)' },
  { id: 'image-only', label: 'Illustration seule', icon: ImageIcon, hint: 'Étape sans texte (illustration sur toute la largeur)' },
];

/**
 * Éditeur d'une étape technique simplifié au gabarit UNITEP :
 * Numéro · Texte de l'action · Illustration · Case à cocher de validation.
 *
 * Champs :
 *  - title          : titre de l'étape (apparaît au-dessus dans l'éditeur, pas dans le rendu UNITEP)
 *  - description    : texte unique multiligne contenant l'action à réaliser
 *  - image          : capture d'écran (avec annotations optionnelles)
 *  - critical       : marque l'étape comme critique (bordure orange)
 *  - note           : encadré optionnel { type: info|warning|danger, text }
 */
export default function StepEditor({
  step,
  number,
  sectionNumber,
  readOnly = false,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  aiContext,
}) {
  const [annotating, setAnnotating] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  const update = (patch) => onChange?.({ ...step, ...patch });
  const layout = step.layout || 'mixed';
  const showText = layout !== 'image-only';
  const showImage = layout !== 'text-only';

  const aiAvailable = useAiStore((s) => s.available);
  const aiConfigured = useAiStore((s) => s.configured);
  const aiLoading = useAiStore((s) => s.loading.vision);
  const generateStepText = useAiStore((s) => s.generateStepText);
  const notify = useUiStore((s) => s.notify);

  // Génération du texte d'étape à partir de l'image courante + contexte
  // (marque/modèle, titre section, type document). L'utilisateur peut
  // toujours modifier le résultat ensuite — l'IA propose, jamais n'impose.
  const handleAIGenerate = async () => {
    if (!step.image) {
      notify('error', 'Ajoutez d\'abord une capture d\'écran.');
      return;
    }
    setAiMessage(null);
    const res = await generateStepText({
      imageDataUrl: step.image,
      context: aiContext || {},
    });
    if (!res.ok) {
      setAiMessage({ type: 'error', text: res.error || 'Échec de la génération.' });
      return;
    }
    const r = res.result || {};
    const patch = {};
    if (r.action) patch.description = r.action;
    if (r.title && !step.title) patch.title = r.title;
    if (r.etapeCritique === true && !step.critical) patch.critical = true;
    if (r.noteSuggeree && !step.note) {
      const allowed = ['info', 'warning', 'danger'];
      const type = allowed.includes(r.noteSuggeree.type) ? r.noteSuggeree.type : 'info';
      patch.note = { type, text: r.noteSuggeree.text || '' };
    }
    if (Object.keys(patch).length === 0) {
      setAiMessage({ type: 'warn', text: 'Mistral n\'a rien pu extraire de cette capture.' });
      return;
    }
    update(patch);
    setAiMessage({ type: 'success', text: 'Texte généré — vérifiez et ajustez si nécessaire.' });
  };

  const aiDisabled = !aiAvailable || aiConfigured === false || !step.image;

  const setNoteType = (type) => {
    if (step.note?.type === type) {
      update({ note: null });
    } else {
      update({ note: { type, text: step.note?.text || '' } });
    }
  };

  return (
    <div
      className={`bg-white border rounded-md transition-all ${
        step.critical
          ? 'border-l-4 border-l-unitep-step border-y border-r border-unitep-border bg-unitep-step-bg/30'
          : 'border-unitep-border'
      }`}
    >
      {/* Header : numéro · titre · actions */}
      <div className="flex items-center gap-3 p-3 border-b border-unitep-border bg-slate-50/60">
        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
        <StepNumber n={number} critical={step.critical} size="sm" />
        <input
          type="text"
          value={step.title || ''}
          onChange={(e) => update({ title: e.target.value })}
          disabled={readOnly}
          placeholder="Titre de l'étape (optionnel)"
          className="flex-1 bg-transparent border-0 outline-none font-semibold text-sm text-slate-900 focus:ring-0"
        />
        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
          {sectionNumber}.{number}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <IconBtn
              title={canMoveUp ? 'Monter l\'étape' : 'Déjà en première position'}
              icon={ArrowUp}
              onClick={onMoveUp}
              disabled={!canMoveUp}
            />
            <IconBtn
              title={canMoveDown ? 'Descendre l\'étape' : 'Déjà en dernière position'}
              icon={ArrowDown}
              onClick={onMoveDown}
              disabled={!canMoveDown}
            />
            <IconBtn title="Supprimer l'étape" icon={Trash2} onClick={onRemove} danger />
          </div>
        )}
      </div>

      {/* Sélecteur de mise en page : permet à l'utilisateur de configurer
          chaque étape individuellement (texte seul, illustration seule, ou
          les deux). Le rendu UNITEP / DOCX adapte automatiquement le tableau. */}
      {!readOnly && (
        <div className="px-3 py-2 border-b border-unitep-border bg-white">
          <StepLayoutSelector
            value={layout}
            onChange={(v) => update({ layout: v })}
          />
        </div>
      )}

      {/* Body : grille adaptative selon le layout choisi */}
      <div className={`p-4 grid gap-4 ${showText && showImage ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showText && (
          <div className="space-y-3">
            <div>
              <label className="label">Action à réaliser</label>
              <RichTextEditor
                value={step.description || ''}
                onChange={(html) => update({ description: html })}
                disabled={readOnly}
                minHeight={160}
                placeholder={"-Cliquez sur [Maintenance] puis sur [Mise à niveau] à droite\n-Vous pouvez aussi voir la version actuelle du firmware de la caméra"}
              />
              <div className="text-xs text-slate-500 mt-1">
                Astuce : commencez chaque action par <code className="bg-slate-100 px-1 rounded">-</code>, mettez les <strong>boutons entre crochets</strong> <code className="bg-slate-100 px-1 rounded">[Maintenance]</code>.
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={!!step.critical}
                  onChange={(e) => update({ critical: e.target.checked })}
                  disabled={readOnly}
                  className="rounded border-unitep-border text-unitep-step focus:ring-unitep-step"
                />
                <span>Étape <strong className="text-unitep-step">critique</strong></span>
              </label>

              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-1">Encadré :</span>
                {NOTE_TYPES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNoteType(id)}
                    disabled={readOnly}
                    title={label}
                    className={`p-1.5 rounded transition-colors text-xs ${
                      step.note?.type === id
                        ? id === 'info' ? 'bg-unitep-info text-white'
                          : id === 'warning' ? 'bg-unitep-warning text-amber-900'
                          : 'bg-unitep-danger text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {step.note && (
              <div className={`border-l-4 px-3 py-2 rounded ${NOTE_TYPES.find((n) => n.id === step.note.type)?.color}`}>
                <textarea
                  className="w-full bg-transparent border-0 outline-none text-xs resize-none"
                  rows={2}
                  value={step.note.text || ''}
                  onChange={(e) => update({ note: { ...step.note, text: e.target.value } })}
                  disabled={readOnly}
                  placeholder={`Texte de la note ${NOTE_TYPES.find((n) => n.id === step.note.type)?.label.toLowerCase()}...`}
                />
              </div>
            )}
          </div>
        )}

        {showImage && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Illustration</label>
              {step.image && !readOnly && (
                <button
                  type="button"
                  onClick={() => setAnnotating(true)}
                  className="text-xs text-unitep-navy hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Annoter ({step.annotations?.length || 0})
                </button>
              )}
            </div>
            <ImageDropzone
              value={step.image}
              onChange={(img) => update({ image: img, annotations: img ? step.annotations : [] })}
              onAnnotate={() => setAnnotating(true)}
              height={layout === 'image-only' ? 320 : 220}
            />

            {/* Bouton IA Mistral : analyse la capture et propose un texte
                d'étape. Réservé au mode édition + étape avec illustration
                ET un texte (donc layout 'mixed'). */}
            {!readOnly && aiAvailable && layout === 'mixed' && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <AIGenerateButton
                    onClick={handleAIGenerate}
                    loading={aiLoading}
                    disabled={aiDisabled}
                    size="xs"
                    label="Générer le texte avec IA"
                    loadingLabel="Analyse de la capture…"
                    title={
                      !step.image
                        ? 'Ajoutez une capture pour activer la génération'
                        : aiConfigured === false
                          ? 'Clé API Mistral non configurée'
                          : 'Analyser la capture avec Mistral Vision'
                    }
                  />
                  {step.image && (
                    <span className="text-[10px] text-slate-400">
                      Vérifiez toujours le texte généré
                    </span>
                  )}
                </div>

                {aiMessage && (
                  <div
                    className={`flex items-start gap-1.5 text-[11px] px-2 py-1 rounded ${
                      aiMessage.type === 'error'
                        ? 'bg-unitep-danger-bg text-red-900'
                        : aiMessage.type === 'warn'
                          ? 'bg-unitep-warning-bg text-amber-900'
                          : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{aiMessage.text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pour les étapes 'image-only', on garde la possibilité de marquer
            l'étape comme critique et d'ajouter un encadré, dans une barre
            compacte sous l'illustration. */}
        {!showText && !readOnly && (
          <div className="flex items-center justify-between -mt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={!!step.critical}
                onChange={(e) => update({ critical: e.target.checked })}
                className="rounded border-unitep-border text-unitep-step focus:ring-unitep-step"
              />
              <span>Étape <strong className="text-unitep-step">critique</strong></span>
            </label>
          </div>
        )}
      </div>

      {annotating && step.image && (
        <AnnotationCanvas
          image={step.image}
          annotations={step.annotations || []}
          onSave={(items) => { update({ annotations: items }); setAnnotating(false); }}
          onClose={() => setAnnotating(false)}
        />
      )}
    </div>
  );
}

/**
 * Sélecteur compact "mise en page" d'une étape : Texte+Illustration / Texte
 * seul / Illustration seule. Identique en esprit à ContentTypeSelector des
 * sections, mais agit ici sur la ligne du tableau UNITEP.
 */
function StepLayoutSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-1">
        Mise en page :
      </span>
      {LAYOUT_OPTIONS.map(({ id, label, icon: Icon, hint }) => {
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

function IconBtn({ icon: Icon, onClick, title, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? 'text-slate-400 hover:bg-red-50 hover:text-unitep-danger' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
