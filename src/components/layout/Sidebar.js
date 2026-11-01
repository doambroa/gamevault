import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Gamepad2, Heart, BarChart2, Upload, Download, Settings, FolderOpen, MoreHorizontal } from 'lucide-react';
import SettingsModal from '../ui/index';
import { Modal, Btn } from '../ui/index';
import WipeModal from '../ui/WipeModal';
import ThemeToggle from '../ui/ThemeToggle';

const NAV = [
  { to:'/dashboard',   icon:LayoutDashboard, label:'Dashboard'      },
  { to:'/plataformas', icon:Monitor,          label:'Plataformas'   },
  { to:'/juegos',      icon:Gamepad2,         label:'Juegos'        },
  { to:'/deseos',      icon:Heart,            label:'Lista de Deseos'},
  { to:'/stats',       icon:BarChart2,        label:'Estadísticas'  },
];

export default function Sidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showWipe, setShowWipe]         = useState(false);
  const [moreOpen, setMoreOpen]         = useState(false);   // menú "Más" en móvil
  const [importState, setImportState]   = useState(null); // {filePath} | null
  const [importing,   setImporting]     = useState(false);
  const [importErr,   setImportErr]     = useState('');

  const doExport = async () => {
    const r = await window.api?.io.export();
    if (r?.ok && r.filePath) alert('Exportado: ' + r.filePath);
    else if (r?.error) alert(r.error);
  };

  const doImport = async () => {
    const r = await window.api?.io.import();
    if (!r || r.cancelled) return;
    if (r.needsConfirm) { setImportState(r); setImportErr(''); }
  };

  const confirmImport = async () => {
    if (!importState) return;
    setImporting(true); setImportErr('');
    const r = await window.api?.io.importConfirm(importState.filePath);
    setImporting(false);
    if (r?.ok) {
      setImportState(null);
      window.location.reload();
    } else {
      setImportErr(r?.error || 'Error al importar');
    }
  };

  return (
    <>
      <aside className="sidebar">
        <nav className="nav">
          {NAV.map(({ to, icon: Icon, label }) => (
            <button key={to}
              className={'nav-item' + (loc.pathname.startsWith(to) ? ' active' : '')}
              onClick={() => { nav(to); setMoreOpen(false); }}>
              <Icon size={18}/><span>{label}</span>
            </button>
          ))}
          <button className={'nav-item nav-more' + (moreOpen ? ' active' : '')} onClick={() => setMoreOpen(o => !o)}>
            <MoreHorizontal size={18}/><span>Más</span>
          </button>
        </nav>
        {moreOpen && <div className="sidebar-scrim" onClick={() => setMoreOpen(false)}/>}
        <div className={'sidebar-footer' + (moreOpen ? ' open' : '')} onClick={() => setMoreOpen(false)}>
          <button className="sidebar-action" onClick={doExport}>
            <Upload size={14}/> Exportar JSON
          </button>
          <button className="sidebar-action" onClick={doImport}>
            <Download size={14}/> Importar JSON
          </button>
          {window.api?.platform === 'electron' && (
            <button className="sidebar-action" onClick={() => window.api?.io.openFolder()}>
              <FolderOpen size={14}/> Abrir carpeta datos
            </button>
          )}
          <button className="sidebar-action" onClick={() => setShowSettings(true)}>
            <Settings size={14}/> Ajustes
          </button>
          <ThemeToggle/>
        </div>
      </aside>

      {/* Import confirm modal */}
      <Modal open={!!importState} onClose={() => setImportState(null)}
        title="Importar colección" width={480}>
        <div style={{lineHeight:1.7,color:'var(--text-1)',fontSize:14,marginBottom:20}}>
          <p style={{marginBottom:12}}>
            Vas a importar el fichero:<br/>
            <code style={{fontSize:11,color:'var(--cyan)',wordBreak:'break-all'}}>
              {importState?.filePath}
            </code>
          </p>
          <div style={{background:'rgba(230,57,70,.08)',border:'1px solid rgba(230,57,70,.25)',
            borderRadius:'var(--r)',padding:'12px 14px',fontSize:13}}>
            <strong style={{color:'var(--accent)'}}>Atención:</strong> esto sobrescribirá la
            colección que tienes ahora mismo. Si tienes datos que no quieres perder,
            cancela y exporta primero tu colección actual.
          </div>
          {importErr && (
            <p style={{color:'var(--accent)',marginTop:10,fontSize:13}}>{importErr}</p>
          )}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={() => setImportState(null)}>Cancelar</Btn>
          <Btn variant="danger" onClick={confirmImport} disabled={importing}>
            {importing ? 'Importando…' : 'Sí, importar y sobrescribir'}
          </Btn>
        </div>
      </Modal>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onWipe={() => setShowWipe(true)}/>
      <WipeModal open={showWipe} onClose={() => setShowWipe(false)}/>
    </>
  );
}
