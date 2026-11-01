import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme } from '../../utils/theme';

export function useTheme() {
  const [t, setT] = useState(getTheme);
  useEffect(() => { const fn = e => setT(e.detail); window.addEventListener('gv-theme', fn); return () => window.removeEventListener('gv-theme', fn); }, []);
  return [t, () => setTheme(t === 'dark' ? 'light' : 'dark')];
}

/* Interruptor sol/luna (barra de título y pie de la barra lateral) */
export default function ThemeToggle({ variant = 'switch' }) {
  const [t, toggle] = useTheme();
  const claro = t === 'light';
  const label = claro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
  if (variant === 'icon') return (
    <button className="tbar-btn theme-icon" onClick={toggle} title={label} aria-label={label}>
      {claro ? <Moon size={14}/> : <Sun size={14}/>}
    </button>
  );
  return (
    <button className="theme-switch" onClick={e => { e.stopPropagation(); toggle(); }} role="switch" aria-checked={claro} aria-label={label} title={label}>
      <span className="theme-switch-track">
        <Moon size={12} className="ts-moon"/><Sun size={12} className="ts-sun"/>
        <span className="theme-switch-thumb"/>
      </span>
      <span className="theme-switch-txt">{claro ? 'Tema claro' : 'Tema oscuro'}</span>
    </button>
  );
}
