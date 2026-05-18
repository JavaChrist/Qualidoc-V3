/**
 * Charte de couleurs UNITEP / EDF appliquée à la prévisualisation
 * et à l'export DOCX/PDF.
 *
 * Règles de la charte (validées par DTEAM-UNITEP) :
 *   - Titres niveau 1 (1., 2., 3., …)   → orange EDF
 *   - Titres niveau 2 et 3 (1.1, 1.1.1) → gris foncé
 *   - En-têtes de tableaux              → bleu marine EDF + texte blanc
 *
 * Deux formats sont exposés :
 *   - `*` : code couleur CSS avec dièse (utilisé dans la preview HTML/PDF).
 *   - `*Hex` : même couleur sans dièse (utilisée par docx.js qui réclame
 *     les couleurs au format hexadécimal pur).
 */

export const COLORS = {
  // Orange EDF (titres niveau 1)
  titleLevel1: '#FF6F00',
  titleLevel1Hex: 'FF6F00',

  // Gris foncé (titres niveau 2 et 3)
  titleLevel2: '#595959',
  titleLevel2Hex: '595959',
  titleLevel3: '#595959',
  titleLevel3Hex: '595959',

  // Bleu marine EDF (en-têtes de tableaux et bandeaux)
  tableHeaderBg: '#003366',
  tableHeaderBgHex: '003366',
  tableHeaderText: '#FFFFFF',
  tableHeaderTextHex: 'FFFFFF',
};

/**
 * Retourne la couleur CSS d'un titre de section selon son niveau.
 */
export function titleColor(level) {
  if (level === 1) return COLORS.titleLevel1;
  if (level === 2) return COLORS.titleLevel2;
  return COLORS.titleLevel3;
}

/**
 * Variante docx (hex sans dièse) pour exportDocx.js.
 */
export function titleColorHex(level) {
  if (level === 1) return COLORS.titleLevel1Hex;
  if (level === 2) return COLORS.titleLevel2Hex;
  return COLORS.titleLevel3Hex;
}
