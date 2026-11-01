const { contextBridge, ipcRenderer } = require('electron');

// Mensajes del proceso principal (peticiones a HLTB/VGChartz, etc.) en la consola de DevTools
ipcRenderer.on('gv:log', (_, msg) => console.info('%c[GameVault]', 'color:#22d3ee', msg));

const changeListeners = new Set();
ipcRenderer.on('gv:changed', (_, e) => { for (const fn of changeListeners) { try { fn(e); } catch {} } });

contextBridge.exposeInMainWorld('api', {
  platform: 'electron',
  plataformas: {
    getAll:   ()   => ipcRenderer.invoke('p:all'),
    getById:  (id) => ipcRenderer.invoke('p:one', id),
    create:   (d)  => ipcRenderer.invoke('p:create', d),
    update:   (d)  => ipcRenderer.invoke('p:update', d),
    delete:   (id) => ipcRenderer.invoke('p:delete', id),
  },
  juegos: {
    getAll:          (f)  => ipcRenderer.invoke('j:all', f),
    getById:         (id) => ipcRenderer.invoke('j:one', id),
    getByPlataforma: (id) => ipcRenderer.invoke('j:byPlat', id),
    create:          (d)  => ipcRenderer.invoke('j:create', d),
    update:          (d)  => ipcRenderer.invoke('j:update', d),
    delete:          (id) => ipcRenderer.invoke('j:delete', id),
    needsCovers:     ()   => ipcRenderer.invoke('j:needsCovers'),
    updateCovers:    (d)  => ipcRenderer.invoke('j:updateCovers', d),
    prestados:       ()   => ipcRenderer.invoke('j:prestados'),
    prestar:         (d)  => ipcRenderer.invoke('j:prestar', d),
    devolver:        (id) => ipcRenderer.invoke('j:devolver', id),
    hltbFetch:       (d)  => ipcRenderer.invoke('j:hltbFetch', d),
    ventasFetch:     (d)  => ipcRenderer.invoke('j:ventasFetch', d),
  },
  deseos: {
    getAll:          ()  => ipcRenderer.invoke('d:all'),
    create:          (d) => ipcRenderer.invoke('d:create', d),
    update:          (d) => ipcRenderer.invoke('d:update', d),
    delete:          (id)=> ipcRenderer.invoke('d:delete', id),
    moveToCollection:(d) => ipcRenderer.invoke('d:move', d),
  },
  stats:  { get: () => ipcRenderer.invoke('stats') },
  config: {
    get: (k)    => ipcRenderer.invoke('cfg:get', k),
    set: (k, v) => ipcRenderer.invoke('cfg:set', k, v),
  },
  io: {
    export:        () => ipcRenderer.invoke('io:export'),
    exportPdf:     () => ipcRenderer.invoke('io:exportPdf'),
    import:        () => ipcRenderer.invoke('io:import'),
    importConfirm: (p) => ipcRenderer.invoke('io:importConfirm', p),
    openFolder:    () => ipcRenderer.invoke('io:openFolder'),
    getDbPath:     () => ipcRenderer.invoke('io:dbPath'),
    counts:        () => ipcRenderer.invoke('data:counts'),
    wipe:          (o) => ipcRenderer.invoke('data:wipe', o),
  },
  images: { select: () => ipcRenderer.invoke('img:select') },
  wiki: { fetch: (url) => ipcRenderer.invoke('wiki:fetch', url) },
  window: {
    minimize: () => ipcRenderer.send('win:min'),
    maximize: () => ipcRenderer.send('win:max'),
    close:    () => ipcRenderer.send('win:close'),
  },
  app: {
    isFirstRun:         () => ipcRenderer.invoke('app:isFirstRun'),
    completeOnboarding: () => ipcRenderer.invoke('app:completeOnboarding'),
  },
  // Avisos de cambios hechos en segundo plano (p.ej. llegan datos de HLTB/ventas)
  onChanged: (fn) => { changeListeners.add(fn); return () => changeListeners.delete(fn); },
});
