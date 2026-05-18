import { useState } from 'react';
import { X, FileText, FileType, Download, Loader2, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore.js';
import { useUiStore } from '../../store/useUiStore.js';
import { isInElectron } from '../../utils/storage.js';
import { buildDocx } from '../../utils/exportDocx.js';
import { buildExportHtml } from '../../utils/exportHtml.js';

export default function ExportModal({ document, onClose }) {
  const settings = useSettingsStore.getState();
  const notify = useUiStore((s) => s.notify);
  const [format, setFormat] = useState(settings.export?.format || 'both');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const slugify = (s) =>
    String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    const baseName = `${document.reference || slugify(document.title)}-ind${document.indices?.[document.indices.length - 1]?.letter || 'A'}`;
    const out = { docx: null, pdf: null, errors: [] };

    try {
      if (format === 'docx' || format === 'both') {
        try {
          const blob = await buildDocx(document, settings);
          const arrayBuffer = await blob.arrayBuffer();
          const docxName = `${baseName}.docx`;
          if (isInElectron && window.qualidoc?.dialog?.saveFile) {
            const filePath = await window.qualidoc.dialog.saveFile({
              defaultPath: docxName,
              filters: [{ name: 'Document Word', extensions: ['docx'] }],
            });
            if (filePath) {
              const r = await window.qualidoc.file.saveBuffer({ filePath, buffer: Array.from(new Uint8Array(arrayBuffer)) });
              if (r.success) out.docx = r.filePath;
              else out.errors.push(`DOCX : ${r.error}`);
            }
          } else {
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url; a.download = docxName; a.click();
            URL.revokeObjectURL(url);
            out.docx = docxName;
          }
        } catch (e) {
          out.errors.push(`DOCX : ${e.message}`);
        }
      }

      if (format === 'pdf' || format === 'both') {
        try {
          const html = buildExportHtml(document, settings);
          const pdfName = `${baseName}.pdf`;
          if (isInElectron && window.qualidoc?.exporter?.pdf) {
            const filePath = await window.qualidoc.dialog.saveFile({
              defaultPath: pdfName,
              filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
            });
            if (filePath) {
              const r = await window.qualidoc.exporter.pdf({ html, filePath });
              if (r.success) out.pdf = r.filePath;
              else out.errors.push(`PDF : ${r.error}`);
            }
          } else {
            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 500);
            out.pdf = '(impression navigateur)';
          }
        } catch (e) {
          out.errors.push(`PDF : ${e.message}`);
        }
      }

      setResult(out);
      if (out.errors.length === 0) {
        notify('success', 'Export terminé avec succès');
      } else {
        notify('warning', `Export partiel : ${out.errors.length} erreur(s)`);
      }
    } finally {
      setExporting(false);
    }
  };

  const openFile = (path) => {
    if (isInElectron && path) window.qualidoc.shell.openPath(path);
  };
  const showInFolder = (path) => {
    if (isInElectron && path) window.qualidoc.shell.showItemInFolder(path);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-unitep-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-unitep-navy" />
            <h3 className="font-bold text-unitep-navy">Exporter le document</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold mb-1">{document.title}</div>
            <div className="text-xs text-slate-500 font-mono">
              {document.reference} · Indice {document.indices?.[document.indices.length - 1]?.letter || 'A'}
            </div>
          </div>

          <div>
            <label className="label">Format(s) d'export</label>
            <div className="grid grid-cols-3 gap-2">
              <FmtBtn active={format === 'docx'} onClick={() => setFormat('docx')} icon={FileText} label="DOCX" desc="Word" />
              <FmtBtn active={format === 'pdf'} onClick={() => setFormat('pdf')} icon={FileType} label="PDF" desc="A4 portrait" />
              <FmtBtn active={format === 'both'} onClick={() => setFormat('both')} icon={Download} label="Les deux" desc="DOCX + PDF" />
            </div>
          </div>

          <div className="bg-unitep-info-bg/40 border-l-4 border-unitep-info text-slate-700 px-3 py-2 rounded text-xs">
            Le document sera généré en respectant strictement le gabarit UNITEP : header 3 colonnes, pagination, page de garde, table des matières, étapes en tableau 2 colonnes.
          </div>

          {result && (
            <div className="space-y-2">
              {result.docx && (
                <ResultLine ok path={result.docx} label="DOCX généré" onOpen={openFile} onShow={showInFolder} />
              )}
              {result.pdf && (
                <ResultLine ok path={result.pdf} label="PDF généré" onOpen={openFile} onShow={showInFolder} />
              )}
              {result.errors?.map((err, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-unitep-border bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={exporting} className="btn-secondary">Fermer</button>
          <button onClick={handleExport} disabled={exporting} className="btn-primary">
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</> : <><Download className="w-4 h-4" /> Exporter</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function FmtBtn({ active, onClick, icon: Icon, label, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-md border-2 text-center transition-all ${
        active ? 'border-unitep-navy bg-unitep-navy/5' : 'border-unitep-border hover:border-slate-400'
      }`}
    >
      <Icon className={`w-6 h-6 mx-auto mb-1 ${active ? 'text-unitep-navy' : 'text-slate-500'}`} />
      <div className={`text-xs font-bold ${active ? 'text-unitep-navy' : 'text-slate-700'}`}>{label}</div>
      <div className="text-[10px] text-slate-500">{desc}</div>
    </button>
  );
}

function ResultLine({ path, label, onOpen, onShow }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-emerald-800">{label}</div>
        <div className="text-[11px] text-emerald-700 truncate font-mono" title={path}>{path}</div>
      </div>
      {isInElectron && (
        <>
          <button onClick={() => onOpen(path)} className="text-emerald-700 hover:underline whitespace-nowrap" title="Ouvrir le fichier">Ouvrir</button>
          <button onClick={() => onShow(path)} className="p-1 text-emerald-700 hover:bg-emerald-100 rounded" title="Afficher dans le dossier">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
