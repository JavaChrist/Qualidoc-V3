import { useRef, useEffect, useState, useCallback } from 'react';
import { Bold, Italic, Underline, Strikethrough, Palette, Eraser, Type } from 'lucide-react';
import { sanitizeHtml } from '../../utils/richText.js';

/**
 * Éditeur rich text minimaliste et autonome (sans dépendance externe lourde).
 *
 * Caractéristiques :
 *  - contenteditable géré en React via `dangerouslySetInnerHTML` pour la
 *    valeur initiale, puis non-contrôlé pendant la frappe (sinon le curseur
 *    saute à chaque appui sur une touche).
 *  - Toolbar collante au-dessus de la zone : gras, italique, souligné,
 *    barré, taille (dropdown), couleur (palette), effacer mise en forme.
 *  - Génère un HTML restreint compatible avec sanitizeHtml() et avec
 *    l'export DOCX (cf. richTextToParagraphs).
 *
 * À noter : on utilise `document.execCommand` qui est marqué deprecated par
 * MDN mais reste l'API la plus simple pour ce besoin minimal et est encore
 * pleinement supportée par Chromium (donc par Electron) sans plan de
 * retrait. Si jamais ça casse, on pourra migrer vers TipTap ou Lexical.
 */

// Tailles proposées dans le dropdown (en pt). 10pt = taille texte UNITEP de base.
const SIZES = [8, 9, 10, 11, 12, 14, 16];

// Palette UNITEP/EDF (couleurs réutilisées pour cohérence avec le gabarit).
const COLORS = [
  { value: '#000000', label: 'Noir (par défaut)' },
  { value: '#C00000', label: 'Rouge — signature / avertissement' },
  { value: '#FF6F00', label: 'Orange EDF — important' },
  { value: '#003366', label: 'Bleu marine EDF' },
  { value: '#595959', label: 'Gris foncé' },
  { value: '#008000', label: 'Vert — succès / validé' },
];

export default function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder,
  minHeight = 100,
  className = '',
}) {
  const ref = useRef(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Initialisation et resynchronisation externe :
  //   on ne ré-injecte le HTML que si la valeur extérieure diffère vraiment
  //   de l'innerHTML actuel pour ne pas casser la position du curseur en
  //   cours de saisie.
  useEffect(() => {
    if (!ref.current) return;
    const safe = sanitizeHtml(value || '');
    if (ref.current.innerHTML !== safe) {
      ref.current.innerHTML = safe;
    }
  }, [value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = sanitizeHtml(ref.current.innerHTML);
    onChange?.(html);
  }, [onChange]);

  const exec = useCallback((cmd, val = null) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  }, [disabled, emit]);

  // Pour la taille on enveloppe la sélection d'un <span style="font-size:Xpt">
  // au lieu de passer par fontSize (limité à 1-7).
  const applySize = useCallback((sizePt) => {
    if (disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.fontSize = `${sizePt}pt`;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
    } catch {
      // ignore (sélection cross-boundary non supportée)
    }
    emit();
  }, [disabled, emit]);

  const applyColor = useCallback((color) => {
    exec('foreColor', color);
    setPaletteOpen(false);
  }, [exec]);

  // Sur Tab on n'insère pas un caractère tab (qui n'a pas de rendu propre
  // en docx) — on laisse Tab passer au DOM pour la navigation au clavier.
  const handleKeyDown = useCallback((e) => {
    // Raccourcis classiques Ctrl+B / Ctrl+I / Ctrl+U déjà gérés par
    // contenteditable nativement — on emit juste après.
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      setTimeout(emit, 0);
    }
  }, [emit]);

  return (
    <div className={`border border-unitep-border rounded-md bg-white overflow-hidden ${className}`}>
      <Toolbar
        disabled={disabled}
        onExec={exec}
        onSize={applySize}
        onColorOpen={() => setPaletteOpen((v) => !v)}
        paletteOpen={paletteOpen}
        onColorPick={applyColor}
        onClear={() => exec('removeFormat')}
      />
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder || ''}
        className="rich-text-editor px-3 py-2 text-sm leading-relaxed outline-none focus:bg-slate-50/30"
        style={{ minHeight }}
      />
    </div>
  );
}

function Toolbar({ disabled, onExec, onSize, onColorOpen, paletteOpen, onColorPick, onClear }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-50/60 border-b border-unitep-border flex-wrap">
      <TbBtn icon={Bold} title="Gras (Ctrl+B)" onClick={() => onExec('bold')} disabled={disabled} />
      <TbBtn icon={Italic} title="Italique (Ctrl+I)" onClick={() => onExec('italic')} disabled={disabled} />
      <TbBtn icon={Underline} title="Souligné (Ctrl+U)" onClick={() => onExec('underline')} disabled={disabled} />
      <TbBtn icon={Strikethrough} title="Barré" onClick={() => onExec('strikeThrough')} disabled={disabled} />

      <TbSeparator />

      <SizeMenu disabled={disabled} onPick={onSize} />

      <TbSeparator />

      <div className="relative">
        <TbBtn icon={Palette} title="Couleur du texte" onClick={onColorOpen} disabled={disabled} active={paletteOpen} />
        {paletteOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-unitep-border rounded shadow-unitep-lg p-1 flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onColorPick(c.value)}
                title={c.label}
                className="w-5 h-5 rounded-sm border border-slate-300 hover:scale-110 transition-transform"
                style={{ background: c.value }}
              />
            ))}
          </div>
        )}
      </div>

      <TbSeparator />

      <TbBtn icon={Eraser} title="Effacer la mise en forme" onClick={onClear} disabled={disabled} />
    </div>
  );
}

function SizeMenu({ disabled, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed ${open ? 'bg-slate-200' : ''}`}
        title="Taille du texte"
      >
        <Type className="w-3.5 h-3.5" />
        <span>Taille</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-unitep-border rounded shadow-unitep-lg py-1 min-w-[100px]">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onPick(s); setOpen(false); }}
              className="w-full text-left px-3 py-1 text-xs hover:bg-slate-100"
              style={{ fontSize: `${Math.min(s, 14)}pt` }}
            >
              {s} pt {s === 10 && <span className="text-slate-400">(défaut)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TbBtn({ icon: Icon, title, onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'bg-slate-200 text-unitep-navy' : 'hover:bg-slate-200 text-slate-600'}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function TbSeparator() {
  return <span className="w-px h-4 bg-slate-300 mx-1" aria-hidden />;
}
