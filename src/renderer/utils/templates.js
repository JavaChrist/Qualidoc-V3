import { uid } from './format.js';

/**
 * Templates de structure prédéfinis pour la création de procédures UNITEP V3.
 *
 * Format : chaque template renvoie un tableau plat de sections, le champ
 * `level` (1/2/3) portant la hiérarchie. La propriété `contentType`
 * indique au rendu si on doit afficher uniquement le body, uniquement le
 * tableau d'étapes, ou les deux :
 *   - 'text-only'  → body sans tableau (chapitres OBJET, CONVENTIONS, …)
 *   - 'steps-only' → tableau Action/Illustration sans body intro
 *   - 'mixed'      → body + tableau (par défaut)
 */

function section({ title, level = 1, body = '', steps = [], contentType }) {
  return {
    id: uid('sec'),
    type: 'section',
    title,
    level,
    body,
    steps,
    contentType: contentType || (steps.length === 0 ? 'text-only' : body ? 'mixed' : 'steps-only'),
  };
}

function step(title, description = '') {
  return {
    id: uid('step'),
    title,
    description,
    image: null,
    annotations: [],
    note: null,
    critical: false,
  };
}

// Les chapitres de base contiennent UNIQUEMENT les titres normalisés UNITEP.
// Le body reste volontairement vide : le résumé saisi dans NewDocument étape 2
// alimente la page de garde (cover.summary / cover.perimeter), pas le corps du
// document. Le rédacteur complète ces chapitres avec un texte plus détaillé
// directement dans l'éditeur.
const baseChapters = () => [
  section({ title: 'OBJET', level: 1, body: '', contentType: 'text-only' }),
  section({ title: "PÉRIMÈTRE D'APPLICATION", level: 1, body: '', contentType: 'text-only' }),
];

export const templates = {
  qualification: {
    label: 'Qualification produit',
    description: 'Déballage → Installation → Configuration → Tests → Recette',
    build: () => [
      ...baseChapters(),
      section({
        title: 'INSTALLATION PHYSIQUE', level: 1,
        steps: [
          step('', "-Vérifier le contenu du carton et l'état du matériel\n-Tous les éléments doivent être présents et en bon état"),
          step('', '-Fixer le produit sur son support conformément à la documentation constructeur\n-Vérifier que le produit est solidement fixé'),
        ],
        contentType: 'steps-only',
      }),
      section({
        title: 'CONFIGURATION RÉSEAU', level: 1,
        steps: [
          step('', "-Lancer l'outil de découverte constructeur (SADP, AXIS IP Utility...)\n-Le produit doit apparaître dans la liste"),
          step('', "-Configurer l'adresse IP statique selon le plan d'adressage\n-Vérifier que le produit répond au ping sur la nouvelle IP"),
        ],
        contentType: 'steps-only',
      }),
      section({
        title: 'PARAMÉTRAGE', level: 1,
        steps: [
          step('', "-Saisir l'IP dans un navigateur et s'authentifier\n-L'interface d'administration doit s'afficher"),
          step('', '-Paramétrer les flux principal et secondaire\n-Vérifier que les flux sont opérationnels'),
        ],
        contentType: 'steps-only',
      }),
      section({
        title: 'TESTS DE VALIDATION', level: 1,
        steps: [
          step('', "-Vérifier la qualité d'image jour/nuit\n-L'image doit être conforme aux exigences"),
          step('', '-Tester détection, alarmes, audio si applicables\n-Toutes les fonctions doivent être opérationnelles'),
        ],
        contentType: 'steps-only',
      }),
      section({
        title: 'RECETTE', level: 1,
        body: 'Compléter la fiche de recette associée et la faire signer par le client.',
        contentType: 'text-only',
      }),
    ],
  },

  firmware: {
    label: 'Mise à jour firmware',
    description: 'Prérequis → Sauvegarde → Téléchargement → Mise à jour → Vérification',
    build: () => [
      ...baseChapters(),
      section({ title: 'PRÉREQUIS', level: 1, contentType: 'text-only' }),
      section({
        title: 'MATÉRIEL NÉCESSAIRE', level: 2,
        body: "-Avoir les derniers fichiers de mise à jour LTS\n-Avoir un accès navigateur (Firefox, Chrome) à jour\n-Les informations concernant l'adressage IP du produit\n-Un accès facile au mot de passe",
        contentType: 'text-only',
      }),
      section({
        title: 'PRÉPARATION', level: 2,
        body: "-Enregistrer les nouveaux firmwares dans une partition accessible\n-Ouvrir le navigateur et saisir l'adresse IP\n-Rentrer l'identifiant et le mot de passe\n-Contrôler les zones de masquage et faire une impression écran si nécessaire",
        contentType: 'text-only',
      }),
      section({
        title: "CONVENTION D'ÉCRITURE", level: 1,
        body: "Texte en gras : menu ou champ de configuration\n<Texte_en_italique_courrier> : texte à saisir par l'intégrateur\nTexte en police courrier : nom de fichier ou de répertoire\n[Texte entre crochets] : objet (bouton, case à cocher) sur lequel agir",
        contentType: 'text-only',
      }),
      section({
        title: 'MISE À JOUR FIRMWARE', level: 1,
        body: 'La montée de version peut nécessiter un palier si la version est trop ancienne.',
        steps: [
          step('', "-Exporter la configuration actuelle depuis l'interface d'administration\n-Le fichier de configuration doit être téléchargé localement"),
          step('', '-Télécharger le firmware cible depuis le site constructeur\n-Le fichier .bin/.zip doit être disponible localement'),
          step('', '-Naviguer dans [Maintenance] → [Mise à niveau]\n-Charger le firmware\n-Cliquer sur [Mise à niveau]'),
          step('', '-Contrôler la version après redémarrage automatique\n-La nouvelle version doit être affichée'),
        ],
        contentType: 'mixed',
      }),
      section({
        title: 'APRÈS REDÉMARRAGE', level: 1,
        body: 'À la fin du redémarrage, contrôler que le produit est bien à jour. Contrôler le paramétrage en suivant la documentation de mise en service.',
        contentType: 'text-only',
      }),
    ],
  },

  installation: {
    label: 'Installation complète',
    description: 'Prérequis → Câblage → Mise sous tension → Config IP → Intégration VMS → Tests',
    build: () => [
      ...baseChapters(),
      section({ title: 'PRÉREQUIS', level: 1, contentType: 'text-only' }),
      section({
        title: 'CÂBLAGE', level: 1, contentType: 'steps-only',
        steps: [
          step('', "-Tirer le câble entre le local technique et le point d'installation"),
          step('', '-Sertir le connecteur RJ45 selon la norme T568B'),
        ],
      }),
      section({
        title: 'MISE SOUS TENSION', level: 1, contentType: 'steps-only',
        steps: [
          step('', '-Brancher le câble PoE\n-Vérifier la LED de mise sous tension'),
        ],
      }),
      section({
        title: 'CONFIGURATION IP', level: 1, contentType: 'steps-only',
        steps: [
          step('', "-Lancer l'outil de découverte réseau"),
          step('', "-Attribuer l'adresse IP fixe selon le plan d'adressage"),
        ],
      }),
      section({
        title: 'INTÉGRATION VMS', level: 1, contentType: 'steps-only',
        steps: [
          step('', '-Ajouter le produit dans le VMS'),
          step('', "-Configurer le profil d'enregistrement"),
        ],
      }),
      section({
        title: 'TESTS', level: 1, contentType: 'steps-only',
        steps: [
          step('', "-Tester l'enregistrement continu"),
          step('', '-Tester la relecture des séquences'),
        ],
      }),
    ],
  },

  blank: {
    label: 'Procédure vierge',
    description: 'Structure libre, à compléter selon vos besoins',
    build: () => [
      ...baseChapters(),
    ],
  },
};

export const templateList = Object.entries(templates).map(([key, t]) => ({
  key,
  label: t.label,
  description: t.description,
}));
