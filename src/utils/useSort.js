import { useState, useMemo } from 'react';

const isEmpty = v => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
// Las duraciones a 0 equivalen a "sin dato"
const HLTB_KEYS = ['hltbMain', 'hltbExtra', 'hltbComplete'];

export function useSort(data, defaultKey='nombre', defaultDir='asc') {
  const [key, setKey] = useState(defaultKey);
  const [dir, setDir] = useState(defaultDir);

  const toggle = k => {
    if (key === k) setDir(d => d==='asc'?'desc':'asc');
    else { setKey(k); setDir('asc'); }
  };
  const setSort = (k, d) => { setKey(k); setDir(d); };

  const sorted = useMemo(() => {
    if (!data?.length) return data||[];
    const empty = v => isEmpty(v) || (HLTB_KEYS.includes(key) && !(Number(v) > 0));
    return [...data].sort((a,b) => {
      const va=a[key], vb=b[key];
      // Sin dato → siempre al final, ordenes como ordenes
      const ea = empty(va), eb = empty(vb);
      if (ea || eb) return ea === eb ? String(a.nombre||'').localeCompare(String(b.nombre||''),'es') : (ea ? 1 : -1);
      const na=parseFloat(va), nb=parseFloat(vb);
      const isNum = !isNaN(na) && !isNaN(nb) && /^-?[\d.]+$/.test(String(va)) && /^-?[\d.]+$/.test(String(vb));
      const cmp = isNum ? na-nb : String(va).localeCompare(String(vb),'es',{numeric:true});
      return dir==='asc' ? cmp : -cmp;
    });
  }, [data, key, dir]);

  return { sorted, sortKey:key, sortDir:dir, toggle, setSort };
}

// Cabecera de tabla ordenable — clic para ordenar
export function SortTh({ label, field, sortKey, sortDir, onToggle }) {
  const active = sortKey===field;
  return (
    <th onClick={()=>onToggle(field)}
      style={{cursor:'pointer',userSelect:'none',
        color: active?'var(--accent)':undefined,
        whiteSpace:'nowrap'}}>
      {label}{active?(sortDir==='asc'?' ↑':' ↓'):''}
    </th>
  );
}
