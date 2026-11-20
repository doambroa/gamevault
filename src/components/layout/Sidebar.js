import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Gamepad2, Heart, BarChart2, Upload, Download, Settings, FolderOpen, MoreHorizontal, Users, ArrowLeftRight, Trophy, ExternalLink, Layers, Music, Award } from 'lucide-react';
import { AccountButton, AccountModal } from '../../community/ui';
import { useAccount, useRequests, useNotifs, creditosUrl } from '../../community/account';
import { NotifBell } from '../../community/Avisos';
import SettingsModal from '../ui/index';
import { Modal, Btn } from '../ui/index';
import WipeModal from '../ui/WipeModal';
import ThemeToggle, { ThemeHint } from '../ui/ThemeToggle';

// movil:false → en el móvil va dentro de «Más» para que la barra inferior no se llene
const NAV = [
  { to:'/dashboard',   icon:LayoutDashboard, label:'Inicio'          , movil:true  },
  { to:'/plataformas', icon:Monitor,          label:'Consolas'       , movil:true  },
  { to:'/juegos',      icon:Gamepad2,         label:'Juegos'         , movil:true  },
  { to:'/deseos',      icon:Heart,            label:'Lista de deseos', movil:false },
  { to:'/stats',       icon:BarChart2,        label:'Estadísticas'   , movil:false },
  { to:'/pila',        icon:Layers,           label:'La pila'        , movil:false },
];
const NAV_COMUNIDAD = [
  { to:'/prestamos',   icon:ArrowLeftRight,   label:'Préstamos'      , movil:true  },
  { to:'/comunidad',   icon:Users,            label:'Comunidad'      , movil:false },
];
// Retos Switcherino: playlist de la estación y porra de los Game Awards
const NAV_RETOS = [
  { to:'/retos',       icon:Music,            label:'Playlist'       , movil:false, exacto:true },
  { to:'/retos/porra', icon:Award,            label:'Porra'          , movil:false },
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
  const [showAccount, setShowAccount]   = useState(false);
  const acc = useAccount();
  const conComunidad = acc.ready && acc.available;
  const reqs = useRequests();
  const nPet = acc.me ? (reqs.recibidas || []).length : 0;
  const notifs = useNotifs();
  const nAvisos = acc.me ? notifs.sinLeer || 0 : 0;
  const cfUrl = conComunidad && acc.me?.creditos !== false ? creditosUrl() : null;
  const activo = (to, exacto) => exacto ? (loc.pathname === to || loc.pathname.startsWith(to + '/playlist')) : loc.pathname.startsWith(to);
  const sinLeer = t => acc.me ? (notifs.avisos || []).filter(a => !a.leida && a.tipo === t).length : 0;
  const nRetos = sinLeer('reto'), nPorra = sinLeer('porra');
  const navItem = ({ to, icon: Icon, label, movil, exacto }, extra = '') => (
    <button key={to + extra}
      className={(extra ? 'sidebar-action sidebar-mob' : 'nav-item' + (movil ? '' : ' nav-desk')) + (activo(to, exacto) ? ' active' : '')}
      onClick={() => { nav(to); setMoreOpen(false); }}>
      <Icon size={extra ? 14 : 18}/><span>{label}</span>
      {to === '/retos' && nRetos > 0 && <b className="nav-badge" title="Te falta el tema de hoy">{nRetos}</b>}
      {to === '/retos/porra' && nPorra > 0 && <b className="nav-badge" title="Tienes la porra a medias">{nPorra}</b>}
      {to === '/prestamos' && nPet > 0 && <b className="nav-badge" title={`${nPet} petición${nPet !== 1 ? 'es' : ''} de préstamo`}>{nPet}</b>}
    </button>
  );

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
        <div className="sidebar-account"><AccountButton onOpen={() => setShowAccount(true)}/><NotifBell/></div>
        <nav className="nav">
          {NAV.map(i => navItem(i))}
          {conComunidad && <div className="nav-sep">Comunidad</div>}
          {conComunidad && NAV_COMUNIDAD.map(i => navItem(i))}
          {conComunidad && <div className="nav-sep">Retos Switcherino</div>}
          {conComunidad && NAV_RETOS.map(i => navItem(i))}
          {cfUrl && <a className="nav-item nav-desk nav-ext" href={cfUrl} target="_blank" rel="noreferrer" title="Abrir Créditos Finales (los juegos que te pasas cada año)">
            <Trophy size={18}/><span>Créditos Finales</span><ExternalLink size={12} className="nav-ext-i"/></a>}
          <button className={'nav-item nav-more' + (moreOpen ? ' active' : '')} onClick={() => setMoreOpen(o => !o)}>
            <MoreHorizontal size={18}/><span>Más</span>
            {nAvisos > 0 && <b className="nav-badge">{nAvisos}</b>}
          </button>
        </nav>
        {moreOpen && <div className="sidebar-scrim" onClick={() => setMoreOpen(false)}/>}
        <div className={'sidebar-footer' + (moreOpen ? ' open' : '')} onClick={() => setMoreOpen(false)}>
          {conComunidad && <NotifBell variant="menu" onNavigate={() => setMoreOpen(false)}/>}
          {conComunidad && <button className="sidebar-action sidebar-mob" onClick={() => setShowAccount(true)}><Users size={14}/> {acc.me ? 'Mi cuenta' : 'Iniciar sesión'}</button>}
          {[...NAV, ...(conComunidad ? [...NAV_COMUNIDAD, ...NAV_RETOS] : [])].filter(i => !i.movil).map(i => navItem(i, 'mob'))}
          {cfUrl && <a className="sidebar-action sidebar-mob" href={cfUrl} target="_blank" rel="noreferrer"><Trophy size={14}/> Créditos Finales <ExternalLink size={11}/></a>}
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
      <ThemeHint/>

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
      <AccountModal open={showAccount} onClose={() => setShowAccount(false)}/>
    </>
  );
}
