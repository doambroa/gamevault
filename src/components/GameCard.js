import React, { useState } from 'react';
import { Gamepad2, BookOpen, Check, Clock, Star } from 'lucide-react';
import { firstImg } from '../utils/imgSrc';
import { fmtHours } from '../utils/hltb';
import { ESTADO_CF } from '../community/creditos';

/* Tarjeta de juego con la carátula bien grande. La usan «Juegos», el detalle de consola
 * y las colecciones de otras personas (ahí sin acciones). */
export default function GameCard({ juego, showPlat = false, credito = null, active = false, onClick, actions = null, metric = null }) {
  const src = firstImg(juego.imagenes);
  const [roto, setRoto] = useState(false);
  const anio = (juego.fechaLanzamiento || '').slice(0, 4);
  const horas = metric && juego[metric] > 0 ? juego[metric] : juego.hltbMain;
  return (
    <div className={'gcard' + (active ? ' active' : '')} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick?.(); }}>
      <div className="gcard-img">
        {src && !roto
          ? <img src={src} alt="" loading="lazy" onError={() => setRoto(true)}/>
          : <div className="gcard-noimg"><Gamepad2 size={34}/><span>{juego.nombre}</span></div>}
        <div className="gcard-tags">
          {credito?.e === 'terminado' && <span className="gcard-tag gcard-tag-done" title={`Terminado${credito.y ? ' en ' + credito.y : ''} (Créditos Finales)`}><Check size={11}/> Terminado</span>}
          {credito && credito.e !== 'terminado' && <span className="gcard-tag" title="Créditos Finales">{ESTADO_CF[credito.e]?.txt}</span>}
          {juego.estado === 'Digital' && <span className="gcard-tag gcard-tag-dig">Digital</span>}
          {juego.unidades > 1 && <span className="gcard-tag">×{juego.unidades}</span>}
        </div>
        {juego.prestadoA && <div className="gcard-loan"><BookOpen size={12}/> Lo tiene {juego.prestadoA}</div>}
        {actions && <div className="gcard-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      <div className="gcard-body">
        <div className="gcard-title" title={juego.nombre}>{juego.nombre}</div>
        <div className="gcard-meta">
          {showPlat && juego.plataformaNombre && <span className="gcard-plat">{juego.plataformaNombre}</span>}
          {anio && <span>{anio}</span>}
          {!showPlat && juego.genero && <span>{juego.genero}</span>}
          {horas > 0 && <span className="gcard-h"><Clock size={10}/> {fmtHours(horas)}</span>}
          {juego.valoracion ? <span className="gcard-nota"><Star size={10}/> {juego.valoracion}</span> : null}
        </div>
      </div>
    </div>
  );
}
