import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

/* Grupos plegables (por consola, etc.). Lo plegado se recuerda en este dispositivo.
 * Vale igual para la vista de carátulas y la de tabla: al plegar queda solo la línea del título. */
export function useCollapse(key) {
  const LS = 'gv-plegado-' + key;
  const [set, setSet] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(LS)) || []); } catch { return new Set(); } });
  const save = s => { try { localStorage.setItem(LS, JSON.stringify([...s])); } catch {} return s; };
  const isClosed = useCallback(id => set.has(String(id)), [set]);
  const toggle = useCallback(id => setSet(s => { const n = new Set(s); const k = String(id); n.has(k) ? n.delete(k) : n.add(k); return save(n); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const setAll = useCallback((ids, closed) => setSet(() => save(new Set(closed ? ids.map(String) : []))), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { isClosed, toggle, setAll, count: set.size };
}

/** Título de grupo pulsable con su flecha */
export function GroupHead({ closed, onToggle, children, className = '' }) {
  return (
    <button type="button" className={'grp-head ' + className + (closed ? ' closed' : '')} onClick={onToggle} aria-expanded={!closed}>
      <ChevronDown size={16} className="grp-chev"/>
      {children}
    </button>
  );
}

/** «Plegar todo / Desplegar todo» */
export function CollapseAll({ ids, c }) {
  if (ids.length < 2) return null;
  const todoPlegado = ids.every(id => c.isClosed(id));
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => c.setAll(ids, !todoPlegado)} title={todoPlegado ? 'Desplegar todos los grupos' : 'Dejar solo los títulos'}>
      {todoPlegado ? <><ChevronsUpDown size={14}/> Desplegar todo</> : <><ChevronsDownUp size={14}/> Plegar todo</>}
    </button>
  );
}
