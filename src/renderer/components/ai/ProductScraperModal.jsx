import { useState } from 'react';
import { X, Globe, Link2, Sparkles, Loader2, AlertCircle, Check } from 'lucide-react';
import { useAiStore } from '../../store/useAiStore.js';

/**
 * Modal "Récupérer les infos constructeur".
 *
 * Deux modes d'utilisation, dans la même fenêtre :
 *  1. URL directe : l'utilisateur colle l'URL d'une page produit officielle.
 *  2. Recherche  : on utilise marque + modèle pour trouver la page via DuckDuckGo.
 *
 * Le résultat (specs JSON) est prévisualisé avant que l'utilisateur ne décide
 * d'appliquer les valeurs au formulaire parent (callback onApply).
 */
export default function ProductScraperModal({
  open,
  onClose,
  initialBrand = '',
  initialModel = '',
  onApply,
}) {
  const [mode, setMode] = useState('search');
  const [url, setUrl] = useState('');
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState(initialModel);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);

  const loading = useAiStore((s) => s.loading.scrape);
  const scrape = useAiStore((s) => s.scrapeProduct);
  const aiAvailable = useAiStore((s) => s.available);
  const aiConfigured = useAiStore((s) => s.configured);

  if (!open) return null;

  const run = async () => {
    setError(null);
    setResult(null);
    setSource(null);
    const payload = mode === 'url'
      ? { url: url.trim(), brand: brand.trim(), model: model.trim() }
      : { brand: brand.trim(), model: model.trim() };
    if (mode === 'url' && !payload.url) {
      setError('Veuillez saisir une URL.');
      return;
    }
    if (mode === 'search' && !payload.brand && !payload.model) {
      setError('Veuillez saisir une marque ou un modèle.');
      return;
    }
    const res = await scrape(payload);
    if (!res.ok) {
      setError(res.error || 'Échec de la récupération.');
      return;
    }
    setResult(res.result);
    setSource(res.source);
  };

  const apply = () => {
    if (!result) return;
    onApply?.(result, source);
    onClose?.();
  };

  const disabledIA = !aiAvailable || aiConfigured === false;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-unitep-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-unitep-border bg-slate-50">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-unitep-navy" />
            <h2 className="font-bold text-unitep-navy">Récupérer les infos constructeur</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {disabledIA && (
            <div className="bg-unitep-warning-bg border-l-4 border-unitep-warning text-amber-900 px-4 py-3 rounded text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>IA indisponible.</strong>{' '}
                {aiAvailable
                  ? "La clé API Mistral n'est pas configurée dans cette installation. Contactez l'administrateur Qualidoc."
                  : "Cette fonctionnalité requiert l'application bureau Qualidoc V3."}
              </div>
            </div>
          )}

          <div className="flex gap-2 text-sm">
            <ModeTab
              active={mode === 'search'}
              onClick={() => setMode('search')}
              icon={Sparkles}
              label="Recherche marque + modèle"
            />
            <ModeTab
              active={mode === 'url'}
              onClick={() => setMode('url')}
              icon={Link2}
              label="URL directe"
            />
          </div>

          {mode === 'search' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Marque</label>
                <input
                  className="input"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Axis, Bosch, Genetec, Hikvision…"
                />
              </div>
              <div>
                <label className="label">Modèle</label>
                <input
                  className="input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="P3265-LVE"
                />
              </div>
              <div className="col-span-2 text-xs text-slate-500">
                Qualidoc utilise DuckDuckGo pour identifier la page officielle, puis Mistral pour extraire les caractéristiques techniques.
              </div>
            </div>
          )}

          {mode === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="label">URL de la page produit constructeur</label>
                <input
                  className="input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.axis.com/products/axis-p3265-lve"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Marque (contexte, facultatif)</label>
                  <input
                    className="input"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Axis"
                  />
                </div>
                <div>
                  <label className="label">Modèle (contexte, facultatif)</label>
                  <input
                    className="input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="P3265-LVE"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={run}
              disabled={loading || disabledIA}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Lancer la recherche
                </>
              )}
            </button>
            {loading && (
              <span className="text-xs text-slate-500">
                Mistral analyse la page constructeur, cela peut prendre 10 à 30 secondes.
              </span>
            )}
          </div>

          {error && (
            <div className="bg-unitep-danger-bg border-l-4 border-unitep-danger text-red-900 px-4 py-3 rounded text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {result && (
            <div className="border border-unitep-border rounded-md overflow-hidden">
              <div className="bg-emerald-50 border-b border-unitep-border px-4 py-2 flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-600" />
                <strong>Informations extraites</strong>
                {source?.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs text-unitep-navy hover:underline truncate max-w-[260px]"
                    title={source.url}
                  >
                    Source : {new URL(source.url).hostname}
                  </a>
                )}
              </div>
              <ResultPreview data={result} />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-unitep-border bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button
            onClick={apply}
            disabled={!result}
            className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" /> Appliquer au formulaire
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors text-xs font-medium ${
        active
          ? 'border-unitep-navy bg-unitep-navy text-white'
          : 'border-unitep-border bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function ResultPreview({ data }) {
  const rows = [
    ['Marque', data.brand],
    ['Modèle', data.model],
    ['Catégorie', data.category],
    ['Version HW', data.hwVersion],
    ['Dernier firmware', data.firmwareLatest],
    ['Date firmware', data.firmwareReleaseDate],
    ['Alimentation', data.powerSupply],
    ['Protocoles', Array.isArray(data.protocols) ? data.protocols.join(', ') : data.protocols],
    ['Dimensions', data.dimensions],
    ['Poids', data.weight],
    ['Temp. fonctionnement', data.operatingTempRange],
    ['Indice IP/IK', data.ipRating],
    ['Datasheet', data.datasheet],
  ];

  return (
    <div className="p-4 space-y-3">
      {data.summary && (
        <p className="text-sm text-slate-700 italic border-l-2 border-unitep-navy pl-3">
          {data.summary}
        </p>
      )}
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 text-xs uppercase font-bold tracking-wide text-slate-500 w-44 align-top">
                {label}
              </td>
              <td className="py-1.5 text-slate-900">
                {val ? (
                  typeof val === 'string' && val.startsWith('http') ? (
                    <a
                      href={val}
                      target="_blank"
                      rel="noreferrer"
                      className="text-unitep-navy hover:underline break-all"
                    >
                      {val}
                    </a>
                  ) : (
                    String(val)
                  )
                ) : (
                  <span className="text-slate-400 italic">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
