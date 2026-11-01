import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Titlebar         from './components/layout/Titlebar';
import InstallHint from './components/ios/InstallHint';
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

const api = window.api;
const isDesktop = api?.platform === 'electron';

export default function App() {
  const [checking, setChecking] = useState(true);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    if (api) {
      api.app.isFirstRun()
        .then(is => { setFirstRun(is); setChecking(false); })
        .catch(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'var(--bg-0)', color:'var(--text-2)' }}>
      Cargando…
    </div>
  );

  if (firstRun) return (
    <div className="shell">
      {isDesktop && <Titlebar/>}
      <InstallHint/>
      <OnboardingPage onComplete={() => setFirstRun(false)}/>
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
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
