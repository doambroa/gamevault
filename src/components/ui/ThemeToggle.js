import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, getPref, setTheme } from '../../utils/theme';

export function useTheme() {
  const [st, setSt] = useState(() => ({ t: getTheme(), pref: getPref() }));
  useEffect(() => { const fn = () => setSt({ t: getTheme(), pref: getPref() }); window.addEventListener('gv-theme', fn); return () => window.removeEventListener('gv-theme', fn); }, []);
  return [st.t, () => setTheme(st.t === 'dark' ? 'light' : 'dark'), st.pref];
}

/* Interruptor sol/luna (barra de título y pie de la barra lateral).
 * Por defecto sigue al sistema; al tocarlo se fija a mano y aparece «Auto» para volver al del sistema. */
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
      {!auto && <button className="theme-auto" onClick={e => { e.stopPropagation(); setTheme('system'); }} title="Volver a usar el tema del sistema">Auto</button>}
    </div>
  );
}
