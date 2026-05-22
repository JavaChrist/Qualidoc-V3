import { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall.js';
import { useUiStore } from '../../store/useUiStore.js';

/**
 * Bouton "Installer l'application" affiché dans le header en mode web.
 *
 * Caché si l'utilisateur est dans l'app Electron desktop ou si la PWA est
 * déjà installée (mode standalone). Lorsque Chrome n'émet pas
 * `beforeinstallprompt` (cooldown post-désinstallation, navigateur non
 * compatible, etc.), on ouvre une modale d'instructions manuelles plutôt
 * que de masquer le bouton, pour que l'utilisateur sache toujours comment
 * installer.
 */

function detectBrowser() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/OPR\//i.test(ua)) return 'opera';
  if (/Firefox\//i.test(ua)) return 'firefox';
  if (/Chrome\//i.test(ua)) return 'chrome';
  if (/Safari\//i.test(ua)) return 'safari';
  return 'other';
}

export default function InstallButton() {
  const { isElectron, isStandalone, isIos, canPrompt, promptInstall } = usePwaInstall();
  const notify = useUiStore((s) => s.notify);
  const [helpOpen, setHelpOpen] = useState(false);

  if (isElectron || isStandalone) return null;

  const handleClick = async () => {
    if (canPrompt) {
      const res = await promptInstall();
      if (res.ok && res.outcome === 'accepted') {
        notify?.('success', 'Qualidoc V3 a été installé sur votre appareil.');
      } else if (res.ok && res.outcome === 'dismissed') {
        notify?.('info', 'Installation annulée.');
      }
      return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-unitep-navy text-white hover:bg-unitep-navy/90 transition-colors shadow-sm"
        title="Installer Qualidoc V3 sur cet appareil"
      >
        <Download className="w-3.5 h-3.5" />
        Installer l'app
      </button>

      {helpOpen && (
        <InstallHelpModal isIos={isIos} onClose={() => setHelpOpen(false)} />
      )}
    </>
  );
}

function InstallHelpModal({ isIos, onClose }) {
  const browser = detectBrowser();

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-[slideIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-unitep-navy text-white flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-unitep-navy">Installer Qualidoc V3</div>
              <div className="text-xs text-slate-500">Ajouter l'application sur votre bureau</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-slate-700 space-y-3">
          {isIos ? (
            <>
              <p>Sur iPhone / iPad, l'installation se fait depuis Safari :</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  Touchez l'icône <Share className="w-4 h-4 inline mb-1" /> <strong>Partager</strong>
                  {' '}en bas de l'écran.
                </li>
                <li>
                  Choisissez <strong>"Sur l'écran d'accueil"</strong>.
                </li>
                <li>
                  Validez en haut à droite avec <strong>"Ajouter"</strong>.
                </li>
              </ol>
            </>
          ) : browser === 'chrome' || browser === 'edge' || browser === 'opera' ? (
            <>
              <p>
                Votre navigateur peut installer Qualidoc V3 comme une application native, mais le bouton automatique
                ne s'affiche pas actuellement (souvent parce que l'app a déjà été installée puis désinstallée sur ce poste).
                Procédez ainsi :
              </p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  Ouvrez le menu du navigateur (icône <strong>⋮</strong> en haut à droite).
                </li>
                <li>
                  Cliquez sur <strong>« Installer Qualidoc V3 »</strong>
                  {' '}(ou <em>« Applications » → « Installer ce site comme une application »</em> sur Edge).
                </li>
                <li>
                  Confirmez avec <strong>« Installer »</strong> : un raccourci sera créé sur votre bureau et dans le menu Démarrer.
                </li>
              </ol>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <strong>Astuce :</strong> si la commande « Installer » est absente du menu, ouvrez
                <code className="mx-1 px-1.5 py-0.5 bg-white border border-amber-300 rounded text-[11px]">
                  {browser === 'edge' ? 'edge://apps' : 'chrome://apps'}
                </code>
                puis vérifiez qu'une ancienne installation n'y subsiste pas. Sinon, ouvrez les outils de développement
                (F12) → <em>Application → Service Workers → Unregister</em>, puis rechargez la page (Ctrl+Maj+R).
              </div>
            </>
          ) : (
            <>
              <p>
                L'installation directe n'est pas supportée par votre navigateur. Pour bénéficier de Qualidoc V3 comme
                une application sur votre bureau, utilisez <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>
                {' '}puis cliquez à nouveau sur « Installer l'app ».
              </p>
              <p className="text-xs text-slate-500">
                (Firefox n'expose pas encore d'installation PWA sur ordinateur de bureau.)
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
