import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, FileText, Layers, ListChecks, Eye,
  Camera, Cpu, Network, Server, Wifi, Package, Globe,
} from 'lucide-react';
import { useDocumentsStore } from '../store/useDocumentsStore.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useUiStore } from '../store/useUiStore.js';
import { useAiStore } from '../store/useAiStore.js';
import { templates, templateList } from '../utils/templates.js';
import { generateReference } from '../utils/format.js';
import ProductScraperModal from '../components/ai/ProductScraperModal.jsx';

const TYPES = ['Procédure', 'Mode Opératoire', 'Note technique', 'Guide installation'];
const CATEGORIES = [
  { v: 'Caméra', icon: Camera }, { v: 'NVR', icon: Server },
  { v: 'DVR', icon: Server }, { v: 'Switch PoE', icon: Network },
  { v: 'VMS', icon: Cpu }, { v: 'Accessoire', icon: Package },
];

const STEPS = [
  { n: 1, label: 'Informations générales', icon: FileText },
  { n: 2, label: 'Périmètre', icon: ListChecks },
  { n: 3, label: 'Structure', icon: Layers },
  { n: 4, label: 'Révision', icon: Eye },
];

// Mappe une catégorie du catalogue (libre, ex. "Caméra IP PTZ extérieure")
// vers une des catégories génériques de l'assistant.
function mapCatalogCategory(cat) {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c.includes('caméra') || c.includes('camera')) return 'Caméra';
  if (c.includes('nvr')) return 'NVR';
  if (c.includes('dvr')) return 'DVR';
  if (c.includes('switch')) return 'Switch PoE';
  if (c.includes('vms') || c.includes('supervision')) return 'VMS';
  return 'Accessoire';
}

export default function NewDocument() {
  const navigate = useNavigate();
  const create = useDocumentsStore((s) => s.create);
  const users = useSettingsStore((s) => s.users);
  const products = useSettingsStore((s) => s.products);
  const notify = useUiStore((s) => s.notify);
  const aiAvailable = useAiStore((s) => s.available);
  const aiConfigured = useAiStore((s) => s.configured);

  const [step, setStep] = useState(1);
  const [scraperOpen, setScraperOpen] = useState(false);
  const [data, setData] = useState({
    title: '',
    reference: '',
    type: 'Procédure',
    category: 'Caméra',
    productId: '',
    productBrand: '',
    productModel: '',
    productHw: '',
    productFw: '',
    writer: users[0]?.firstName + users[0]?.lastName.charAt(0) || '',
    date: new Date().toISOString().slice(0, 10),
    objet: '',
    perimetre: '',
    prereqHw: '',
    prereqSw: '',
    template: 'qualification',
    accessibility: 'INTERNE',
    process: '',
  });

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  // Sélection rapide d'un produit du catalogue : pré-remplit marque/modèle/HW/firmware
  // et mappe la catégorie précise du catalogue vers la catégorie générique de l'assistant.
  const applyCatalogProduct = (id) => {
    if (!id) {
      update({ productId: '', productBrand: '', productModel: '', productHw: '', productFw: '' });
      return;
    }
    const p = products.find((x) => x.id === id);
    if (!p) return;
    update({
      productId: p.id,
      productBrand: p.brand || '',
      productModel: p.model || '',
      productHw: p.hwVersion || '',
      productFw: (p.firmwares && p.firmwares[0]) || '',
      category: mapCatalogCategory(p.category) || data.category,
    });
  };

  // Applique le résultat d'une extraction Mistral aux champs produit de l'étape 1.
  // On respecte les saisies manuelles existantes pour les champs non renseignés
  // par l'IA (null), et on mappe la catégorie extraite vers la catégorie générique.
  const applyScraperResult = (extracted, source) => {
    if (!extracted) return;
    const patch = {};
    if (extracted.brand) patch.productBrand = extracted.brand;
    if (extracted.model) patch.productModel = extracted.model;
    if (extracted.hwVersion) patch.productHw = extracted.hwVersion;
    if (extracted.firmwareLatest) patch.productFw = extracted.firmwareLatest;
    if (extracted.category) {
      const mapped = mapCatalogCategory(extracted.category);
      if (mapped) patch.category = mapped;
    }
    if (extracted.summary && !data.objet) patch.objet = extracted.summary;
    patch.productId = '';
    update(patch);
    notify('success',
      source?.url
        ? `Informations importées depuis ${new URL(source.url).hostname}`
        : 'Informations constructeur importées'
    );
  };

  // Listes filtrées pour les datalists (en fonction de la marque/modèle déjà saisis).
  const matchBrand = (p) => !data.productBrand || p.brand.toLowerCase() === data.productBrand.toLowerCase();
  const matchModel = (p) => !data.productModel || p.model.toLowerCase() === data.productModel.toLowerCase();
  const brandOptions = [...new Set(products.map((p) => p.brand).filter(Boolean))];
  const modelOptions = [...new Set(products.filter(matchBrand).map((p) => p.model).filter(Boolean))];
  const hwOptions = [...new Set(products.filter(matchBrand).filter(matchModel).map((p) => p.hwVersion).filter(Boolean))];
  const fwOptions = [...new Set(
    products.filter(matchBrand).filter(matchModel).flatMap((p) => p.firmwares || []).filter(Boolean)
  )];

  const autoRef = useMemo(
    () => generateReference(data.type, data.category),
    [data.type, data.category]
  );

  const valid = {
    1: data.title && data.type && data.category,
    2: true,
    3: data.template,
    4: true,
  };

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    const tpl = templates[data.template];
    // Les valeurs `objet` et `perimetre` saisies à l'étape 2 alimentent
    // exclusivement la PAGE DE GARDE (cover.summary / cover.perimeter).
    // La structure du document (chapitres OBJET / PÉRIMÈTRE D'APPLICATION)
    // est créée vide : le rédacteur la complète dans l'éditeur avec un
    // contenu plus détaillé que le simple résumé de la page de garde.
    const sections = tpl ? tpl.build() : [];
    const created = await create({
      title: data.title,
      reference: data.reference || autoRef,
      type: data.type,
      category: data.category,
      product: {
        brand: data.productBrand,
        model: data.productModel,
        hwVersion: data.productHw,
        firmware: data.productFw,
      },
      writer: data.writer,
      entity: 'EDF - DPNT - DTEAM - UNITEP',
      summary: data.objet || data.title,
      perimeter: data.perimetre,
      process: data.process,
      accessibility: data.accessibility,
      sections,
    });
    notify('success', `Document créé : ${created.title}`);
    navigate(`/editor/${created.id}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-500 hover:text-unitep-navy flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <h1 className="text-2xl font-bold text-unitep-navy">Nouveau document UNITEP</h1>
        <p className="text-sm text-slate-500 mt-1">Assistant de création en 4 étapes</p>
      </div>

      <div className="card p-6">
        <Steps current={step} />

        <div className="mt-8 min-h-[400px]">
          {step === 1 && (
            <div className="space-y-4">
              <SectionTitle>Informations générales</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Titre du document *" full>
                  <input
                    className="input"
                    value={data.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="Ex : Qualification caméra IP fixe — Hikvision DS-2CD2143G2-I"
                  />
                </Field>
                <Field label="Type de document *">
                  <select className="input" value={data.type} onChange={(e) => update({ type: e.target.value })}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Référence (laisser vide pour auto)">
                  <div className="flex gap-2">
                    <input
                      className="input"
                      value={data.reference}
                      onChange={(e) => update({ reference: e.target.value })}
                      placeholder={autoRef}
                    />
                    <button type="button" onClick={() => update({ reference: autoRef })} className="btn-secondary text-xs whitespace-nowrap">
                      Générer
                    </button>
                  </div>
                </Field>
              </div>

              <div>
                <label className="label">Catégorie de produit *</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(({ v, icon: Icon }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update({ category: v })}
                      className={`p-3 rounded-md border-2 text-sm font-medium transition-all flex items-center gap-2 ${
                        data.category === v
                          ? 'border-unitep-navy bg-unitep-navy/5 text-unitep-navy'
                          : 'border-unitep-border bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-unitep-border bg-slate-50 p-3 space-y-2">
                <Field label="Sélection rapide depuis le catalogue" full>
                  <select
                    className="input"
                    value={data.productId || ''}
                    onChange={(e) => applyCatalogProduct(e.target.value)}
                  >
                    <option value="">— Saisie libre —</option>
                    {products
                      .slice()
                      .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand} {p.model}
                          {p.category ? ` · ${p.category}` : ''}
                          {p.hwVersion ? ` · HW ${p.hwVersion}` : ''}
                          {p.firmwares && p.firmwares.length ? ` · FW ${p.firmwares.join(' / ')}` : ''}
                        </option>
                      ))}
                  </select>
                  <div className="text-xs text-slate-500 mt-1">
                    Pré-remplit marque, modèle, catégorie, HW et firmware testé depuis le Catalogue produits (Paramètres). Les champs ci-dessous restent modifiables.
                  </div>
                </Field>

                {aiAvailable && (
                  <div className="flex items-center gap-2 pt-2 border-t border-unitep-border">
                    <button
                      type="button"
                      onClick={() => setScraperOpen(true)}
                      disabled={aiConfigured === false}
                      className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        aiConfigured === false
                          ? 'Clé API Mistral non configurée'
                          : 'Récupère automatiquement la fiche technique depuis le site constructeur'
                      }
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Récupérer les infos en ligne
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Recherche la fiche technique constructeur (firmware, HW, alimentation, IP…) via Mistral.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <Field label="Marque produit">
                  <input
                    className="input"
                    value={data.productBrand}
                    onChange={(e) => update({ productBrand: e.target.value, productId: '' })}
                    placeholder="Hikvision"
                    list="brands"
                  />
                  <datalist id="brands">
                    {brandOptions.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </Field>
                <Field label="Modèle">
                  <input
                    className="input"
                    value={data.productModel}
                    onChange={(e) => update({ productModel: e.target.value, productId: '' })}
                    placeholder="DS-2CD2143G2-I"
                    list="models"
                  />
                  <datalist id="models">
                    {modelOptions.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </Field>
                <Field label="Version HW">
                  <input
                    className="input"
                    value={data.productHw}
                    onChange={(e) => update({ productHw: e.target.value, productId: '' })}
                    placeholder="2.0"
                    list="hwVersions"
                  />
                  <datalist id="hwVersions">
                    {hwOptions.map((h) => <option key={h} value={h} />)}
                  </datalist>
                </Field>
                <Field label="Firmware testé">
                  <input
                    className="input"
                    value={data.productFw}
                    onChange={(e) => update({ productFw: e.target.value, productId: '' })}
                    placeholder="5.7.15"
                    list="firmwares"
                  />
                  <datalist id="firmwares">
                    {fwOptions.map((f) => <option key={f} value={f} />)}
                  </datalist>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Rédacteur">
                  <select className="input" value={data.writer} onChange={(e) => update({ writer: e.target.value })}>
                    <option value="">— Aucun —</option>
                    {users.filter((u) => u.role === 'Rédacteur').map((u) => (
                      <option key={u.id} value={`${u.firstName}${u.lastName}`}>{u.firstName} {u.lastName} — {u.entity}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" className="input" value={data.date} onChange={(e) => update({ date: e.target.value })} />
                </Field>
                <Field label="Niveau d'accessibilité">
                  <select className="input" value={data.accessibility} onChange={(e) => update({ accessibility: e.target.value })}>
                    {['LIBRE', 'INTERNE', 'RESTREINT', 'CONFIDENTIEL'].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <SectionTitle>Page de garde — résumé & périmètre</SectionTitle>
              <p className="text-xs text-slate-500">
                Ces informations apparaissent uniquement sur la <strong>page de garde</strong> du document.
                Les chapitres « 1. OBJET » et « 2. PÉRIMÈTRE D'APPLICATION » du corps de la procédure
                seront créés vides et complétés ensuite dans l'éditeur.
              </p>
              <Field label="Résumé (objet)" hint="Phrase courte qui apparaîtra dans le cartouche de la page de garde." full>
                <textarea
                  className="input min-h-[100px] font-mono text-xs"
                  value={data.objet}
                  onChange={(e) => update({ objet: e.target.value })}
                  placeholder={`La présente procédure décrit les étapes de qualification...`}
                />
              </Field>
              <Field label="Périmètre d'application" hint="Équipements, environnements et conditions concernés (page de garde)." full>
                <textarea
                  className="input min-h-[100px] font-mono text-xs"
                  value={data.perimetre}
                  onChange={(e) => update({ perimetre: e.target.value })}
                  placeholder="Cette procédure s'applique à toute installation..."
                />
              </Field>
              <Field label="Processus concerné" full>
                <input className="input" value={data.process} onChange={(e) => update({ process: e.target.value })} placeholder="Vidéosurveillance — Qualification" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prérequis matériels (un par ligne)">
                  <textarea
                    className="input min-h-[80px] text-sm"
                    value={data.prereqHw}
                    onChange={(e) => update({ prereqHw: e.target.value })}
                    placeholder="Câble Cat6 1m&#10;Switch PoE&#10;PC portable Windows"
                  />
                </Field>
                <Field label="Prérequis logiciels (un par ligne)">
                  <textarea
                    className="input min-h-[80px] text-sm"
                    value={data.prereqSw}
                    onChange={(e) => update({ prereqSw: e.target.value })}
                    placeholder="Outil SADP Hikvision&#10;Chrome 110+"
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <SectionTitle>Structure du document</SectionTitle>
              <p className="text-sm text-slate-500">
                Choisissez un template prédéfini. Vous pourrez modifier librement la structure dans l'éditeur.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {templateList.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => update({ template: t.key })}
                    className={`p-4 rounded-md border-2 text-left transition-all ${
                      data.template === t.key
                        ? 'border-unitep-navy bg-unitep-navy/5'
                        : 'border-unitep-border bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className={`w-4 h-4 ${data.template === t.key ? 'text-unitep-navy' : 'text-slate-400'}`} />
                      <div className="font-semibold text-sm text-slate-900">{t.label}</div>
                      {data.template === t.key && <Check className="w-4 h-4 text-unitep-navy ml-auto" />}
                    </div>
                    <div className="text-xs text-slate-500">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <SectionTitle>Révision</SectionTitle>
              <div className="bg-unitep-gray rounded-lg p-4 space-y-2 text-sm">
                <Recap label="Titre" value={data.title} />
                <Recap label="Référence" value={data.reference || autoRef} mono />
                <Recap label="Type" value={data.type} />
                <Recap label="Catégorie" value={data.category} />
                <Recap label="Produit" value={`${data.productBrand} ${data.productModel} ${data.productHw ? '· HW ' + data.productHw : ''} ${data.productFw ? '· FW ' + data.productFw : ''}`.trim()} />
                <Recap label="Rédacteur" value={data.writer} />
                <Recap label="Accessibilité" value={data.accessibility} />
                <Recap label="Template" value={templates[data.template]?.label} />
              </div>
              <div className="bg-unitep-info-bg border-l-4 border-unitep-info text-slate-700 px-4 py-3 rounded text-sm">
                <strong>Indice A</strong> — Ce document sera créé en indice A (création initiale) avec statut « Brouillon ».
                Vous pourrez créer de nouvelles révisions depuis l'éditeur.
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-unitep-border">
          <button
            type="button"
            onClick={prev}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Précédent
          </button>
          <div className="text-xs text-slate-500">Étape {step} / 4</div>
          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!valid[step]}
              className="btn-primary"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} className="btn-primary">
              <Check className="w-4 h-4" /> Créer le document
            </button>
          )}
        </div>
      </div>

      <ProductScraperModal
        open={scraperOpen}
        onClose={() => setScraperOpen(false)}
        initialBrand={data.productBrand}
        initialModel={data.productModel}
        onApply={applyScraperResult}
      />
    </div>
  );
}

function Steps({ current }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map(({ n, label, icon: Icon }, i) => {
        const done = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex-1 flex items-center">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-unitep-navy text-white shadow-unitep-lg scale-110' : 'bg-slate-200 text-slate-500'
              }`}>
                {done ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className={`mt-2 text-xs font-medium text-center ${active ? 'text-unitep-navy' : done ? 'text-emerald-600' : 'text-slate-500'}`}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 -mt-6 ${current > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-bold text-unitep-navy mb-1">{children}</h2>;
}

function Field({ label, hint, full, children }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function Recap({ label, value, mono }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-xs text-slate-500 uppercase font-bold tracking-wide w-32 shrink-0">{label}</div>
      <div className={`flex-1 ${mono ? 'font-mono text-xs' : 'text-sm'} text-slate-900`}>{value || <span className="italic text-slate-400">non renseigné</span>}</div>
    </div>
  );
}
