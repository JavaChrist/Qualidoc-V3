import { create } from 'zustand';
import { storage, isInElectron } from '../utils/storage.js';

const KEY = 'settings';

const defaults = {
  company: {
    name: 'EDF - DPNT - DTEAM - UNITEP',
    address: '300 Avenue du Prado - immeuble Prado 13800 MARSEILLE',
    phone: '',
    email: '',
    website: '',
    copyright: 'Copyright EDF - Ce document est la propriété d\'EDF. Toute communication, reproduction, publication, même partielle, est interdite sauf autorisation écrite.',
    legalLine: 'EDF-SA au capital de 1 505 133 838 euros - 552 081 317 R.C.S Paris',
    division: 'DIRECTION DU PARC NUCLEAIRE ET THERMIQUE - DIVISION THERMIQUE EXPERTISE APPUI INDUSTRIEL MULTI-METIERS',
    logo: null,
    logoSecondary: null,
  },
  users: [
    { id: 'u1', firstName: 'CH.', lastName: 'GROHENS', role: 'Rédacteur', entity: 'UNITEP', signature: null },
  ],
  products: [
    { id: 'p1', brand: 'Axis', model: 'P3265-LVE', category: 'Caméra IP dôme fixe extérieure', hwVersion: '1.0', firmwares: ['11.10.85'] },
    { id: 'p2', brand: 'Axis', model: 'Q6135-LE', category: 'Caméra IP PTZ extérieure', hwVersion: '1.0', firmwares: ['11.10.85'] },
    { id: 'p3', brand: 'Bosch', model: 'NBE-7702-AL', category: 'Caméra IP fixe Starlight', hwVersion: '1.0', firmwares: ['8.10.0026'] },
    { id: 'p4', brand: 'Bosch', model: 'NDP-7512-Z30', category: 'Caméra IP PTZ', hwVersion: '1.0', firmwares: ['8.10.0026'] },
    { id: 'p5', brand: 'Genetec / Sharp', model: 'SharpV (Gen 3)', category: 'Caméra LPR (lecture de plaque) — AutoVu', hwVersion: 'VG3', firmwares: ['13.7'] },
    { id: 'p6', brand: 'Genetec', model: 'AutoVu', category: 'Module reconnaissance de plaques (ALPR)', hwVersion: 'N/A', firmwares: ['5.11 SR3'] },
    { id: 'p7', brand: 'Genetec', model: 'Synergis Cloud Link', category: "Contrôleur d'accès", hwVersion: '1.0', firmwares: ['3.0'] },
    { id: 'p8', brand: 'Genetec', model: 'Security Center', category: 'Plateforme de supervision', hwVersion: 'N/A', firmwares: ['5.11 SR3'] },
  ],
  templates: [],
  export: {
    defaultPath: '',
    format: 'both',
    dpi: 150,
  },
};

export const useSettingsStore = create((set, get) => ({
  ...defaults,
  loaded: false,

  hydrate: async () => {
    const s = await storage.get(KEY);
    if (s) set({ ...defaults, ...s, loaded: true });
    else set({ loaded: true });
  },

  persist: async () => {
    const { loaded, hydrate, persist, update, ...data } = get();
    await storage.set(KEY, data);
  },

  update: async (patch) => {
    set(patch);
    await get().persist();
  },

  updateCompany: async (company) => {
    set({ company: { ...get().company, ...company } });
    await get().persist();
  },

  addUser: async (user) => {
    const u = { id: `u_${Date.now()}`, ...user };
    set({ users: [...get().users, u] });
    await get().persist();
  },

  updateUser: async (id, patch) => {
    set({ users: get().users.map((u) => u.id === id ? { ...u, ...patch } : u) });
    await get().persist();
  },

  removeUser: async (id) => {
    set({ users: get().users.filter((u) => u.id !== id) });
    await get().persist();
  },

  addProduct: async (p) => {
    const np = { id: `p_${Date.now()}`, ...p };
    set({ products: [...get().products, np] });
    await get().persist();
  },

  updateProduct: async (id, patch) => {
    set({ products: get().products.map((p) => p.id === id ? { ...p, ...patch } : p) });
    await get().persist();
  },

  removeProduct: async (id) => {
    set({ products: get().products.filter((p) => p.id !== id) });
    await get().persist();
  },
}));
