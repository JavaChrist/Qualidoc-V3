import { Sparkles, Loader2 } from 'lucide-react';

/**
 * Bouton générique "Générer avec IA" — réutilisable partout dans l'app.
 *
 * Préserve la charte UNITEP :
 *  - couleur principale : unitep-navy (#003366)
 *  - accent IA          : unitep-step (#FF6F00) en hover
 *  - aucune image / aucun emoji ajouté
 */
export default function AIGenerateButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Générer avec IA',
  loadingLabel = 'Génération…',
  size = 'sm',
  variant = 'primary',
  title,
}) {
  const sizeClass = size === 'xs'
    ? 'text-xs px-2 py-1 gap-1'
    : size === 'md'
      ? 'text-sm px-3 py-2 gap-1.5'
      : 'text-xs px-2.5 py-1.5 gap-1.5';

  const variantClass = variant === 'ghost'
    ? 'bg-transparent text-unitep-navy hover:bg-unitep-navy/5 border border-unitep-border'
    : 'bg-unitep-navy text-white hover:bg-unitep-step';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title || label}
      className={`inline-flex items-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}
