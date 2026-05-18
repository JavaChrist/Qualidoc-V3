/**
 * Pont d'accès au stockage Electron (avec fallback localStorage pour mode web).
 */
const isElectron = typeof window !== 'undefined' && !!window.qualidoc?.app?.isElectron;

export const storage = {
  async get(key) {
    if (isElectron) return await window.qualidoc.store.get(key);
    const v = localStorage.getItem(key);
    try { return v ? JSON.parse(v) : null; } catch { return v; }
  },
  async set(key, value) {
    if (isElectron) return await window.qualidoc.store.set(key, value);
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  },
  async delete(key) {
    if (isElectron) return await window.qualidoc.store.delete(key);
    localStorage.removeItem(key);
    return true;
  },
};

export const isInElectron = isElectron;
