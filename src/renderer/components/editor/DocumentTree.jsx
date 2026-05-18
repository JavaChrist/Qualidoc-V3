import { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, FileText, ListOrdered, Plus, MoreVertical,
  Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, BookOpen, FolderPlus,
} from 'lucide-react';
import { computeSectionNumbers, clampLevel } from '../../utils/format.js';

/**
 * Arborescence du document avec hiérarchie 3 niveaux (1 / 1.1 / 1.1.1).
 *
 * Les sections sont stockées à plat dans `document.sections[]` ; le champ
 * `level` (1, 2 ou 3) détermine l'indentation visuelle et le numéro
 * hiérarchique calculé automatiquement.
 *
 * Actions disponibles via le menu ⋮ de chaque section :
 *  - Ajouter une sous-section (uniquement si level < 3)
 *  - Ajouter une étape (uniquement si contentType ≠ 'text-only')
 *  - Promouvoir / Rétrograder (changer le niveau)
 *  - Monter / Descendre (déplace tout le sous-arbre)
 *  - Supprimer (supprime aussi les sous-sections)
 */
export default function DocumentTree({
  document, selectedSection, selectedStep, onSelectSection, onSelectStep,
  onAddSection, onAddStep, onAddAnnex, onRemoveSection, onRemoveStep,
  onMoveSection, onMoveStep, onAddSubsection, onPromoteSection, onDemoteSection,
  readOnly = false,
}) {
  const sections = document.sections || [];
  const numbering = useMemo(() => computeSectionNumbers(sections), [sections]);
  const numByIdx = numbering; // accès par index, plus rapide pour la boucle

  const [expanded, setExpanded] = useState(() => {
    const init = {};
    sections.forEach((s) => { init[s.id] = true; });
    return init;
  });
  const [menu, setMenu] = useState(null);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // Une section est masquée si l'un de ses ancêtres (parent direct, grand-parent...)
  // est replié. On remonte niveau par niveau : pour cacher la section i de
  // niveau N, on cherche un parent de niveau N-1, puis de N-2, etc.
  const isHiddenByCollapsedParent = (i) => {
    const me = numByIdx[i];
    let neededLevel = me.level - 1;
    for (let p = i - 1; p >= 0 && neededLevel >= 1; p--) {
      if (numByIdx[p].level === neededLevel) {
        if (expanded[sections[p].id] === false) return true;
        neededLevel -= 1;
      }
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setMenu(null)}>
      <div className="px-3 py-2 border-b border-unitep-border flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-unitep-navy" />
        <div className="font-bold text-sm text-unitep-navy uppercase tracking-wide">Structure</div>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {sections.map((s, i) => {
          if (isHiddenByCollapsedParent(i)) return null;
          const info = numByIdx[i];
          const level = info.level;
          const number = info.number;
          const hasChildren = sections[i + 1] && clampLevel(sections[i + 1].level) > level;
          const isOpen = expanded[s.id] !== false;
          const isSelected = selectedSection === s.id && !selectedStep;
          const indent = (level - 1) * 14;
          const stepsHidden = s.contentType === 'text-only';

          return (
            <div key={s.id} className="mb-0.5">
              <div
                className={`group flex items-center gap-1 pr-1 py-1.5 rounded mx-1 cursor-pointer text-sm transition-colors ${
                  isSelected ? 'bg-unitep-navy text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                style={{ paddingLeft: `${8 + indent}px` }}
                onClick={() => onSelectSection(s.id)}
              >
                {hasChildren ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                    className="p-0.5 hover:bg-black/10 rounded shrink-0"
                  >
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className={`font-mono text-xs opacity-70 shrink-0 ${level === 1 ? 'font-bold' : ''}`}>
                  {number}.
                </span>
                <span
                  className={`flex-1 truncate ${
                    level === 1 ? 'font-semibold uppercase' : level === 2 ? 'font-medium uppercase text-xs' : 'text-xs'
                  }`}
                >
                  {s.title || 'Sans titre'}
                </span>
                {!readOnly && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenu(menu === s.id ? null : s.id)}
                      className={`p-0.5 rounded ${
                        isSelected ? 'hover:bg-white/20' : 'hover:bg-slate-200 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {menu === s.id && (
                      <div className="absolute right-0 mt-1 w-52 bg-white border border-unitep-border rounded-md shadow-unitep-lg z-30 py-1">
                        {!stepsHidden && (
                          <Mi icon={Plus} onClick={() => { onAddStep(s.id); setMenu(null); }}>
                            Ajouter une étape
                          </Mi>
                        )}
                        {level < 3 && (
                          <Mi icon={FolderPlus} onClick={() => { onAddSubsection?.(s.id); setMenu(null); }}>
                            Ajouter une sous-section
                          </Mi>
                        )}
                        <div className="border-t border-slate-100 my-1" />
                        <Mi
                          icon={ArrowLeft}
                          disabled={level <= 1}
                          onClick={() => { onPromoteSection?.(s.id); setMenu(null); }}
                        >
                          Promouvoir (←)
                        </Mi>
                        <Mi
                          icon={ArrowRight}
                          disabled={level >= 3}
                          onClick={() => { onDemoteSection?.(s.id); setMenu(null); }}
                        >
                          Rétrograder (→)
                        </Mi>
                        <Mi icon={ArrowUp} onClick={() => { onMoveSection(s.id, 'up'); setMenu(null); }}>
                          Monter
                        </Mi>
                        <Mi icon={ArrowDown} onClick={() => { onMoveSection(s.id, 'down'); setMenu(null); }}>
                          Descendre
                        </Mi>
                        <div className="border-t border-slate-100 my-1" />
                        <Mi
                          icon={Trash2}
                          danger
                          onClick={() => {
                            onRemoveSection(s.id);
                            setMenu(null);
                          }}
                        >
                          Supprimer
                        </Mi>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Étapes : affichées uniquement si la section les contient ET si elle est ouverte. */}
              {isOpen && !stepsHidden && (
                <div
                  className="mt-0.5 space-y-0.5"
                  style={{ paddingLeft: `${8 + indent + 18}px` }}
                >
                  {(s.steps || []).map((st, j) => (
                    <div
                      key={st.id}
                      className={`group flex items-center gap-1.5 py-1 px-2 rounded mx-1 cursor-pointer text-xs transition-colors ${
                        selectedStep === st.id
                          ? 'bg-unitep-navy/10 text-unitep-navy font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                      onClick={() => onSelectStep(s.id, st.id)}
                    >
                      {st.critical && <span className="w-1 h-3 bg-unitep-step rounded-sm shrink-0" />}
                      <ListOrdered className="w-3 h-3 shrink-0 opacity-60" />
                      <span className="font-mono opacity-60 shrink-0">{number}.{j + 1}</span>
                      <span className="flex-1 truncate">{st.title || '(sans titre)'}</span>
                      {st.image && <FileText className="w-3 h-3 text-emerald-500 shrink-0" title="Image" />}
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveStep(s.id, st.id);
                          }}
                          title="Supprimer l'étape"
                          className="opacity-0 group-hover:opacity-100 hover:text-unitep-danger"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onAddStep(s.id)}
                      className="w-full text-left text-xs text-slate-400 hover:text-unitep-navy hover:bg-slate-50 px-2 py-1 rounded mx-1 flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" />
                      Ajouter étape
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="border-t border-unitep-border p-2 space-y-1">
          <button onClick={onAddSection} className="btn-secondary w-full text-xs justify-start">
            <Plus className="w-3.5 h-3.5" /> Ajouter une section
          </button>
          <button onClick={onAddAnnex} className="btn-ghost w-full text-xs justify-start">
            <Plus className="w-3.5 h-3.5" /> Ajouter une annexe
          </button>
        </div>
      )}
    </div>
  );
}

function Mi({ icon: Icon, onClick, danger, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? 'text-unitep-danger hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}
