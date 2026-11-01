// Se importa ANTES que App: los módulos de páginas leen window.api al cargarse.
import { createWebApi } from './webApi';

if (typeof window !== 'undefined' && !window.api) {
  window.api = createWebApi();
}

// Versión web / iPhone servida por https: service worker para abrir sin conexión e instalarse
if (typeof window !== 'undefined' && window.api?.platform !== 'electron' && window.api?.platform !== 'android'
    && 'serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
