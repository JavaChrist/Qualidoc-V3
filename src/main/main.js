import { app, BrowserWindow, Menu, MenuItem, ipcMain, dialog, shell, clipboard, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import Store from 'electron-store';

import { isApiKeyConfigured, MISTRAL_MODELS } from './ai/config.js';
import { chatVision, chatExtractFromHtml, chatReformulate, testConnection, MistralError } from './ai/mistralClient.js';
import { fetchProductPageHtml, searchProductUrl } from './ai/scraper.js';
import { buildVisionPrompt, buildScraperExtractionPrompt, buildReformulationPrompt } from './ai/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Données utilisateur :
//  • en dev    →  %APPDATA%\qualidoc-v3\qualidoc-data.json   (nom du package.json)
//  • en build  →  %APPDATA%\Qualidoc V3\qualidoc-data.json   (productName d'electron-builder)
const store = new Store({
  name: 'qualidoc-data',
  defaults: {
    documents: [],
    settings: {
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
        { id: 'u1', firstName: 'CH.', lastName: 'GROHENS', role: 'Rédacteur', entity: 'UNITEP' },
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
    },
    snapshots: {},
  },
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#F4F6F8',
    title: 'Qualidoc V3 — UNITEP',
    icon: path.join(__dirname, '../../icone/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Vérification orthographique native (Chromium) :
      // - dictionnaire FR forcé en premier, puis FR-FR/FR-CA en repli ;
      // - les suggestions sont exposées via le menu contextuel custom plus bas.
      spellcheck: true,
    },
    autoHideMenuBar: true,
  });

  // Force la langue du spellchecker côté Chromium. Sans cet appel, Electron
  // se base sur la locale du système, ce qui peut donner de l'anglais sur
  // certains postes EDF configurés en en-US.
  try {
    mainWindow.webContents.session.setSpellCheckerLanguages(['fr', 'fr-FR']);
  } catch {
    // Certaines versions/locales d'Electron rejettent 'fr-FR' :
    // on retombe sur le code court 'fr' qui est toujours supporté.
    try { mainWindow.webContents.session.setSpellCheckerLanguages(['fr']); } catch {}
  }

  // Menu contextuel personnalisé : Electron ne fournit aucun menu par défaut
  // pour le spellchecker, il faut le construire à la main à partir de
  // params.misspelledWord et params.dictionarySuggestions.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    const wc = mainWindow.webContents;

    // 1) Suggestions de correction orthographique
    if (params.misspelledWord && params.dictionarySuggestions?.length) {
      params.dictionarySuggestions.forEach((suggestion) => {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => wc.replaceMisspelling(suggestion),
        }));
      });
      menu.append(new MenuItem({
        label: 'Ajouter au dictionnaire',
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    } else if (params.misspelledWord) {
      menu.append(new MenuItem({
        label: 'Aucune suggestion',
        enabled: false,
      }));
      menu.append(new MenuItem({
        label: 'Ajouter au dictionnaire',
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // 2) Actions d'édition standard (visibles uniquement dans une zone éditable)
    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Couper', role: 'cut', enabled: !!params.selectionText }));
      menu.append(new MenuItem({ label: 'Copier', role: 'copy', enabled: !!params.selectionText }));
      menu.append(new MenuItem({ label: 'Coller', role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Tout sélectionner', role: 'selectAll' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copier', role: 'copy' }));
    }

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow });
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialise les logos par défaut UNE SEULE FOIS au tout premier démarrage.
// Logos par défaut : icone/LogoEDF-1.png (principal) et icone/logoUnitep.png (secondaire).
// Après initialisation (flag settings.logosInitialized = true), l'utilisateur peut
// supprimer ou remplacer librement les logos via Paramètres → Société : ils ne seront
// jamais restaurés automatiquement au prochain démarrage.
async function preloadLogos() {
  const settings = store.get('settings') || {};
  const company = settings.company || {};

  if (settings.logosInitialized) return;

  const iconeDir = path.join(__dirname, '../../icone');
  const tryLoad = async (file) => {
    try {
      const buf = await fs.readFile(path.join(iconeDir, file));
      const ext = path.extname(file).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
      return `data:image/${mime};base64,${buf.toString('base64')}`;
    } catch { return null; }
  };

  // Migration douce : ne remplit que les emplacements vides, pour ne pas écraser
  // un logo custom déjà uploadé dans une version antérieure de l'app.
  if (!company.logo) {
    const edf = await tryLoad('LogoEDF-1.png');
    if (edf) company.logo = edf;
  }
  if (!company.logoSecondary) {
    const uni = await tryLoad('logoUnitep.png');
    if (uni) company.logoSecondary = uni;
  }

  store.set('settings', { ...settings, company, logosInitialized: true });
}

app.whenReady().then(async () => {
  await preloadLogos();
  // Force la création physique du fichier qualidoc-data.json au tout
  // premier démarrage (electron-store n'écrit qu'au premier set()).
  if (!store.get('__initializedAt')) {
    store.set('__initializedAt', new Date().toISOString());
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('store:get', (_e, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_e, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store:delete', (_e, key) => {
  store.delete(key);
  return true;
});

ipcMain.handle('dialog:openImage', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${buffer.toString('base64')}`;
});

ipcMain.handle('dialog:saveFile', async (_e, { defaultPath, filters }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters,
  });
  if (res.canceled) return null;
  return res.filePath;
});

ipcMain.handle('dialog:openFile', async (_e, { filters } = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'Tous fichiers', extensions: ['*'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { filePath, content };
  } catch (err) {
    return { filePath, error: err.message };
  }
});

ipcMain.handle('file:saveText', async (_e, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clipboard:readImage', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  return img.toDataURL();
});

ipcMain.handle('file:saveBuffer', async (_e, { filePath, buffer }) => {
  try {
    await fs.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('shell:openPath', async (_e, p) => {
  return shell.openPath(p);
});

ipcMain.handle('shell:showItemInFolder', (_e, p) => {
  shell.showItemInFolder(p);
});

ipcMain.handle('export:pdf', async (_e, { html, filePath, options = {} }) => {
  try {
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: options.marginTop || '28mm',
        bottom: options.marginBottom || '22mm',
        left: options.marginLeft || '20mm',
        right: options.marginRight || '20mm',
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });
    await browser.close();
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Optimisation d'image : redimensionne et compresse, mais préserve le format
// quand l'image a de la transparence (canal alpha).
//
// Avant : tout était converti en JPEG, ce qui faisait perdre la transparence
// des PNG (fond transparent → fond NOIR sur le JPEG résultat — gênant
// notamment pour les schémas constructeur collés via Ctrl+V).
//
// Désormais :
//   - PNG/WEBP avec alpha → on garde PNG (compression PNG, palette si possible)
//   - PNG/WEBP sans alpha → JPEG (gain de poids ~5-10x sur les captures)
//   - JPEG → JPEG (aplati sur fond blanc par sécurité, pour les rares cas
//     d'EXIF orientation + transparence interprétée)
ipcMain.handle('image:optimize', async (_e, { dataUrl, maxWidth = 1600, quality = 85 }) => {
  try {
    const sharp = (await import('sharp')).default;
    const base64 = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');

    const pipeline = sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true });
    const meta = await sharp(buffer).metadata();
    const hasAlpha = !!meta.hasAlpha;

    if (hasAlpha) {
      // Préservation de la transparence pour les captures d'interfaces, les
      // schémas constructeur, les icônes, etc.
      const out = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
      return `data:image/png;base64,${out.toString('base64')}`;
    }

    const out = await pipeline
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (err) {
    return dataUrl;
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// ─────────────────────────────────────────────────────────────────────────────
//  IA Mistral (vision + scraping constructeur)
//
//  La clé API est figée côté main (cf. src/main/ai/config.js) et n'est jamais
//  exposée au renderer. Les handlers ci-dessous traduisent toute exception en
//  { ok: false, code, error } pour faciliter le rendu d'erreur côté UI.
// ─────────────────────────────────────────────────────────────────────────────

function aiError(err) {
  if (err instanceof MistralError) {
    return { ok: false, code: err.code || 'MISTRAL_ERROR', error: err.message };
  }
  return { ok: false, code: 'UNKNOWN', error: err?.message || String(err) };
}

ipcMain.handle('ai:status', () => ({
  configured: isApiKeyConfigured(),
  models: MISTRAL_MODELS,
}));

ipcMain.handle('ai:testConnection', async () => {
  try {
    return await testConnection();
  } catch (err) {
    return aiError(err);
  }
});

ipcMain.handle('ai:generateStepText', async (_e, { imageDataUrl, context } = {}) => {
  try {
    if (!imageDataUrl) {
      return { ok: false, code: 'NO_IMAGE', error: 'Aucune image fournie.' };
    }
    const systemPrompt = buildVisionPrompt({
      brand: context?.brand,
      model: context?.model,
      sectionTitle: context?.sectionTitle,
      docType: context?.docType,
    });
    const result = await chatVision({
      systemPrompt,
      userText: '',
      imageDataUrl,
    });
    return { ok: true, result };
  } catch (err) {
    return aiError(err);
  }
});

ipcMain.handle('ai:scrapeProduct', async (_e, { url, brand, model } = {}) => {
  try {
    let targetUrl = url;
    if (!targetUrl) {
      targetUrl = await searchProductUrl({ brand, model });
      if (!targetUrl) {
        return {
          ok: false,
          code: 'NO_URL',
          error: 'Aucune page produit trouvée pour cette recherche.',
        };
      }
    }
    const page = await fetchProductPageHtml(targetUrl);
    const systemPrompt = buildScraperExtractionPrompt({
      brand,
      model,
      url: page.url,
    });
    const extracted = await chatExtractFromHtml({
      systemPrompt,
      html: page.html,
    });
    return {
      ok: true,
      source: { url: page.url, title: page.title },
      result: extracted,
    };
  } catch (err) {
    return aiError(err);
  }
});

ipcMain.handle('ai:reformulate', async (_e, { text } = {}) => {
  try {
    if (!text || !text.trim()) {
      return { ok: false, code: 'EMPTY', error: 'Texte vide.' };
    }
    const out = await chatReformulate({
      systemPrompt: buildReformulationPrompt(),
      text,
    });
    return { ok: true, result: out };
  } catch (err) {
    return aiError(err);
  }
});
