# Qualidoc V3 — Génération de procédures UNITEP assistée par IA

Application de bureau **Electron + React + Tailwind** pour la génération
automatisée de procédures techniques de qualification vidéosurveillance,
respectant strictement le **gabarit documentaire UNITEP / EDF — DTEAM**.

La V3 ajoute une intégration **Mistral AI** pour assister la rédaction :
génération du texte d'une étape à partir d'une capture d'écran et
récupération automatique des caractéristiques techniques depuis les
sites constructeurs.

![Stack](https://img.shields.io/badge/Electron-33-47848F?logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Mistral](https://img.shields.io/badge/Mistral-AI-FF7000)

---

## Fonctionnalités

- **Tableau de bord** : liste de tous les documents avec filtres par type,
  catégorie, statut (brouillon / approuvé / archivé), recherche full-text
  et actions (ouvrir, dupliquer, valider, archiver, supprimer).
- **Assistant de création en 4 étapes** : informations générales →
  périmètre → choix d'un template structurel (qualification, mise à jour
  firmware, installation complète, vierge) → révision. Étape 1 :
  **sélecteur rapide depuis le catalogue produits** qui pré-remplit
  marque, modèle, catégorie, version HW et firmware testé en un clic,
  avec autocomplétion en cascade sur les 4 champs (datalists filtrés
  par marque/modèle).
- **Éditeur 3 colonnes** :
  - Arborescence du document (sections + étapes) avec actions de
    déplacement et suppression.
  - Éditeur d'étapes simplifié (titre, action à réaliser, image
    annotée, note / avertissement / danger, marqueur étape critique).
  - Panneau latéral : métadonnées, page de garde, historique des indices.
- **Annotation d'images non-destructive** : flèches orientables,
  rectangles, cercles, surbrillance, texte libre, numérotation. Calque SVG
  séparé fusionné uniquement à l'export.
- **Prévisualisation A4** : rendu fidèle au gabarit UNITEP avec en-tête,
  pied de page, page de garde, table des matières et **pagination
  dynamique mesurée au pixel près** (regroupement automatique des sections
  courtes pour éviter les pages à demi vides).
- **Export DOCX** (`docx.js`) reproduisant le gabarit exact (header 3
  colonnes, footer, styles Word UNITEP).
- **Export PDF** via Puppeteer headless dans le main process Electron, A4
  portrait avec marges de référence.
- **Échange de documents `.qdoc`** : export et import d'un document
  complet (structure + images base64 + annotations) en un seul fichier
  JSON. Permet de transmettre une procédure d'un poste à un autre sans
  passer par un serveur ou un partage réseau.
- **Versioning par indice** : conservation de l'indice A + des deux
  derniers indices, conformément au gabarit EDF.
- **Mode lecture seule** automatique pour les documents approuvés.
- **Autosave** toutes les 30 s + raccourcis clavier (Ctrl+S, Ctrl+P,
  Ctrl+Shift+N).
- **Stockage local** persistant via `electron-store` (JSON), aucune
  donnée envoyée sur Internet (hors appels IA Mistral explicites).
- **Assistance IA Mistral (nouveau V3)** :
  - **Vision** : un bouton « Générer le texte avec IA » sous chaque
    illustration analyse la capture et propose le libellé de l'action,
    en respectant le ton technique UNITEP (verbes à l'impératif,
    boutons entre crochets, vocabulaire vidéosurveillance). Le texte
    généré reste toujours modifiable. Le bouton est déclenché
    manuellement : aucun appel API n'a lieu sans action de l'utilisateur.
  - **Scraping constructeur** : depuis l'assistant *Nouveau document*,
    un bouton « Récupérer les infos en ligne » lance Puppeteer sur la
    page produit officielle (Axis, Bosch, Genetec, Hikvision, Dahua…)
    et utilise Mistral pour extraire marque, modèle, version HW, dernier
    firmware, alimentation, protocoles, dimensions, indice IP/IK, etc.
    Une prévisualisation du JSON extrait s'affiche avant application.
  - **Charte EDF préservée** : l'IA ne génère que du contenu textuel.
    Les logos, couleurs, en-tête, pied de page, page de garde et
    structure documentaire UNITEP restent strictement gérés par
    l'application.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework UI | **React 18** + **Vite 5** |
| Desktop | **Electron 33** + electron-builder |
| Style | **Tailwind CSS v3** + couleurs custom UNITEP |
| État | **Zustand** |
| Routing | **React Router v6** (HashRouter) |
| Export Word | **docx.js** |
| Export PDF | **Puppeteer** (main process via IPC) |
| Images | **sharp** (optimisation côté main process) |
| Stockage | **electron-store** + fallback localStorage |
| Icônes | **Lucide React** |
| IA — Vision | **Mistral Pixtral** (`pixtral-12b-2409`) via fetch natif |
| IA — Extraction | **Mistral Large** (`mistral-large-latest`) |
| IA — Reformulation | **Mistral Small** (`mistral-small-latest`) |
| Scraping | **Puppeteer** (déjà utilisé pour l'export PDF) |

---

## Installation et lancement

### Prérequis

- **Node.js 18+** (recommandé : 20 LTS)
- **npm 9+**
- Connexion Internet pour le premier `npm install` (Puppeteer télécharge
  Chromium ≈ 170 Mo)

### Installation

```bash
npm install
```

### Mode développement

```bash
npm run dev
```

Lance Vite (`http://localhost:5173`) puis Electron en mode dev avec
DevTools détachées.

### Build de production

```bash
npm run build
```

Génère le binaire dans `release/` (NSIS pour Windows).

### Déploiement web (Vercel)

Qualidoc V3 peut aussi être déployé comme application web Vite sur Vercel
pour partager l'outil avec l'équipe via une URL. L'IA Mistral reste
disponible grâce à des **fonctions serverless** (`api/ai/*`) qui détiennent
la clé API en variable d'environnement (jamais exposée au browser).

**Configuration :**

1. Importer le repo dans Vercel (framework auto-détecté : Vite).
2. Dans **Project → Settings → Environment Variables**, créer :
   - Nom : `MISTRAL_API_KEY`
   - Valeur : votre clé Mistral
   - Environnements : `Production`, `Preview`, `Development`
3. Redéployer.

Côté UI, le runtime est automatiquement détecté :
- App desktop installée → appels via IPC Electron (clé figée dans le binaire).
- URL Vercel → appels HTTP vers `/api/ai/*` (clé côté serveur).

**Limites en mode web :** le scraping constructeur (Puppeteer + Chromium
headless) reste uniquement disponible dans l'app desktop. Le bouton
« Récupérer les infos en ligne » est masqué sur la version web. La
génération de texte par IA, la reformulation et le test de connexion
fonctionnent dans les deux runtimes.

---

## Structure du projet

```
qualidoc-v3/
├── src/
│   ├── main/                  # Processus Electron principal (IPC, store, sharp, puppeteer)
│   │   ├── main.js
│   │   └── ai/                # Intégration Mistral (clé API confinée au main)
│   │       ├── config.js      # Clé figée + modèles par défaut + timeouts
│   │       ├── mistralClient.js # Wrapper fetch api.mistral.ai (chat + vision)
│   │       ├── prompts.js     # Prompts système UNITEP (vision, extraction, reformulation)
│   │       └── scraper.js     # Puppeteer + recherche DuckDuckGo + nettoyage HTML
│   ├── preload/               # Pont sécurisé contextIsolation (expose window.qualidoc.ai.*)
│   │   └── preload.cjs
│   └── renderer/              # Application React
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.html
│       ├── index.css          # Tailwind + classes UNITEP
│       ├── components/
│       │   ├── layout/        # Shell, Toast
│       │   ├── editor/        # StepEditor (+ bouton IA), DocumentTree, ImageDropzone, AnnotationCanvas
│       │   ├── preview/       # UnitepHeader/Footer, CoverPage, RevisionTable, WarningBlock,
│       │   │                  # StepNumber, StepPreview, TableOfContents, UnitepDocument
│       │   ├── ai/            # AIGenerateButton, ProductScraperModal
│       │   └── export/        # ExportModal
│       ├── pages/             # Dashboard, NewDocument (+ scraping), Editor, Preview, Settings (+ onglet IA)
│       ├── store/             # Zustand stores (documents, settings, UI, ai)
│       └── utils/             # storage, format, demo, templates, exportDocx, exportHtml, ai
├── icone/                     # Logos EDF/UNITEP + favicons
├── tailwind.config.js         # Couleurs unitep.* customisées
├── vite.config.js             # Vite avec root src/renderer
└── package.json
```

---

## Gabarit UNITEP respecté

### Couleurs

| Usage | Hex | Tailwind |
|---|---|---|
| Bleu marine institutionnel | `#003366` | `unitep-navy` |
| Orange EDF / étape critique | `#FF6F00` | `unitep-step` |
| Avertissement | `#FFC107` | `unitep-warning` |
| Danger | `#DC3545` | `unitep-danger` |
| Note info | `#17A2B8` | `unitep-info` |

### Typographie

- Police : **Arial** (avec Inter en fallback web)
- Titre niveau 1 : **12 pt gras MAJUSCULES**
- Titre niveau 2 : **11 pt gras MAJUSCULES**
- Titre niveau 3 : **11 pt gras casse normale**
- Corps : **10 pt** justifié
- Notes : **8 pt**

### Structure documentaire

1. **En-tête fixe** : tableau 3 colonnes (logo · titre+indice · pages+ref)
2. **Page de garde** : entité, résumé, type, processus, périmètre, indices,
   accessibilité (LIBRE/INTERNE/RESTREINT/CONFIDENTIEL), liste de diffusion
3. **Table des matières** automatique
4. **Corps** : sections numérotées 1, 1.1, 1.1.1
5. **Pied de page fixe** : copyright + adresse + Page X / Y

### Étape technique (tableau 4 colonnes UNITEP)

| N° | Action à réaliser | Illustration | ☐ |
|----|-------------------|--------------|---|
| Badge rond bleu marine | Description complète de l'action | Capture annotée | Case à cocher |

Avec optionnellement :

- Encadré coloré **NOTE / ATTENTION / DANGER**
- Mise en évidence **étape critique** (bordure orange 4 px)

---

## Intégration IA Mistral (V3)

### Vue d'ensemble

Qualidoc V3 utilise l'API Mistral pour assister la rédaction sans
jamais altérer la charte documentaire UNITEP. Toute la logique IA
est confinée au **processus Electron principal** : la clé API ne
transite jamais par le renderer, et le `contextIsolation` reste
activé.

| Cas d'usage | Modèle | Déclencheur |
|---|---|---|
| Texte d'étape depuis une capture | `pixtral-12b-2409` | Bouton manuel « Générer le texte avec IA » sous l'image |
| Extraction de specs constructeur | `mistral-large-latest` | Bouton « Récupérer les infos en ligne » dans NewDocument |
| Reformulation de texte (futur) | `mistral-small-latest` | Réservé |

### Clé API (figée par installation)

La clé Mistral est **commune à tous les postes EDF** utilisant Qualidoc V3
et est intégrée au binaire NSIS lors du build. Elle est définie dans :

```
src/main/ai/config.js   →  const MISTRAL_API_KEY_BUILTIN = '...';
```

Ordre de résolution au runtime :

1. `process.env.MISTRAL_API_KEY` (dev / build CI)
2. Constante `MISTRAL_API_KEY_BUILTIN`

Pour **changer la clé** : éditer cette constante puis exécuter
`npm run build`. La clé n'apparaît jamais dans le bundle Vite
(qui ne contient que le code renderer).

L'onglet **Paramètres → IA Mistral** affiche l'état (clé configurée,
modèles utilisés, test de connexion) sans jamais exposer la clé.

### Confidentialité et flux réseau

L'application reste **100 % locale** côté stockage : aucun document
n'est envoyé sur un serveur tiers. Les seules sorties réseau sont :

- `api.mistral.ai` lors d'un appel IA explicite (bouton utilisateur) ;
- Le site constructeur ciblé + `html.duckduckgo.com` lors d'un
  scraping (bouton utilisateur).

Si le poste EDF est derrière un proxy/firewall strict, ces domaines
doivent être autorisés. À défaut, l'application reste fonctionnelle
sans IA (les boutons IA affichent un message d'indisponibilité).

### Génération du texte d'une étape (Vision)

Dans l'éditeur, sous chaque illustration, un bouton compact apparaît :

> ✨ Générer le texte avec IA

Au clic, Mistral Pixtral reçoit :

- l'image de l'étape (base64) ;
- un prompt système calibré pour le ton technique UNITEP ;
- le contexte : marque + modèle (page de garde), titre de la
  section courante, type de document (procédure, mode opératoire…).

La réponse JSON peuple :

- `description` : libellé de l'action (verbe à l'impératif, boutons
  entre crochets, une action par ligne préfixée d'un tiret) ;
- `title` : titre de l'étape si le champ est vide ;
- `note` : encadré NOTE/ATTENTION/DANGER suggéré si pertinent ;
- `critical` : flag étape critique si l'action est irréversible.

L'utilisateur peut toujours **modifier le texte généré** : l'IA propose,
le rédacteur valide.

### Récupération des infos constructeur (Scraping)

Depuis l'étape 1 de l'assistant *Nouveau document*, un bouton :

> 🌐 Récupérer les infos en ligne

ouvre une fenêtre permettant deux modes :

1. **Recherche** : marque + modèle → DuckDuckGo HTML identifie la page
   officielle (priorité aux domaines connus : `axis.com`,
   `boschsecurity.com`, `genetec.com`, `hikvision.com`, etc.) ;
2. **URL directe** : l'utilisateur colle l'URL d'une page produit.

Puppeteer charge la page, le HTML est nettoyé (suppression scripts,
styles, SVG, attributs inutiles) puis envoyé à Mistral Large pour
extraction structurée :

```json
{
  "brand": "...", "model": "...", "category": "...",
  "hwVersion": "...", "firmwareLatest": "...", "firmwareReleaseDate": "...",
  "powerSupply": "...", "protocols": [...], "dimensions": "...",
  "weight": "...", "operatingTempRange": "...", "ipRating": "...",
  "datasheet": "...", "summary": "..."
}
```

La prévisualisation affiche tous les champs, le bouton **Appliquer au
formulaire** remplit les inputs de l'assistant (marque, modèle, version
HW, firmware, catégorie, objet).

### Gabarit UNITEP préservé

L'IA **n'écrit jamais** dans les composants suivants :

- `UnitepHeader`, `UnitepFooter` (en-tête / pied de page)
- `CoverPage`, `RevisionTable` (page de garde, indices)
- Logos, couleurs, structure documentaire

Elle alimente uniquement les champs texte des étapes et les
métadonnées produit. La charte EDF / UNITEP reste strictement
inchangée.

---

## Données par défaut au premier lancement

L'application initialise automatiquement le fichier
`%APPDATA%\qualidoc-v3\qualidoc-data.json` avec :

- **1 utilisateur** (rédacteur) — à adapter dans `Paramètres → Utilisateurs`
- **Catalogue produits** orienté périmètre vidéosurveillance / contrôle
  d'accès :
  - Axis P3265-LVE, Q6135-LE
  - Bosch NBE-7702-AL, NDP-7512-Z30
  - Genetec / Sharp SharpV (Gen 3) — caméra LPR AutoVu
  - Genetec AutoVu, Synergis Cloud Link, Security Center
- **Document de démonstration** : *Qualification caméra IP fixe* avec
  6 sections types pré-remplies.

### Logos par défaut

Au tout premier démarrage de l'application, deux logos sont chargés
automatiquement depuis le dossier `icone/` :

- **Logo principal** (header gauche) : `icone/LogoEDF-1.png`
- **Logo secondaire** (header droit) : `icone/logoUnitep.png`

Une fois cette initialisation faite (flag `logosInitialized` dans le
fichier de données), les logos peuvent être librement **supprimés** ou
**remplacés** via `Paramètres → Société` : ils ne seront plus jamais
restaurés automatiquement au démarrage suivant. Ce comportement
garantit que toute personnalisation est respectée et persistante.

## Échange de documents entre postes

L'application étant 100 % locale (aucune donnée n'est envoyée sur le
réseau), le partage d'un document entre deux postes se fait via un
fichier `.qdoc` :

- **Côté A** : Dashboard → menu ⋮ d'une ligne → **Exporter (.qdoc)** →
  choisir où sauver le fichier.
- **Côté B** : Dashboard → bouton **Importer** → sélectionner le `.qdoc`
  reçu (mail / clé USB / Teams). Le document apparaît avec un nouvel
  identifiant interne, le statut « brouillon » et est immédiatement
  modifiable.

Le fichier `.qdoc` est un JSON unique embarquant l'intégralité du
document : sections, étapes, captures (base64), annotations, indices,
page de garde.

---

## Raccourcis clavier (Éditeur)

| Raccourci | Action |
|---|---|
| `Ctrl+S` | Enregistrer |
| `Ctrl+P` | Prévisualiser |
| `Ctrl+Shift+N` | Nouvelle étape dans la section sélectionnée |
| `Ctrl+V` | Coller image depuis le presse-papier |
| `Ctrl+Z` (annotation) | Annuler la dernière annotation |
| `Suppr` (annotation) | Supprimer l'annotation sélectionnée |
| `Échap` (annotation) | Fermer l'éditeur d'annotation |

---

## Notes techniques

- **Annotations non-destructives** : l'image originale reste intacte ; les
  annotations sont stockées au format SVG (viewBox 0 0 1000 1000) et
  fusionnées uniquement lors du rendu (preview, DOCX, PDF).
- **Puppeteer** est lancé dans le main process Electron via IPC pour
  éviter les problèmes de sécurité contextIsolation.
- **Toutes les images** sont stockées en base64 dans `electron-store`
  pour assurer la portabilité du document (un seul fichier JSON contient
  tout : texte + images).
- **Optimisation images** : redimensionnement automatique à 1600 px max et
  ré-encodage JPEG qualité 85 via **sharp** (sauf SVG conservé).
- **Pagination preview** : double passe en `useLayoutEffect` — mesure
  cumulative DOM des sections + mesure dynamique de la zone utile A4 →
  les sections courtes sont regroupées sur une même page (plus de pages
  à demi vides).
- **Lecture seule** : un document au statut « approuvé » ne peut plus
  être modifié. Pour le modifier, créer une nouvelle révision (qui
  incrémente l'indice et repasse au statut « brouillon »).
- **Emplacement des données** :
  - en dev : `%APPDATA%\qualidoc-v3\qualidoc-data.json`
  - en build NSIS : `%APPDATA%\Qualidoc V3\qualidoc-data.json`
  - Les données de Qualidoc V2 (`%APPDATA%\Qualidoc V2\`) ne sont **pas
    importées automatiquement** : la V3 démarre avec un dossier vierge
    pour éviter d'écraser un historique de procédures existantes.
- **IA Mistral** : tous les appels passent par le main process via IPC
  (`ai:generateStepText`, `ai:scrapeProduct`, `ai:testConnection`,
  `ai:status`). Le renderer ne voit jamais la clé API. Toutes les
  erreurs réseau / API sont traduites en `{ ok: false, code, error }`
  pour faciliter le rendu UI sans dépendre d'exceptions.

---

## Personnalisation

Modifiez `tailwind.config.js` pour ajuster les couleurs UNITEP. Les valeurs
`#003366`, `#FF6F00`, etc. peuvent être adaptées aux chartes graphiques
d'autres entités.

Pour modifier les templates de structure, éditez
`src/renderer/utils/templates.js` (chaque template renvoie un tableau de
sections avec leurs étapes initiales).

---

## Licence

Application interne UNITEP — usage selon les directives EDF DTEAM.

Copyright © 2026 — Tous droits réservés.
