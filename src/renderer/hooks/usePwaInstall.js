/**
 * Hook React de gestion de l'installation PWA.
 *
 * Côté navigateur Chromium-based (Chrome/Edge/Brave), le browser émet un
 * événement `beforeinstallprompt` lorsque le site remplit les critères PWA
 * et que l'utilisateur n'a pas déjà installé l'app. On capture cet
 * événement, on empêche son auto-prompt, et on l'expose à un bouton custom
 * pour pouvoir le déclencher manuellement.
 *
 * Cas particuliers gérés :
 *  - mode Electron desktop → l'install PWA n'a aucun sens, le hook renvoie
 *    `isElectron: true` pour que le bouton se masque.
 *  - app déjà installée (mode standalone) → `isStandalone: true`, idem.
 *  - Safari iOS → pas de `beforeinstallprompt`, on signale `isIos: true`
 *    pour proposer des instructions manuelles.
 *  - Chrome qui refuse d'émettre le prompt (cooldown 90j après une
 *    désinstallation par ex.) → `canPrompt: false`, le bouton affiche
 *    alors des instructions manuelles dans une modale.
 */

import { useEffect, useState, useCallback } from 'react';

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  // iOS Safari expose navigator.standalone quand l'app est lancée depuis
  // l'écran d'accueil.
  if (window.navigator?.standalone) return true;
  return false;
}

function detectIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

function detectElectron() {
  return typeof window !== 'undefined' && !!window.qualidoc?.ai;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  const [installed, setInstalled] = useState(false);

  const isElectron = detectElectron();
  const isIos = detectIos();

  useEffect(() => {
    if (isElectron) return undefined;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setIsStandalone(detectStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    mql?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      mql?.removeEventListener?.('change', onDisplayChange);
    };
  }, [isElectron]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { ok: false, code: 'NO_PROMPT' };
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return { ok: true, outcome: choice?.outcome || 'unknown' };
    } catch (err) {
      return { ok: false, code: 'ERROR', error: err?.message || String(err) };
    }
  }, [deferredPrompt]);

  return {
    isElectron,
    isStandalone,
    isIos,
    installed,
    canPrompt: !!deferredPrompt,
    promptInstall,
  };
}
