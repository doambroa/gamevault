// src/components/layout/Titlebar.js
import React, { useEffect, useState } from 'react';
import { Minus, Square, X, Database } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';

export default function Titlebar() {
  const [dbPath, setDbPath] = useState('');
  useEffect(() => { window.api?.io.getDbPath().then(setDbPath).catch(()=>{}); }, []);
  return (
    <div className="titlebar">
      <div className="tbar-logo">
        <img src="./favicon.png" alt="" width="16" height="16" style={{display:"block"}}/>
        <span className="tbar-name">GameVault</span>
      </div>
      {dbPath && (
        <div className="tbar-db" onClick={()=>window.api?.io.openFolder()} title="Abrir carpeta de datos">
          <Database size={11}/><span>{dbPath}</span>
        </div>
      )}
      <div className="tbar-ctrls">
        <ThemeToggle variant="icon"/>
        <span className="tbar-sep"/>
        <button className="tbar-btn"       onClick={()=>window.api?.window.minimize()}><Minus size={12}/></button>
        <button className="tbar-btn"       onClick={()=>window.api?.window.maximize()}><Square size={11}/></button>
        <button className="tbar-btn tbar-close" onClick={()=>window.api?.window.close()}><X size={13}/></button>
      </div>
    </div>
  );
}
