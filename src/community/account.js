/* Cuenta, sincronización y comunidad
 * ────────────────────────────────────────────────────────────────────────────
 * La colección sigue viviendo en el dispositivo (sql.js). Con una cuenta, además:
 *   · se sube entera al servidor cada vez que cambia (y se baja al entrar en otro dispositivo),
 *   · los demás pueden verla (solo lectura) y aparece en la Zona de préstamos.
 *
 * Web / iPhone: el servidor es el propio sitio (api.php al lado) y la sesión va por cookie,
 *               la misma que usa Créditos Finales → quien entra en una está dentro de la otra.
 * Windows / Android: se guarda un token y se manda en la cabecera X-GV-Token.
 */
import { useSyncExternalStore } from 'react';

let KEYS = {};
try { KEYS = require('../core/keys'); } catch {}

const api = window.api;
const PLATFORM = api?.platform || 'web';
export const IS_APP = PLATFORM === 'electron' || PLATFORM === 'android';
const LS_ACC = 'gv-account', LS_SYNC = 'gv-sync', LS_IMG = 'gv-img-subidas', LS_GUEST = 'gv-sin-cuenta';
const DEVICE = PLATFORM === 'electron' ? 'Windows' : PLATFORM === 'android' ? 'Android' : PLATFORM === 'ios' ? 'iPhone' : 'Web';

const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function normServer(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/[#?].*$/, '').replace(/(index\.html|api\.php)$/i, '');
  return s.endsWith('/') ? s : s + '/';
}
export const DEFAULT_SERVER = normServer(KEYS.GV_SERVER || '');
function webServer() {
  if (IS_APP || !/^https?:$/.test(window.location.protocol)) return '';
  return new URL('.', window.location.href.split('#')[0]).href;
}

// ── Estado observable ─────────────────────────────────────────────────────────
let state = {
  ready: false,            // ya se ha comprobado si hay sesión
  available: false,        // hay servidor de cuentas al otro lado
  server: IS_APP ? (lsGet(LS_ACC, {}).server || DEFAULT_SERVER) : webServer(),
  me: null,                // {user, display, avatar, bio, privacy, creditos}
  guest: lsGet(LS_GUEST, false),
  needsInvite: false,
  sync: { status: 'idle', msg: '', at: null },   // idle | syncing | ok | error | offline | conflict | remote
  conflict: null,          // {server:{rev,updatedAt,device,counts}, local:{counts}}
};
const subs = new Set();
const set = patch => { state = { ...state, ...patch }; subs.forEach(fn => fn()); };
const setSyncSt = (status, msg = '') => set({ sync: { status, msg, at: status === 'ok' ? Date.now() : state.sync.at } });
export const getAccount = () => state;
export function useAccount() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => state);
}

// ── Llamadas al servidor ──────────────────────────────────────────────────────
const token = () => (IS_APP ? lsGet(LS_ACC, {}).token || '' : '');
export const absUrl = p => (!p ? null : /^https?:\/\//i.test(p) ? p : state.server + p);
export const creditosUrl = () => (state.server ? new URL('../creditos/', state.server).href : null);

async function call(action, { method = 'GET', body, params = {}, raw, server = state.server } = {}) {
  if (!server) throw new Error('No hay servidor configurado');
  const q = new URLSearchParams({ action, ...params });
  const headers = { 'X-GV': '1' };
  const t = token();
  if (t) headers['X-GV-Token'] = t;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(server + 'api.php?' + q, {
      method, headers, cache: 'no-store', credentials: IS_APP ? 'omit' : 'same-origin',
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) { const err = new Error('No se pudo conectar con el servidor'); err.network = true; throw err; }
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || !j) {
    const err = new Error((j && j.error) || `El servidor respondió ${r.status}`);
    err.status = r.status; err.data = j;
    if (!j && r.status !== 401) err.network = true;      // no es nuestra API (404, HTML…)
    throw err;
  }
  return j;
}

// ── Arranque ──────────────────────────────────────────────────────────────────
let initPromise = null;
export function initAccount() {
  if (!initPromise) initPromise = (async () => {
    if (!api || !state.server) { set({ ready: true, available: false }); return state; }
    if (IS_APP && !token()) {            // app sin sesión: no hace falta preguntar nada al servidor
      set({ ready: true, available: true });
      return state;
    }
    try {
      const me = await call('me');
      set({ ready: true, available: true, me: me.user ? me : null, needsInvite: !!me.needsInvite });
      if (IS_APP && !me.user) lsSet(LS_ACC, { server: state.server });   // token caducado
      if (me.user) await syncAtStart(me);
    } catch (e) {
      // Sin red: en las apps se sigue con la sesión guardada; en la web sin api.php no hay cuentas
      const saved = lsGet(LS_ACC, {});
      if (IS_APP && saved.me) { set({ ready: true, available: true, me: saved.me }); setSyncSt('offline', 'Sin conexión'); }
      else set({ ready: true, available: IS_APP });
    }
    return state;
  })();
  return initPromise;
}

function afterAuth(me, server) {
  if (IS_APP) lsSet(LS_ACC, { server, token: me.token || token(), me: strip(me) });
  lsSet(LS_GUEST, false);
  set({ me: strip(me), server, available: true, guest: false });
}
const strip = ({ token: _t, ...me }) => me;

export async function login({ user, pass, server }) {
  server = IS_APP ? normServer(server || state.server) : state.server;
  const me = await call('login', { method: 'POST', server, body: { user, pass, token: IS_APP, device: DEVICE } });
  afterAuth(me, server);
  await syncAtStart(me, { interactive: true });
  return me;
}
export async function register({ user, pass, invite, server }) {
  server = IS_APP ? normServer(server || state.server) : state.server;
  const me = await call('register', { method: 'POST', server, body: { user, pass, invite, token: IS_APP, device: DEVICE } });
  afterAuth(me, server);
  await syncAtStart(me, { interactive: true });
  return me;
}
export async function logout() {
  try { await call('logout', { method: 'POST', body: {} }); } catch {}
  if (IS_APP) lsSet(LS_ACC, { server: state.server });
  set({ me: null, conflict: null });
  setSyncSt('idle');
}
export function continueAsGuest() { lsSet(LS_GUEST, true); set({ guest: true }); }
export async function checkServer(server) {
  const j = await call('ping', { server: normServer(server) });
  if (!j.gamevault) throw new Error('Ahí no hay un servidor de GameVault');
  return j;
}
export async function saveProfile(patch) {
  const me = await call('profile', { method: 'POST', body: patch });
  if (IS_APP) lsSet(LS_ACC, { ...lsGet(LS_ACC, {}), me });
  set({ me });
  return me;
}
export const changePassword = (oldP, newP) => call('password', { method: 'POST', body: { old: oldP, new: newP } });
export const fetchUsers = () => call('users');
export const fetchView = u => call('view', { params: { u } });
export const fetchLoans = () => call('loans');
export const fetchCreditos = u => call('creditos', { params: u ? { u } : {} });

// ── Fotos: las que solo existen en este dispositivo se suben al servidor ──────
const shareable = s => typeof s === 'string' && (/^https?:\/\//i.test(s) || s.startsWith('./consolas/'));
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i += 1 + (s.length > 4000 ? 7 : 0)) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length; }

function shrink(blob, max = 1400) {
  if (blob.type === 'image/gif') return Promise.resolve(blob);
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.width, img.height));
      if (k === 1 && blob.size < 900 * 1024) return resolve(blob);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      const png = blob.type === 'image/png';
      if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b || blob), png ? 'image/png' : 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
export async function uploadImage(blob, { max = 1400 } = {}) {
  const small = await shrink(blob, max);
  if (!small) throw new Error('No se pudo leer la imagen');
  return call('upload', { method: 'POST', raw: small });
}
async function localImageBlob(src) {
  if (src.startsWith('data:') || src.startsWith('blob:')) { try { return await (await fetch(src)).blob(); } catch { return null; } }
  if (PLATFORM === 'electron' && api.images?.read) {
    const p = src.startsWith('localimg://') ? decodeURIComponent(escape(atob(new URL(src).searchParams.get('p') || ''))) : src;
    const r = await api.images.read(p);
    if (!r) return null;
    const bin = atob(r.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: r.mime });
  }
  return null;
}
// Devuelve una copia de la colección con todas las fotos accesibles desde internet
async function withSharedImages(data) {
  const map = lsGet(LS_IMG, {});
  let changed = false;
  const out = { ...data };
  for (const t of ['plataformas', 'juegos', 'deseos', 'accesorios']) {
    out[t] = [];
    for (const row of data[t] || []) {
      let imgs = [];
      try { imgs = Array.isArray(row.imagenes) ? row.imagenes : JSON.parse(row.imagenes || '[]') || []; } catch {}
      if (imgs.every(shareable)) { out[t].push(row); continue; }
      const res = [];
      for (const src of imgs) {
        if (shareable(src)) { res.push(src); continue; }
        if (typeof src !== 'string') continue;
        const key = src.startsWith('data:') ? 'd:' + hashStr(src) : 'p:' + src;
        if (!map[key]) {
          const blob = await localImageBlob(src);
          if (!blob) continue;                             // la foto ya no existe en este dispositivo
          map[key] = (await uploadImage(blob)).url;        // si falla la red, se aborta la subida entera
          changed = true;
        }
        res.push(map[key]);
      }
      out[t].push({ ...row, imagenes: JSON.stringify(res) });
    }
  }
  if (changed) lsSet(LS_IMG, map);
  return out;
}

// ── Sincronización ────────────────────────────────────────────────────────────
const getSync = () => lsGet(LS_SYNC, {});
const setSync = s => lsSet(LS_SYNC, s);
let dirtySeq = 0, pushTimer = null, firstDirtyAt = 0, busy = false;

export function markDirty() {
  if (!state.me) return;
  const s = getSync();
  if (s.user !== state.me.user) return;                   // aún no se ha hecho la primera sincronización
  dirtySeq++;
  if (!s.dirty) setSync({ ...s, dirty: true });
  const now = Date.now();
  if (!firstDirtyAt) firstDirtyAt = now;
  clearTimeout(pushTimer);
  // esperar a que la persona termine (4 s de calma), pero sin pasar de 45 s con cambios sin subir
  pushTimer = setTimeout(() => { push().catch(() => {}); }, now - firstDirtyAt > 45000 ? 300 : 4000);
}
if (api?.onDirty) api.onDirty(markDirty);

async function localCounts() {
  try { const c = await api.io.counts(); return c; } catch { return { plataformas: 0, juegos: 0, deseos: 0, accesorios: 0 }; }
}
const isEmpty = c => !(c.plataformas || c.juegos || c.deseos || c.accesorios);

async function push({ force = false } = {}) {
  if (!state.me || busy) { if (busy) setTimeout(() => markDirtyRetry(), 1500); return; }
  busy = true; clearTimeout(pushTimer);
  const seq = dirtySeq, user = state.me.user;
  setSyncSt('syncing', 'Guardando en tu cuenta…');
  try {
    const data = await withSharedImages(await api.sync.export());
    const s = getSync();
    const r = await call('save', { method: 'POST', body: { baseRev: s.user === user ? s.rev || 0 : 0, data, device: DEVICE, force } });
    firstDirtyAt = 0;
    setSync({ user, rev: r.rev, dirty: dirtySeq !== seq });
    set({ conflict: null });
    setSyncSt('ok', 'Todo guardado en tu cuenta');
    if (dirtySeq !== seq) markDirty();
  } catch (e) {
    if (e.status === 409) {
      set({ conflict: { server: e.data, local: { counts: await localCounts() } } });
      setSyncSt('conflict', 'Tu colección ha cambiado en otro dispositivo');
    } else if (e.status === 401) { set({ me: null }); setSyncSt('error', 'La sesión ha caducado: vuelve a entrar'); }
    else setSyncSt(e.network ? 'offline' : 'error', e.network ? 'Sin conexión: se guardará al volver' : e.message);
    throw e;
  } finally { busy = false; }
}
function markDirtyRetry() { if (getSync().dirty) { clearTimeout(pushTimer); pushTimer = setTimeout(() => { push().catch(() => {}); }, 2000); } }

async function pull({ reload = true } = {}) {
  if (!state.me) return;
  busy = true;
  setSyncSt('syncing', 'Descargando tu colección…');
  try {
    const c = await call('collection');
    if (c.data) {
      // primero marcar el asistente como hecho: sync.import guarda en disco al terminar (antes de recargar)
      if ((c.data.plataformas || []).length) { try { await api.app.completeOnboarding(); } catch {} }
      await api.sync.import(c.data);
    }
    setSync({ user: state.me.user, rev: c.rev, dirty: false });
    set({ conflict: null });
    setSyncSt('ok', 'Colección al día');
    if (reload) window.location.reload();
  } catch (e) {
    setSyncSt(e.network ? 'offline' : 'error', e.message);
    throw e;
  } finally { busy = false; }
}

// Al arrancar o al entrar: decidir quién manda sin pisar nada
async function syncAtStart(me, { interactive = false } = {}) {
  try {
    const s = getSync();
    const counts = await localCounts();
    const first = s.user !== me.user;
    const serverRev = me.rev || 0;
    if (first) {
      if (!serverRev) { setSync({ user: me.user, rev: 0, dirty: false }); if (!isEmpty(counts)) await push({ force: true }); else setSyncSt('ok', 'Cuenta lista'); }
      else if (isEmpty(counts)) await pull({ reload: interactive });
      else { set({ conflict: { first: true, server: { rev: serverRev, updatedAt: me.updatedAt }, local: { counts } } }); setSyncSt('conflict', 'Elige qué colección conservar'); }
    } else if (serverRev === (s.rev || 0)) {
      if (s.dirty) await push(); else setSyncSt('ok', 'Colección al día');
    } else if (s.dirty) {
      set({ conflict: { server: { rev: serverRev, updatedAt: me.updatedAt }, local: { counts } } });
      setSyncSt('conflict', 'Tu colección ha cambiado en otro dispositivo');
    } else await pull({ reload: interactive });
  } catch (e) { /* el estado ya dice qué ha pasado */ }
}

export async function resolveConflict(keep) {            // 'server' | 'local'
  if (keep === 'server') return pull({ reload: true });
  const user = state.me.user;
  setSync({ user, rev: 0, dirty: true });
  return push({ force: true });
}
export async function syncNow() {
  if (!state.me) return;
  try {
    const me = await call('me');
    if (!me.user) { set({ me: null }); return; }
    set({ me: strip(me) });
    await syncAtStart(me, { interactive: true });
  } catch (e) { setSyncSt(e.network ? 'offline' : 'error', e.message); }
}
// Al volver a la app: si otro dispositivo ha guardado y aquí no hay nada pendiente, avisar (sin recargar por sorpresa)
let lastCheck = 0;
async function checkRemote() {
  if (!state.me || busy || Date.now() - lastCheck < 60000 || state.conflict) return;
  lastCheck = Date.now();
  try {
    const me = await call('me');
    const s = getSync();
    if (!me.user || s.user !== me.user) return;
    if ((me.rev || 0) !== (s.rev || 0)) {
      if (s.dirty) { set({ conflict: { server: { rev: me.rev, updatedAt: me.updatedAt }, local: { counts: await localCounts() } } }); setSyncSt('conflict', 'Tu colección ha cambiado en otro dispositivo'); }
      else setSyncSt('remote', 'Hay cambios de otro dispositivo');
    } else if (s.dirty) push().catch(() => {});
  } catch {}
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkRemote(); });
  window.addEventListener('focus', checkRemote);
  window.addEventListener('online', () => { if (getSync().dirty) push().catch(() => {}); });
}
export const applyRemote = () => pull({ reload: true });
// Sube ya los cambios (p. ej. justo después de marcar un préstamo) y espera a que estén arriba
export async function pushNow() {
  if (!state.me) return;
  const s = getSync();
  if (s.user !== state.me.user) return;
  dirtySeq++; setSync({ ...s, dirty: true });
  for (let i = 0; busy && i < 40; i++) await new Promise(r => setTimeout(r, 150));
  await push();
}

// ── Perfiles por reclamar (colecciones cargadas antes de que su dueño tuviera cuenta) ──
export const fetchPending = () => call('pending');
export const claimInfo = (id, code) => call('claiminfo', { params: { id, code } });
export async function claimProfile(id, code = '') {
  try { await pushNow(); } catch {}                 // lo que hubiera sin subir, primero arriba
  const r = await call('claim', { method: 'POST', body: { id, code } });
  await pull({ reload: false });                    // la colección ya sumada
  window.location.hash = '#/juegos';
  window.location.reload();
  return r;
}

// ── Peticiones de préstamo («¿me lo dejas?») ──
let reqState = { recibidas: [], enviadas: [], cargado: false };
const reqSubs = new Set();
const setReq = v => { reqState = { ...v, cargado: true }; reqSubs.forEach(f => f()); };
export async function refreshRequests() {
  if (!state.me) return reqState;
  try { setReq(await call('requests')); } catch {}
  return reqState;
}
export function useRequests() {
  return useSyncExternalStore(fn => { reqSubs.add(fn); return () => reqSubs.delete(fn); }, () => reqState);
}
export async function pedirJuego(owner, id, msg = '') {
  const r = await call('req_create', { method: 'POST', body: { owner, id, msg } });
  refreshRequests(); return r;
}
export async function cancelarPeticion(id) { await call('req_cancel', { method: 'POST', body: { id } }); return refreshRequests(); }
/** El dueño contesta. Si acepta, el juego queda prestado a quien lo pidió (en su colección y en la cuenta). */
export async function contestarPeticion(r, accept) {
  if (accept) {
    const hoy = new Date().toISOString().slice(0, 10);
    await api.juegos.prestar({ id: r.juegoId, prestadoA: r.quien?.display || r.from, prestadoUsuario: r.from, fechaPrestamo: hoy });
    try { await pushNow(); } catch {}
  }
  await call('req_answer', { method: 'POST', body: { id: r.id, accept } });
  return refreshRequests();
}
// Se miran al entrar, cada 2 minutos y al volver a la ventana
if (typeof window !== 'undefined') {
  setInterval(() => { if (state.me && document.visibilityState === 'visible') refreshRequests(); }, 120000);
  window.addEventListener('focus', () => { if (state.me) refreshRequests(); });
  subs.add(() => { if (state.me && !reqState.cargado) refreshRequests(); });
}
