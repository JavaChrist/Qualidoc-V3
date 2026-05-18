import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Printer, Download, Edit3, Maximize2 } from 'lucide-react';
import { useDocumentsStore } from '../store/useDocumentsStore.js';
import UnitepDocument from '../components/preview/UnitepDocument.jsx';
import ExportModal from '../components/export/ExportModal.jsx';

export default function Preview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDocumentsStore((s) => s.documents.find((d) => d.id === id));
  const [zoom, setZoom] = useState(0.7);
  const [exporting, setExporting] = useState(false);

  if (!doc) {
    return (
      <div className="p-12 text-center text-slate-500">
        Document introuvable. <button onClick={() => navigate('/dashboard')} className="text-unitep-navy underline">Retour</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-unitep-border px-4 py-2 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Tableau de bord
        </button>
        <button onClick={() => navigate(`/editor/${id}`)} className="btn-ghost text-xs">
          <Edit3 className="w-3.5 h-3.5" /> Éditer
        </button>
        <div className="border-l border-unitep-border h-6" />

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-unitep-navy truncate">{doc.title}</div>
          <div className="text-[11px] text-slate-500 font-mono">
            {doc.reference} · Indice {doc.indices?.[doc.indices.length - 1]?.letter || 'A'}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded p-1">
          <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 hover:bg-white rounded" title="Zoom -">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-600 px-2 font-medium tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1 hover:bg-white rounded" title="Zoom +">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="p-1 hover:bg-white rounded" title="100%">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button onClick={() => window.print()} className="btn-secondary text-xs">
          <Printer className="w-3.5 h-3.5" /> Imprimer
        </button>
        <button onClick={() => setExporting(true)} className="btn-primary text-xs">
          <Download className="w-3.5 h-3.5" /> Exporter
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-300 py-6">
        <UnitepDocument document={doc} scale={zoom} />
      </div>

      {exporting && <ExportModal document={doc} onClose={() => setExporting(false)} />}
    </div>
  );
}
