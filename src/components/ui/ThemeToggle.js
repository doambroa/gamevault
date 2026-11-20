import React, { useEffect, useState } from 'react';
import { Sun, Moon, X } from 'lucide-react';
import { getTheme, getPref, setTheme } from '../../utils/theme';

export function useTheme() {
  const [st, setSt] = useState(() => ({ t: getTheme(), pref: getPref() }));
  useEffect(() => { const fn = () => setSt({ t: getTheme(), pref: getPref() }); window.addEventListener('gv-theme', fn); return () => window.removeEventListener('gv-theme', fn); }, []);
  return [st.t, () => setTheme(st.t === 'dark' ? 'light' : 'dark'), st.pref];
}

/* Interruptor sol/luna (barra de título y pie de la barra lateral).
 * Por defecto oscuro; al tocarlo se fija a mano. «Auto» hace que siga al tema del sistema. */
export default function ThemeToggle({ variant = 'switch' }) {
  const [t, toggle, pref] = useTheme();
  const claro = t === 'light';
  const auto = pref === 'system';
  const label = (claro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro') + (auto ? ' (ahora sigue al del sistema)' : '');
  if (variant === 'icon') return (
    <button className="tbar-btn theme-icon" onClick={toggle} title={label} aria-label={label}>
      {claro ? <Moon size={14}/> : <Sun size={14}/>}
    </button>
  );
  return (
    <div className="theme-row">
      <button className="theme-switch" onClick={e => { e.stopPropagation(); toggle(); }} role="switch" aria-checked={claro} aria-label={label} title={label}>
        <span className="theme-switch-track">
          <Moon size={12} className="ts-moon"/><Sun size={12} className="ts-sun"/>
          <span className="theme-switch-thumb"/>
        </span>
        <span className="theme-switch-txt">{claro ? 'Tema claro' : 'Tema oscuro'}{auto && <small> · como el sistema</small>}</span>
      </button>
      {!auto && <button className="theme-auto" onClick={e => { e.stopPropagation(); setTheme('system'); }} title="Usar el tema del sistema (claro u oscuro según Windows / el móvil)">Auto</button>}
    </div>
  );
}

/* Aviso de la primera vez: que quede claro que se puede cambiar a tema claro.
 * En el ordenador sale junto al interruptor del pie de la barra lateral; en el móvil, sobre «Más».
 * Se quita con «Entendido» o al cambiar el tema, y no vuelve a salir en ese aparato. */
const AVISO = 'gv-aviso-tema';
// Sale como mucho en 3 aperturas de la app (por si no se pulsa «Entendido»)
const avisoVisto = () => {
  try {
    if (localStorage.getItem(AVISO) === '1') return true;
    if (!sessionStorage.getItem(AVISO)) {                    // primera vez en esta apertura
      const n = (parseInt(localStorage.getItem(AVISO + '-n') || '0', 10) || 0) + 1;
      localStorage.setItem(AVISO + '-n', String(n));
      sessionStorage.setItem(AVISO, '1');
      if (n > 3) { localStorage.setItem(AVISO, '1'); return true; }
    }
    return false;
  } catch { return true; }
};
const marcarVisto = () => { try { localStorage.setItem(AVISO, '1'); } catch {} };
export function ThemeHint() {
  const [ver, setVer] = useState(() => !avisoVisto());
  useEffect(() => {
    if (!ver) return;
    const fn = () => { marcarVisto(); setVer(false); };
    window.addEventListener('gv-theme', fn);
    return () => window.removeEventListener('gv-theme', fn);
  }, [ver]);
  if (!ver) return null;
  const cerrar = () => { marcarVisto(); setVer(false); };
  return (
    <div className="theme-hint" role="status">
      <span className="theme-hint-ico"><Moon size={15}/><Sun size={15}/></span>
      <span className="theme-hint-txt">
        <b>¿Prefieres la app en claro?</b>
        <span className="theme-hint-desk">Abajo a la izquierda tienes el interruptor de tema: claro u oscuro, o «Auto» para que siga al de tu ordenador.</span>
        <span className="theme-hint-mob">En «Más» tienes el interruptor de tema: claro u oscuro, o «Auto» para que siga al del móvil.</span>
      </span>
      <button className="btn btn-primary btn-sm" onClick={cerrar}>Entendido</button>
      <button className="theme-hint-x" onClick={cerrar} aria-label="Cerrar aviso"><X size={14}/></button>
    </div>
  );
}
