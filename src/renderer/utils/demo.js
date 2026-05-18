import { uid, formatDate } from './format.js';

/**
 * Document de démonstration : Qualification caméra IP fixe Hikvision DS-2CD2143G2-I
 */
export function buildDemoDocument() {
  const today = formatDate();
  return {
    id: 'demo_hik_ds2cd2143g2',
    title: 'Qualification caméra IP fixe — Hikvision DS-2CD2143G2-I',
    reference: 'UNITEP-VID-PRO-CAM-26001',
    type: 'Procédure',
    category: 'Caméra',
    product: {
      brand: 'Hikvision',
      model: 'DS-2CD2143G2-I',
      hwVersion: '2.0',
      firmware: '5.7.15',
    },
    status: 'draft',
    indices: [
      { letter: 'A', date: today, nature: 'Création du document', writer: 'JP.CHATEAU', verifier: 'G.GRANET', approver: 'C.RICO' },
    ],
    cover: {
      entity: 'EDF - DPNT - DTEAM - UNITEP',
      summary: 'Ce document décrit les étapes de qualification de la caméra IP fixe Hikvision DS-2CD2143G2-I',
      associatedDocs: 'Fiche de recette caméra IP',
      process: 'Vidéosurveillance — Qualification produit',
      perimeter: "Sites équipés en caméras Hikvision DS-2CD2143G2-I",
      applicabilityDate: 'dès approbation',
      accessibility: 'INTERNE',
      diffusionInternal: 'UNITEP - Expertise vidéo',
      diffusionExternal: '',
    },
    writer: 'JP.CHATEAU',
    verifier: 'G.GRANET',
    approver: 'C.RICO',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: uid('sec'), level: 1, type: 'section', title: 'OBJET',
        contentType: 'text-only',
        body: "La présente procédure décrit les étapes de qualification de la caméra IP fixe Hikvision DS-2CD2143G2-I en version firmware 5.7.15. Elle permet à l'exploitant de vérifier la conformité du produit aux exigences techniques du cahier des charges.",
        steps: [],
      },
      {
        id: uid('sec'), level: 1, type: 'section', title: "PÉRIMÈTRE D'APPLICATION",
        contentType: 'text-only',
        body: "Cette procédure s'applique à toute installation de la caméra référencée sur le réseau vidéosurveillance.\n\nPrérequis :\n-Accès au réseau dédié vidéo\n-Navigateur Chrome 110+\n-Outil SADP Hikvision",
        steps: [],
      },
      {
        id: uid('sec'), level: 1, type: 'section', title: 'INSTALLATION PHYSIQUE', body: '',
        contentType: 'steps-only',
        steps: [
          {
            id: uid('step'), title: '',
            description: '-Sortir la caméra de son emballage en prenant soin de ne pas rayer le dôme\n-Vérifier la présence des accessoires : caméra, gabarit de perçage, kit de visserie, notice, joint d\'étanchéité\n-Tous les éléments doivent être présents et la caméra en parfait état esthétique',
            image: null, annotations: [], note: { type: 'info', text: 'Conserver l\'emballage jusqu\'à la fin de la qualification.' }, critical: false,
          },
          {
            id: uid('step'), title: '',
            description: "-Préparer la zone d'installation et les outils de fixation\n-Tracer les points de perçage à l'aide du gabarit\n-Percer les trous\n-Fixer la caméra à l'aide des chevilles fournies\n-La caméra doit être fermement fixée et orientée vers la zone à surveiller",
            image: null, annotations: [], note: { type: 'warning', text: 'Vérifier l\'absence de réseaux électriques dans la cloison avant perçage.' }, critical: true,
          },
        ],
      },
      {
        id: uid('sec'), level: 1, type: 'section', title: 'CONFIGURATION RÉSEAU', body: '',
        contentType: 'steps-only',
        steps: [
          {
            id: uid('step'), title: '',
            description: '-Lancer l\'outil SADP Hikvision sur un poste connecté au même VLAN que la caméra\n-Cliquer sur [Actualiser]\n-La caméra doit apparaître avec son IP par défaut (192.168.1.64)',
            image: null, annotations: [], note: null, critical: false,
          },
          {
            id: uid('step'), title: '',
            description: "-Sélectionner la caméra dans la liste SADP\n-Renseigner l'adresse IP cible, le masque, la passerelle\n-Saisir le mot de passe administrateur\n-Cliquer sur [Modifier]\n-La caméra doit accepter la nouvelle configuration et redémarrer",
            image: null, annotations: [], note: { type: 'danger', text: "Action irréversible : noter l'adresse attribuée dans le registre d'adressage." }, critical: true,
          },
        ],
      },
      {
        id: uid('sec'), level: 1, type: 'section', title: 'PARAMÉTRAGE DE LA CAMÉRA', body: '',
        contentType: 'steps-only',
        steps: [
          {
            id: uid('step'), title: '',
            description: "-Saisir l'IP attribuée dans Chrome\n-S'authentifier avec le compte administrateur\n-Au premier accès, modifier le mot de passe par défaut\n-L'interface live de la caméra doit s'afficher",
            image: null, annotations: [], note: null, critical: false,
          },
          {
            id: uid('step'), title: '',
            description: "-Naviguer dans [Configuration] → [Vidéo/Audio] → [Vidéo]\n-Régler le flux principal en H.265+ 2688x1520 25 fps\n-Régler le flux secondaire en H.264 720x480 12 fps\n-Les flux doivent être accessibles via RTSP",
            image: null, annotations: [], note: { type: 'info', text: 'Tester l\'URL RTSP avec VLC : rtsp://user:pass@IP:554/Streaming/Channels/101' }, critical: false,
          },
          {
            id: uid('step'), title: '',
            description: '-Naviguer dans [Configuration] → [Événements] → [Détection de mouvement]\n-Activer la détection\n-Dessiner les zones de détection\n-Régler la sensibilité à 60\n-Un événement doit être généré lors d\'un mouvement dans la zone définie',
            image: null, annotations: [], note: null, critical: false,
          },
        ],
      },
      {
        id: uid('sec'), level: 1, type: 'section', title: 'TESTS DE VALIDATION', body: '',
        contentType: 'steps-only',
        steps: [
          { id: uid('step'), title: '', description: "-Effectuer un ping continu sur 60 secondes vers l'IP de la caméra\n-0% de perte attendu, latence < 5 ms", image: null, annotations: [], note: null, critical: false },
          { id: uid('step'), title: '', description: '-Visualiser le live en plein jour et en condition nocturne (mode IR)\n-Image nette, basculement IR automatique fonctionnel', image: null, annotations: [], note: null, critical: false },
          { id: uid('step'), title: '', description: '-Provoquer un mouvement dans la zone définie\n-Observer les notifications\n-Notification reçue dans les 2 secondes', image: null, annotations: [], note: null, critical: false },
        ],
      },
    ],
  };
}
