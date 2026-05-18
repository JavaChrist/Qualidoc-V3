const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qualidoc', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
  },
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openFile: (opts) => ipcRenderer.invoke('dialog:openFile', opts),
    saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  },
  clipboard: {
    readImage: () => ipcRenderer.invoke('clipboard:readImage'),
  },
  file: {
    saveBuffer: (opts) => ipcRenderer.invoke('file:saveBuffer', opts),
    saveText: (opts) => ipcRenderer.invoke('file:saveText', opts),
  },
  shell: {
    openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
    showItemInFolder: (p) => ipcRenderer.invoke('shell:showItemInFolder', p),
  },
  exporter: {
    pdf: (opts) => ipcRenderer.invoke('export:pdf', opts),
  },
  image: {
    optimize: (opts) => ipcRenderer.invoke('image:optimize', opts),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    isElectron: true,
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    generateStepText: (opts) => ipcRenderer.invoke('ai:generateStepText', opts),
    scrapeProduct: (opts) => ipcRenderer.invoke('ai:scrapeProduct', opts),
    reformulate: (opts) => ipcRenderer.invoke('ai:reformulate', opts),
  },
});
