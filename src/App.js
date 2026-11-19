import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Titlebar         from './components/layout/Titlebar';
import InstallHint from './components/ios/InstallHint';
import { asignarImagenesPorDefecto } from './utils/imagenesPorDefecto';
import Sidebar          from './components/layout/Sidebar';
import Dashboard        from './pages/Dashboard/Dashboard';
import PlataformasPage  from './pages/Plataformas/PlataformasPage';
import PlataformaDetail from './pages/Plataformas/PlataformaDetail';
import JuegosPage       from './pages/Juegos/JuegosPage';
import DeseosPage       from './pages/Deseos/DeseosPage';
import StatsPage        from './pages/Stats/StatsPage';
import OnboardingPage   from './pages/Onboarding/OnboardingPage';
import './pages/Onboarding/Onboarding.css';
import './pages/Stats/Stats.css';
import ComunidadPage, { PerfilPage } from './community/ComunidadPage';
import PrestamosPage    from './community/PrestamosPage';
import ReclamarPage     from './community/ReclamarPage';
import PilaPage         from './pages/Pila/PilaPage';
import { initAccount, useAccount, IS_APP } from './community/account';
import { LoginScreen, ConflictModal, RemoteToast, ClaimBanner, AccountModal } from './community/ui';

const api = window.api;
const isDesktop = api?.platform === 'electron';

export default function App() {
  const [checking, setChecking] = useState(true);
  const [firstRun, setFirstRun] = useState(false);
  const acc = useAccount();
  const [cuentaOb, setCuentaOb] = useState(false);

  useEffect(() => {
    if (api) {
      Promise.all([api.app.isFirstRun(), initAccount().catch(() => null)]).then(([x]) => x)
        .then(async is => {
          if (!is) { try { await asignarImagenesPorDefecto(); } catch (e) { console.warn('Imágenes por defecto:', e); } }
          setFirstRun(is); setChecking(false);
        })
        .catch(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  // Web: la primera vez se ofrece entrar con tu cuenta (o seguir sin ella)
  const gate = !IS_APP && acc.ready && acc.available && !acc.me && !acc.guest && !window.location.hash.startsWith('#/reclamar');
  if (checking || (!IS_APP && !acc.ready)) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'var(--bg-0)', color:'var(--text-2)' }}>
      Cargando…
    </div>
  );

  if (gate) return (
    <div className="shell">
      {isDesktop && <Titlebar/>}
      <LoginScreen/>
    </div>
  );

  // Enlace para reclamar una colección: funciona aunque esta copia aún no tenga nada
  if (firstRun && window.location.hash.startsWith('#/reclamar')) return (
    <HashRouter>
      <div className="shell">
        {isDesktop && <Titlebar/>}
        <main className="main"><Routes><Route path="/reclamar/:id/:code" element={<ReclamarPage/>}/></Routes></main>
      </div>
    </HashRouter>
  );

  if (firstRun) return (
    <div className="shell">
      <ClaimBanner/>
      {isDesktop && <Titlebar/>}
      <InstallHint/>
      {acc.available && !acc.me && (
        <button className="ob-cuenta" onClick={() => setCuentaOb(true)}>¿Ya tienes cuenta? <b>Entra</b> y te traemos tu colección</button>
      )}
      {acc.me && (
        <button className="ob-cuenta" onClick={async () => { try { await api.app.completeOnboarding(); } catch {} window.location.hash = '#/prestamos'; setFirstRun(false); }}>
          Ahora no: <b>ver lo que tienen mis colegas</b>
        </button>
      )}
      <AccountModal open={cuentaOb} onClose={() => setCuentaOb(false)}/>
      <ConflictModal/>
      <OnboardingPage onComplete={async () => { try { await asignarImagenesPorDefecto(); } catch {} setFirstRun(false); }}/>
    </div>
  );

  return (
    <HashRouter>
      <div className={'shell' + (isDesktop ? '' : ' shell-mobile')}>
        {isDesktop && <Titlebar/>}
        <InstallHint/>
        <div className="body">
          <Sidebar/>
          <main className="main">
            <Routes>
              <Route path="/"                element={<Navigate to="/dashboard" replace/>}/>
              <Route path="/dashboard"       element={<Dashboard/>}/>
              <Route path="/plataformas"     element={<PlataformasPage/>}/>
              <Route path="/plataformas/:id" element={<PlataformaDetail/>}/>
              <Route path="/juegos"          element={<JuegosPage/>}/>
              <Route path="/deseos"          element={<DeseosPage/>}/>
              <Route path="/stats"           element={<StatsPage/>}/>
              <Route path="/pila"            element={<PilaPage/>}/>
              <Route path="/comunidad"       element={<ComunidadPage/>}/>
              <Route path="/comunidad/:user" element={<PerfilPage/>}/>
              <Route path="/prestamos"       element={<PrestamosPage/>}/>
              <Route path="/reclamar/:id/:code" element={<ReclamarPage/>}/>
            </Routes>
          </main>
        </div>
        <ClaimBanner/>
        <ConflictModal/>
        <RemoteToast/>
      </div>
    </HashRouter>
  );
}
