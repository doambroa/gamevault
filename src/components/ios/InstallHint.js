import React, { useState } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

/* iPhone/iPad: Safari no ofrece un aviso automático para instalar la app.
 * Mostramos una guía breve mientras se usa desde Safari (no instalada). Se puede cerrar
 * y no vuelve a salir en 7 días. */
const KEY = 'gv-ios-hint';
const instalada = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

export default function InstallHint() {
  const [show, setShow] = useState(() => {
    if (window.api?.platform !== 'ios' || instalada()) return false;
    try { return Date.now() > Number(localStorage.getItem(KEY) || 0); } catch { return true; }
  });
  if (!show) return null;
  const cerrar = () => { try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)); } catch {} setShow(false); };
  return (
    <div className="ios-hint" role="dialog" aria-label="Instalar GameVault">
      <button className="ios-hint-x" onClick={cerrar} aria-label="Cerrar"><X size={16}/></button>
      <img src="./apple-touch-icon.png" alt="" width="44" height="44"/>
      <div>
        <b>Instala GameVault en tu iPhone</b>
        <p>Pulsa <Share size={14} className="ios-hint-ic"/> <i>Compartir</i> y luego <PlusSquare size={14} className="ios-hint-ic"/> <i>Añadir a pantalla de inicio</i>.
          Así se abre a pantalla completa y tu colección queda guardada en el móvil.</p>
      </div>
    </div>
  );
}
