import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MousePointer2, Square, Circle, ArrowUpRight, Type, Hash, Highlighter,
  Trash2, Undo2, Save, X, Palette,
} from 'lucide-react';
import { uid } from '../../utils/format.js';
import { useUiStore } from '../../store/useUiStore.js';

/**
 * Canvas d'annotation non-destructif. L'image originale est préservée ;
 * les annotations sont stockées dans un calque SVG fusionnable à l'export.
 *
 * Coordonnées SVG normalisées sur viewBox 0 0 1000 1000 pour indépendance
 * vis-à-vis des dimensions réelles de l'image.
 */
const TOOLS = [
  { id: 'select', label: 'Sélection', icon: MousePointer2 },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Cercle', icon: Circle },
  { id: 'arrow', label: 'Flèche', icon: ArrowUpRight },
  { id: 'text', label: 'Texte', icon: Type },
  { id: 'number', label: 'Numéro', icon: Hash },
  { id: 'highlight', label: 'Surbrillance', icon: Highlighter },
];

const COLORS = [
  { id: 'red', value: '#DC3545', label: 'Rouge' },
  { id: 'orange', value: '#FF6F00', label: 'Orange' },
  { id: 'green', value: '#28A745', label: 'Vert' },
  { id: 'blue', value: '#003366', label: 'Bleu' },
  { id: 'yellow', value: '#FFC107', label: 'Jaune' },
];

export default function AnnotationCanvas({ image, annotations = [], onSave, onClose }) {
  const [tool, setTool] = useState('rect');
  const [color, setColor] = useState('#DC3545');
  const [items, setItems] = useState(() => annotations.map((a) => ({ ...a })));
  const [drawing, setDrawing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const svgRef = useRef(null);
  const counterRef = useRef(annotations.filter((a) => a.type === 'number').length);

  const pushHistory = (next) => {
    setHistory((h) => [...h, items]);
    setItems(next);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setItems(prev);
  };

  const remove = (id) => {
    pushHistory(items.filter((a) => a.id !== id));
    setSelectedId(null);
  };

  const confirmDialog = useUiStore((s) => s.confirm);
  const clearAll = async () => {
    if (!items.length) return;
    const ok = await confirmDialog({
      title: 'Effacer toutes les annotations ?',
      message: `${items.length} annotation${items.length > 1 ? 's seront supprimées' : ' sera supprimée'}. Vous pourrez annuler avec le bouton "Annuler" tant que vous n'avez pas enregistré.`,
      confirmLabel: 'Tout effacer',
      danger: true,
    });
    if (!ok) return;
    pushHistory([]);
  };

  const getSvgPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x, y };
  };

  const onMouseDown = (e) => {
    if (tool === 'select') return;
    const { x, y } = getSvgPoint(e);
    if (tool === 'text') {
      const txt = prompt('Texte de l\'annotation :', '');
      if (!txt) return;
      pushHistory([...items, { id: uid('a'), type: 'text', x, y, color, text: txt }]);
      return;
    }
    if (tool === 'number') {
      counterRef.current += 1;
      pushHistory([...items, { id: uid('a'), type: 'number', x, y, color, text: String(counterRef.current) }]);
      return;
    }
    if (tool === 'arrow') {
      setDrawing({ id: uid('a'), type: 'arrow', x1: x, y1: y, x2: x, y2: y, color });
      return;
    }
    setDrawing({ id: uid('a'), type: tool, x, y, w: 0, h: 0, color, _ox: x, _oy: y });
  };

  const onMouseMove = (e) => {
    if (!drawing) return;
    const { x, y } = getSvgPoint(e);
    if (drawing.type === 'arrow') {
      setDrawing((d) => ({ ...d, x2: x, y2: y }));
    } else {
      const ox = drawing._ox;
      const oy = drawing._oy;
      const w = x - ox;
      const h = y - oy;
      setDrawing((d) => ({
        ...d,
        x: w < 0 ? x : ox,
        y: h < 0 ? y : oy,
        w: Math.abs(w),
        h: Math.abs(h),
      }));
    }
  };

  const onMouseUp = () => {
    if (!drawing) return;
    if (drawing.type === 'arrow') {
      const dx = drawing.x2 - drawing.x1;
      const dy = drawing.y2 - drawing.y1;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        pushHistory([...items, drawing]);
      }
    } else if ((drawing.w > 8 && drawing.h > 8)) {
      const { _ox, _oy, ...clean } = drawing;
      pushHistory([...items, clean]);
    }
    setDrawing(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'Delete' && selectedId) remove(selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-unitep-border bg-slate-50">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-unitep-navy" />
            <h3 className="font-bold text-unitep-navy">Annotation d'image</h3>
            <span className="text-xs text-slate-500 ml-2">{items.length} annotation(s)</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-unitep-border bg-white flex-wrap">
          <div className="flex items-center gap-1 mr-3">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={label}
                className={`p-2 rounded transition-colors ${
                  tool === id ? 'bg-unitep-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="border-l border-unitep-border h-6" />

          <div className="flex items-center gap-1 ml-2">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setColor(c.value)}
                title={c.label}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  color === c.value ? 'border-slate-800 scale-110' : 'border-white shadow-sm'
                }`}
                style={{ background: c.value }}
              />
            ))}
          </div>

          <div className="flex-1" />

          <button onClick={undo} disabled={history.length === 0} className="btn-ghost text-xs disabled:opacity-30">
            <Undo2 className="w-3.5 h-3.5" /> Annuler
          </button>
          <button onClick={clearAll} disabled={items.length === 0} className="btn-ghost text-xs disabled:opacity-30 text-unitep-danger">
            <Trash2 className="w-3.5 h-3.5" /> Tout effacer
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-slate-200 p-6 flex items-center justify-center">
          <div className="relative inline-block bg-white shadow-lg" style={{ maxWidth: '100%', maxHeight: '70vh' }}>
            <img
              src={image}
              alt=""
              className="block"
              style={{ maxWidth: '100%', maxHeight: '70vh', userSelect: 'none' }}
              draggable={false}
            />
            <svg
              ref={svgRef}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: tool === 'select' ? 'default' : 'crosshair',
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {[...items, ...(drawing ? [drawing] : [])].map((a) => (
                <AnnotationGroup
                  key={a.id}
                  a={a}
                  selected={a.id === selectedId}
                  onSelect={() => tool === 'select' && setSelectedId(a.id)}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-unitep-border bg-slate-50">
          <div className="text-xs text-slate-500">
            Outil actif : <strong>{TOOLS.find((t) => t.id === tool)?.label}</strong>
            {selectedId && (
              <span className="ml-3 text-unitep-danger">
                · 1 annotation sélectionnée — <button onClick={() => remove(selectedId)} className="underline">Supprimer</button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button
              onClick={() => onSave?.(items)}
              className="btn-primary"
            >
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnotationGroup({ a, selected, onSelect }) {
  const stroke = a.color || '#FF0000';
  const sw = 4;
  const selStyle = selected ? { filter: 'drop-shadow(0 0 4px #003366)' } : null;
  switch (a.type) {
    case 'rect':
      return <rect onClick={onSelect} x={a.x} y={a.y} width={a.w} height={a.h} fill="none" stroke={stroke} strokeWidth={sw} style={selStyle} />;
    case 'circle':
      return (
        <ellipse
          onClick={onSelect}
          cx={a.x + a.w / 2} cy={a.y + a.h / 2}
          rx={Math.abs(a.w / 2)} ry={Math.abs(a.h / 2)}
          fill="none" stroke={stroke} strokeWidth={sw} style={selStyle}
        />
      );
    case 'arrow': {
      const dx = a.x2 - a.x1;
      const dy = a.y2 - a.y1;
      const angle = Math.atan2(dy, dx);
      const head = 30;
      const ax = a.x2 - head * Math.cos(angle - Math.PI / 7);
      const ay = a.y2 - head * Math.sin(angle - Math.PI / 7);
      const bx = a.x2 - head * Math.cos(angle + Math.PI / 7);
      const by = a.y2 - head * Math.sin(angle + Math.PI / 7);
      return (
        <g onClick={onSelect} style={selStyle}>
          <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={sw} />
          <polygon points={`${a.x2},${a.y2} ${ax},${ay} ${bx},${by}`} fill={stroke} />
        </g>
      );
    }
    case 'number':
      return (
        <g onClick={onSelect} style={selStyle}>
          <circle cx={a.x} cy={a.y} r={22} fill={stroke} stroke="white" strokeWidth={2} />
          <text x={a.x} y={a.y + 7} textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial">
            {a.text}
          </text>
        </g>
      );
    case 'text':
      return (
        <text
          onClick={onSelect}
          x={a.x} y={a.y}
          fontSize="22" fill={stroke} fontFamily="Arial" fontWeight="bold"
          style={selStyle}
        >
          {a.text}
        </text>
      );
    case 'highlight':
      return <rect onClick={onSelect} x={a.x} y={a.y} width={a.w} height={a.h} fill={stroke} fillOpacity={0.35} style={selStyle} />;
    default:
      return null;
  }
}
