import { useState, useRef, useEffect } from 'react';
import {
  Building2, Users, Package, Download, Upload, Plus, Trash2, Image as ImageIcon, X, Save,
  Sparkles, Check, AlertCircle, Loader2, KeyRound,
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useUiStore } from '../store/useUiStore.js';
import { useAiStore } from '../store/useAiStore.js';
import { isInElectron } from '../utils/storage.js';

const TABS = [
  { id: 'company', label: 'Société', icon: Building2 },
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'products', label: 'Catalogue produits', icon: Package },
  { id: 'ai', label: 'IA Mistral', icon: Sparkles },
  { id: 'export', label: 'Export', icon: Download },
];

export default function Settings() {
  const [tab, setTab] = useState('company');
  const settings = useSettingsStore();
  const notify = useUiStore((s) => s.notify);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-unitep-navy">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration de l'application Qualidoc V3</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-unitep-border bg-slate-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-unitep-navy text-unitep-navy bg-white' : 'border-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'company' && <CompanyTab settings={settings} notify={notify} />}
          {tab === 'users' && <UsersTab settings={settings} notify={notify} />}
          {tab === 'products' && <ProductsTab settings={settings} notify={notify} />}
          {tab === 'ai' && <AiTab notify={notify} />}
          {tab === 'export' && <ExportTab settings={settings} notify={notify} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Onglet Société ─── */
function CompanyTab({ settings, notify }) {
  const [c, setC] = useState(settings.company);

  const handleLogo = async (key, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setC({ ...c, [key]: e.target.result });
    reader.readAsDataURL(file);
  };

  const handleLogoBrowse = async (key) => {
    if (isInElectron) {
      const dataUrl = await window.qualidoc.dialog.openImage();
      if (dataUrl) setC({ ...c, [key]: dataUrl });
    }
  };

  const save = async () => {
    await settings.updateCompany(c);
    notify('success', 'Informations société enregistrées');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom de la société">
          <input className="input" value={c.name || ''} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <Field label="Adresse">
          <input className="input" value={c.address || ''} onChange={(e) => setC({ ...c, address: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <input className="input" value={c.phone || ''} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={c.email || ''} onChange={(e) => setC({ ...c, email: e.target.value })} />
        </Field>
        <Field label="Site web">
          <input className="input" value={c.website || ''} onChange={(e) => setC({ ...c, website: e.target.value })} />
        </Field>
        <Field label="Mention légale">
          <input className="input" value={c.legalLine || ''} onChange={(e) => setC({ ...c, legalLine: e.target.value })} />
        </Field>
      </div>

      <Field label="Division / entité (en-tête de page de garde)" full>
        <input className="input" value={c.division || ''} onChange={(e) => setC({ ...c, division: e.target.value })} />
      </Field>
      <Field label="Mention copyright (footer)" full>
        <textarea className="input min-h-[60px] text-sm" value={c.copyright || ''} onChange={(e) => setC({ ...c, copyright: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <LogoUpload
          label="Logo principal (header gauche)"
          value={c.logo}
          onUpload={(f) => handleLogo('logo', f)}
          onBrowse={() => handleLogoBrowse('logo')}
          onClear={() => setC({ ...c, logo: null })}
        />
        <LogoUpload
          label="Logo secondaire (optionnel)"
          value={c.logoSecondary}
          onUpload={(f) => handleLogo('logoSecondary', f)}
          onBrowse={() => handleLogoBrowse('logoSecondary')}
          onClear={() => setC({ ...c, logoSecondary: null })}
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-unitep-border">
        <button onClick={save} className="btn-primary">
          <Save className="w-4 h-4" /> Enregistrer
        </button>
      </div>
    </div>
  );
}

const LogoUpload = ({ label, value, onUpload, onBrowse, onClear }) => {
  const ref = useRef();
  return (
    <div>
      <label className="label">{label}</label>
      <div className="border-2 border-dashed border-unitep-border rounded-md p-4 bg-slate-50 text-center">
        {value ? (
          <div className="space-y-2">
            <img src={value} alt="" className="max-h-20 max-w-full mx-auto bg-white p-2 rounded border border-unitep-border" />
            <div className="flex justify-center gap-2">
              <button onClick={() => (isInElectron ? onBrowse() : ref.current?.click())} className="btn-secondary text-xs">
                <Upload className="w-3 h-3" /> Remplacer
              </button>
              <button onClick={onClear} className="btn-ghost text-xs text-unitep-danger">
                <X className="w-3 h-3" /> Supprimer
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-500">Aucun logo</div>
            <button onClick={() => (isInElectron ? onBrowse() : ref.current?.click())} className="btn-secondary text-xs">
              <Upload className="w-3 h-3" /> Choisir un fichier
            </button>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files?.[0])} />
    </div>
  );
};

/* ─── Onglet Utilisateurs ─── */
function UsersTab({ settings, notify }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const startNew = () => {
    const n = { firstName: '', lastName: '', role: 'Rédacteur', entity: '', signature: null };
    setForm(n);
    setEditing('new');
  };

  const startEdit = (u) => {
    setForm({ ...u });
    setEditing(u.id);
  };

  const save = async () => {
    if (!form.firstName && !form.lastName) {
      notify('error', 'Nom obligatoire');
      return;
    }
    if (editing === 'new') {
      await settings.addUser(form);
      notify('success', 'Utilisateur ajouté');
    } else {
      await settings.updateUser(editing, form);
      notify('success', 'Utilisateur mis à jour');
    }
    setEditing(null);
    setForm(null);
  };

  const confirmDialog = useUiStore((s) => s.confirm);
  const remove = async (id) => {
    const user = settings.users.find((u) => u.id === id);
    const ok = await confirmDialog({
      title: 'Supprimer cet utilisateur ?',
      message: user
        ? `${user.firstName} ${user.lastName} (${user.role}) sera retiré de la liste. Cette opération n'affecte pas les documents existants.`
        : 'Cette opération est irréversible.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await settings.removeUser(id);
    notify('info', 'Utilisateur supprimé');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Rédacteurs, vérificateurs et approbateurs apparaissant dans les indices de révision.</p>
        <button onClick={startNew} className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      <div className="border border-unitep-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Prénom Nom</th>
              <th className="px-3 py-2 text-left">Rôle</th>
              <th className="px-3 py-2 text-left">Entité</th>
              <th className="px-3 py-2 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.users.map((u) => (
              <tr key={u.id} className="border-t border-unitep-border hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-3 py-2"><span className="badge bg-unitep-navy/10 text-unitep-navy">{u.role}</span></td>
                <td className="px-3 py-2 text-slate-600">{u.entity}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => startEdit(u)} className="text-xs text-unitep-navy hover:underline mr-2">Modifier</button>
                  <button onClick={() => remove(u.id)} className="text-xs text-unitep-danger hover:underline">Supprimer</button>
                </td>
              </tr>
            ))}
            {settings.users.length === 0 && (
              <tr><td colSpan="4" className="px-3 py-6 text-center text-slate-400 text-sm">Aucun utilisateur</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card p-4 bg-slate-50">
          <h4 className="font-bold text-sm mb-3">{editing === 'new' ? 'Nouvel utilisateur' : 'Modifier'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="Fonction">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {['Rédacteur', 'Vérificateur', 'Approbateur'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Entité"><input className="input" value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setEditing(null); setForm(null); }} className="btn-secondary">Annuler</button>
            <button onClick={save} className="btn-primary"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Onglet Catalogue produits ─── */
function ProductsTab({ settings, notify }) {
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const confirmDialog = useUiStore((s) => s.confirm);

  const start = (p) => {
    if (p) { setForm({ ...p, firmwares: (p.firmwares || []).join(', ') }); setEditing(p.id); }
    else { setForm({ brand: '', model: '', category: '', hwVersion: '', firmwares: '' }); setEditing('new'); }
  };

  const save = async () => {
    const data = { ...form, firmwares: (form.firmwares || '').split(',').map((f) => f.trim()).filter(Boolean) };
    if (editing === 'new') {
      await settings.addProduct(data);
      notify('success', 'Produit ajouté');
    } else {
      await settings.updateProduct(editing, data);
      notify('success', 'Produit mis à jour');
    }
    setEditing(null); setForm(null);
  };

  const removeProduct = async (p) => {
    const ok = await confirmDialog({
      title: 'Supprimer ce produit du catalogue ?',
      message: `${p.brand} ${p.model} sera retiré du catalogue. Les documents déjà créés ne sont pas impactés.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await settings.removeProduct(p.id);
    notify('info', 'Produit supprimé');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Base de données des produits qualifiés (caméras, NVR, switches...).</p>
        <button onClick={() => start(null)} className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      <div className="border border-unitep-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Marque</th>
              <th className="px-3 py-2 text-left">Modèle</th>
              <th className="px-3 py-2 text-left">Catégorie</th>
              <th className="px-3 py-2 text-left">HW</th>
              <th className="px-3 py-2 text-left">Firmwares testés</th>
              <th className="px-3 py-2 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.products.map((p) => (
              <tr key={p.id} className="border-t border-unitep-border hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold">{p.brand}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.model}</td>
                <td className="px-3 py-2"><span className="badge bg-unitep-navy/10 text-unitep-navy">{p.category}</span></td>
                <td className="px-3 py-2 text-slate-600">{p.hwVersion}</td>
                <td className="px-3 py-2 text-slate-600 text-xs">{(p.firmwares || []).join(', ')}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => start(p)} className="text-xs text-unitep-navy hover:underline mr-2">Modifier</button>
                  <button onClick={() => removeProduct(p)} className="text-xs text-unitep-danger hover:underline">Supprimer</button>
                </td>
              </tr>
            ))}
            {settings.products.length === 0 && (
              <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-400 text-sm">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card p-4 bg-slate-50">
          <h4 className="font-bold text-sm mb-3">{editing === 'new' ? 'Nouveau produit' : 'Modifier produit'}</h4>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Marque"><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="Modèle"><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
            <Field label="Catégorie">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Caméra IP fixe', 'Caméra IP PTZ', 'Caméra IP', 'NVR', 'DVR', 'Switch PoE', 'VMS', 'Accessoire'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Version HW"><input className="input" value={form.hwVersion} onChange={(e) => setForm({ ...form, hwVersion: e.target.value })} /></Field>
            <Field label="Firmwares testés (virgule)" full>
              <input className="input" value={form.firmwares} onChange={(e) => setForm({ ...form, firmwares: e.target.value })} placeholder="5.7.15, 5.7.20" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setEditing(null); setForm(null); }} className="btn-secondary">Annuler</button>
            <button onClick={save} className="btn-primary"><Save className="w-3.5 h-3.5" /> Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Onglet Export ─── */
function ExportTab({ settings, notify }) {
  const [e, setE] = useState(settings.export);
  const save = async () => {
    await settings.update({ export: e });
    notify('success', 'Préférences d\'export enregistrées');
  };
  return (
    <div className="space-y-4">
      <Field label="Format d'export par défaut">
        <select className="input" value={e.format} onChange={(ev) => setE({ ...e, format: ev.target.value })}>
          <option value="docx">DOCX uniquement</option>
          <option value="pdf">PDF uniquement</option>
          <option value="both">Les deux (DOCX + PDF)</option>
        </select>
      </Field>
      <Field label="Résolution des images (DPI)">
        <select className="input" value={e.dpi} onChange={(ev) => setE({ ...e, dpi: parseInt(ev.target.value) })}>
          {[72, 96, 150, 300].map((v) => <option key={v} value={v}>{v} DPI</option>)}
        </select>
      </Field>
      <Field label="Dossier de sortie par défaut">
        <input className="input" value={e.defaultPath || ''} onChange={(ev) => setE({ ...e, defaultPath: ev.target.value })} placeholder="C:\\Users\\...\\Documents\\Qualidoc" />
        <div className="text-xs text-slate-500 mt-1">Si vide, une boîte de dialogue s'affichera à chaque export.</div>
      </Field>
      <div className="flex justify-end pt-4 border-t border-unitep-border">
        <button onClick={save} className="btn-primary">
          <Save className="w-4 h-4" /> Enregistrer
        </button>
      </div>
    </div>
  );
}

/* ─── Onglet IA Mistral ─── */
function AiTab({ notify }) {
  const available = useAiStore((s) => s.available);
  const runtime = useAiStore((s) => s.runtime);
  const configured = useAiStore((s) => s.configured);
  const testing = useAiStore((s) => s.loading.testConnection);
  const refreshStatus = useAiStore((s) => s.refreshStatus);
  const testConnection = useAiStore((s) => s.testConnection);

  const [testResult, setTestResult] = useState(null);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const runTest = async () => {
    setTestResult(null);
    const res = await testConnection();
    setTestResult(res);
    if (res.ok) notify('success', 'Connexion Mistral OK');
    else notify('error', 'Échec du test Mistral');
  };

  return (
    <div className="space-y-5">
      <div className="bg-unitep-info-bg border-l-4 border-unitep-info text-slate-700 px-4 py-3 rounded text-sm">
        <p className="font-semibold mb-1">À propos de l'intégration IA</p>
        <p className="text-xs leading-relaxed">
          Qualidoc V3 utilise <strong>Mistral AI</strong> pour deux usages :
          (1) générer le libellé d'une étape technique à partir d'une capture d'écran (Vision),
          (2) récupérer les caractéristiques techniques d'un équipement depuis le site constructeur (scraping + extraction).
          La clé API est <strong>partagée et figée</strong> dans l'installation : aucune saisie n'est requise côté utilisateur.
          Les données du document <strong>ne sortent jamais d'EDF</strong> en dehors des appels Mistral nécessaires au traitement
          (image courante ou contenu de la page constructeur).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatusCard
          label="Disponibilité"
          ok={available}
          okText={runtime === 'electron' ? 'Disponible (app desktop)' : 'Disponible (API web)'}
          koText="Indisponible — preload ou API /api/ai/* introuvable"
        />
        <StatusCard
          label="Clé API"
          ok={configured === true}
          pending={configured === null}
          okText="Configurée"
          koText="Non configurée — contactez l'administrateur"
          icon={KeyRound}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold text-sm text-slate-900">Test de connexion</div>
            <div className="text-xs text-slate-500">Vérifie que l'application peut joindre api.mistral.ai et que la clé est acceptée.</div>
          </div>
          <button
            onClick={runTest}
            disabled={testing || !available || configured === false}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Test en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Lancer le test
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-2 px-4 py-3 rounded text-sm border-l-4 flex items-start gap-2 ${
              testResult.ok
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                : 'bg-unitep-danger-bg border-unitep-danger text-red-900'
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>
              {testResult.ok ? (
                <>
                  <strong>Connexion réussie.</strong>{' '}
                  Modèle testé : <code className="font-mono text-xs">{testResult.model}</code>.
                  {testResult.sample && (
                    <span className="text-xs text-emerald-800 block mt-1">
                      Réponse : « {testResult.sample} »
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong>Échec.</strong> {testResult.error}
                  {testResult.code && (
                    <span className="block text-[11px] font-mono mt-1 opacity-70">Code : {testResult.code}</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ label, ok, pending, okText, koText, icon: Icon = Check }) {
  const state = pending ? 'pending' : ok ? 'ok' : 'ko';
  const colors = {
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    ko: 'border-unitep-danger/40 bg-unitep-danger-bg text-red-900',
    pending: 'border-unitep-border bg-slate-50 text-slate-600',
  };
  return (
    <div className={`border rounded-md p-3 ${colors[state]}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="font-semibold text-sm">
        {state === 'pending' ? 'Vérification…' : state === 'ok' ? okText : koText}
      </div>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
