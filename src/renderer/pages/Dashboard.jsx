import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, FileText, Filter, Eye, Edit3, Copy, Archive, Trash2, Download,
  CheckCircle2, FileEdit, ArchiveRestore, MoreVertical, Calendar, Upload, Share2,
} from 'lucide-react';
import { useDocumentsStore } from '../store/useDocumentsStore.js';
import { useUiStore } from '../store/useUiStore.js';
import { formatDate } from '../utils/format.js';
import { isInElectron } from '../utils/storage.js';

const STATUS = {
  draft: { label: 'Brouillon', cls: 'bg-amber-100 text-amber-800', icon: FileEdit },
  approved: { label: 'Approuvé', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  archived: { label: 'Archivé', cls: 'bg-slate-200 text-slate-700', icon: Archive },
};

const TYPES = ['Tous', 'Procédure', 'Mode Opératoire', 'Note technique', 'Guide installation'];
const CATS = ['Toutes', 'Caméra', 'NVR', 'DVR', 'Switch PoE', 'VMS', 'Accessoire'];
const STATUSES = ['Tous', 'draft', 'approved', 'archived'];

export default function Dashboard() {
  const navigate = useNavigate();
  const documents = useDocumentsStore((s) => s.documents);
  const remove = useDocumentsStore((s) => s.remove);
  const duplicate = useDocumentsStore((s) => s.duplicate);
  const archive = useDocumentsStore((s) => s.archive);
  const validate = useDocumentsStore((s) => s.validate);
  const update = useDocumentsStore((s) => s.update);
  const exportToJson = useDocumentsStore((s) => s.exportToJson);
  const importFromJson = useDocumentsStore((s) => s.importFromJson);
  const notify = useUiStore((s) => s.notify);
  const confirmDialog = useUiStore((s) => s.confirm);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('Tous');
  const [cat, setCat] = useState('Toutes');
  const [status, setStatus] = useState('Tous');
  const [openMenu, setOpenMenu] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter((d) => {
      if (q && !`${d.title} ${d.reference} ${d.product?.brand} ${d.product?.model}`.toLowerCase().includes(q)) return false;
      if (type !== 'Tous' && d.type !== type) return false;
      if (cat !== 'Toutes' && d.category !== cat) return false;
      if (status !== 'Tous' && d.status !== status) return false;
      return true;
    }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [documents, search, type, cat, status]);

  const stats = useMemo(() => ({
    total: documents.length,
    drafts: documents.filter((d) => d.status === 'draft').length,
    approved: documents.filter((d) => d.status === 'approved').length,
    archived: documents.filter((d) => d.status === 'archived').length,
  }), [documents]);

  const handleDuplicate = async (id) => {
    const copy = await duplicate(id);
    notify('success', `Document dupliqué : ${copy.title}`);
    setOpenMenu(null);
  };
  const handleArchive = async (id) => {
    await archive(id);
    notify('info', 'Document archivé');
    setOpenMenu(null);
  };
  const handleValidate = async (id) => {
    await validate(id);
    notify('success', 'Document marqué comme approuvé');
    setOpenMenu(null);
  };
  const handleRestore = async (id) => {
    await update(id, { status: 'draft' });
    notify('info', 'Document restauré en brouillon');
    setOpenMenu(null);
  };
  const handleDelete = async (id, title) => {
    const ok = await confirmDialog({
      title: 'Supprimer définitivement ce document ?',
      message: `"${title}" sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await remove(id);
    notify('warning', 'Document supprimé');
    setOpenMenu(null);
  };

  const handleExportQdoc = async (id, title) => {
    const json = exportToJson(id);
    if (!json) return;
    const safeName = (title || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    const fileName = `${safeName}.qdoc`;

    const hasElectron = isInElectron && window.qualidoc?.file?.saveText;
    if (hasElectron) {
      try {
        const filePath = await window.qualidoc.dialog.saveFile({
          defaultPath: fileName,
          filters: [{ name: 'Document Qualidoc', extensions: ['qdoc'] }],
        });
        if (!filePath) { setOpenMenu(null); return; }
        const res = await window.qualidoc.file.saveText({ filePath, content: json });
        if (res?.success) notify('success', `Document exporté : ${filePath}`);
        else notify('warning', `Échec de l'export : ${res?.error || 'inconnu'}`);
      } catch (err) {
        console.error('[export qdoc]', err);
        notify('warning', `Erreur export : ${err.message}`);
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      notify('success', 'Document exporté');
    }
    setOpenMenu(null);
  };

  const handleImportClick = async () => {
    const hasElectron = isInElectron && window.qualidoc?.dialog?.openFile;
    if (hasElectron) {
      try {
        const res = await window.qualidoc.dialog.openFile({
          filters: [
            { name: 'Document Qualidoc', extensions: ['qdoc', 'json'] },
            { name: 'Tous fichiers', extensions: ['*'] },
          ],
        });
        if (!res) return;
        if (res.error) { notify('warning', `Lecture impossible : ${res.error}`); return; }
        const doc = await importFromJson(res.content);
        notify('success', `Document importé : ${doc.title}`);
      } catch (err) {
        console.error('[import qdoc]', err);
        notify('warning', err.message || 'Import échoué');
      }
    } else if (isInElectron) {
      notify('warning', "L'application doit être redémarrée (Ctrl+C puis npm run dev) pour activer l'import.");
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const doc = await importFromJson(text);
      notify('success', `Document importé : ${doc.title}`);
    } catch (err) {
      notify('warning', err.message || 'Import échoué');
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto" onClick={() => setOpenMenu(null)}>
      {/* Hero */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-unitep-navy">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-1">
            Procédures techniques de qualification vidéosurveillance — gabarit UNITEP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleImportClick} className="btn-secondary" title="Importer un fichier .qdoc reçu d'un collègue">
            <Upload className="w-4 h-4" />
            Importer
          </button>
          <button onClick={() => navigate('/new')} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouveau document
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".qdoc,.json,application/json"
            className="hidden"
            onChange={handleFilePicked}
          />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard title="Documents" value={stats.total} color="bg-unitep-navy text-white" icon={FileText} />
        <KpiCard title="Brouillons" value={stats.drafts} color="bg-amber-100 text-amber-800" icon={FileEdit} />
        <KpiCard title="Approuvés" value={stats.approved} color="bg-emerald-100 text-emerald-800" icon={CheckCircle2} />
        <KpiCard title="Archivés" value={stats.archived} color="bg-slate-200 text-slate-700" icon={Archive} />
      </div>

      {/* Filtres */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute top-2.5 left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par titre, référence, produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <FilterSelect icon={Filter} label="Type" value={type} options={TYPES} onChange={setType} />
          <FilterSelect label="Catégorie" value={cat} options={CATS} onChange={setCat} />
          <FilterSelect label="Statut" value={status} options={STATUSES.map((s) => s === 'Tous' ? s : STATUS[s].label)}
            onChange={(v) => {
              const k = STATUSES.find((s) => s === 'Tous' ? v === 'Tous' : STATUS[s].label === v);
              setStatus(k || 'Tous');
            }} />
        </div>
      </div>

      {/* Liste */}
      <div className="card overflow-visible">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <div className="font-medium text-slate-600">Aucun document trouvé</div>
            <div className="text-sm mt-1">Créez votre première procédure pour commencer.</div>
            <button onClick={() => navigate('/new')} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Créer un document
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-unitep-border text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Indice</th>
                <th className="px-4 py-3">Mise à jour</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const st = STATUS[d.status] || STATUS.draft;
                const StIcon = st.icon;
                const lastIndex = d.indices?.[d.indices.length - 1];
                return (
                  <tr key={d.id} className="border-b border-unitep-border hover:bg-slate-50 group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        {d.reference || '—'}
                        {d.product?.model && (
                          <span className="ml-2 text-slate-400">· {d.product.brand} {d.product.model}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{d.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{d.category}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-unitep-navy/10 text-unitep-navy font-mono">
                        {lastIndex?.letter || 'A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      <Calendar className="w-3 h-3 inline mr-1 -mt-0.5" />
                      {formatDate(d.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${st.cls}`}>
                        <StIcon className="w-3 h-3 mr-1" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="Ouvrir" onClick={() => navigate(`/editor/${d.id}`)} icon={Edit3} />
                        <IconBtn title="Prévisualiser" onClick={() => navigate(`/preview/${d.id}`)} icon={Eye} />
                        <div className="relative">
                          <IconBtn
                            title="Plus d'actions"
                            icon={MoreVertical}
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === d.id ? null : d.id); }}
                          />
                          {openMenu === d.id && (
                            <div
                              className="absolute right-0 mt-1 w-52 bg-white border border-unitep-border rounded-md shadow-unitep-lg z-20 py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MenuItem icon={Copy} onClick={() => handleDuplicate(d.id)}>Dupliquer</MenuItem>
                              <MenuItem icon={Download} onClick={() => navigate(`/preview/${d.id}`)}>Exporter (PDF / DOCX)</MenuItem>
                              <MenuItem icon={Share2} onClick={() => handleExportQdoc(d.id, d.title)}>Exporter (.qdoc)</MenuItem>
                              {d.status === 'draft' && (
                                <MenuItem icon={CheckCircle2} onClick={() => handleValidate(d.id)}>Valider (Approuver)</MenuItem>
                              )}
                              {d.status !== 'archived' ? (
                                <MenuItem icon={Archive} onClick={() => handleArchive(d.id)}>Archiver</MenuItem>
                              ) : (
                                <MenuItem icon={ArchiveRestore} onClick={() => handleRestore(d.id)}>Restaurer</MenuItem>
                              )}
                              <div className="border-t border-slate-100 my-1" />
                              <MenuItem icon={Trash2} danger onClick={() => handleDelete(d.id, d.title)}>Supprimer</MenuItem>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-slate-400 mt-4 text-center">
        {filtered.length} document(s) · Stockage local Electron Store
      </div>
    </div>
  );
}

function KpiCard({ title, value, color, icon: Icon }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{title}</div>
      </div>
    </div>
  );
}

function FilterSelect({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      <label className="text-xs text-slate-500 whitespace-nowrap">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input py-1.5 text-sm w-auto min-w-[140px]"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-unitep-navy transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function MenuItem({ icon: Icon, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
        danger ? 'text-unitep-danger hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
