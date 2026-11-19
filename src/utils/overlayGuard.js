/* Los fondos oscuros de las ventanas (modal-overlay, jp-overlay…) cierran la ventana al pinchar en ellos.
 * Pero si empiezas a seleccionar texto DENTRO de la ventana y sueltas el botón fuera, el navegador
 * manda el «click» al fondo y la ventana se cerraba. Aquí se anula ese click: el fondo solo cierra
 * si el botón se pulsó Y se soltó sobre el propio fondo. Vale para todas las ventanas de la app. */
const FONDOS = '.modal-overlay, .jp-overlay, .sidebar-scrim, .menu-scrim';
let inicio = null;

export function installOverlayGuard(doc = document) {
  doc.addEventListener('pointerdown', e => { inicio = e.target; }, true);
  doc.addEventListener('click', e => {
    const t = e.target;
    const desde = inicio; inicio = null;
    if (!(t instanceof Element) || !t.matches(FONDOS)) return;
    if (desde && desde !== t) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
