import * as React from 'react';
import Sidebar           from './components/Sidebar';
import Header            from './components/Header';
import Login             from './components/Login';
import ModuleChooser     from './components/ModuleChooser';
import OperationsModule  from './components/operations/OperationsModule';
import FleetDashboard    from './components/fleet/FleetDashboard';
import Vehicles          from './components/fleet/Vehicles';
import Inspections       from './components/fleet/Inspections';
import Costs             from './components/fleet/Costs';
import Licenses          from './components/fleet/Licenses';
import FleetReports      from './components/fleet/FleetReports';
import Templates         from './components/fleet/Templates';
import Compliance        from './components/fleet/Compliance';
import Administration    from './components/fleet/Administration';
import { FleetView, User, getModuleAccess } from './types';
import { getCurrentUser, onAuthStateChange, signOut } from './supabase/services/auth.service';

type ActiveModule = 'fleet' | 'operations';

const App: React.FC = () => {
  const [user, setUser]                           = React.useState<User | null>(null);
  const [loading, setLoading]                     = React.useState(true);
  const [module, setModule]                       = React.useState<ActiveModule | null>(null);
  const [currentView, setCurrentView]             = React.useState<FleetView>('FleetDashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isMobileOpen, setMobileOpen]             = React.useState(false);

  React.useEffect(() => {
    let loaded = false;
    const stopLoading = () => { if (!loaded) { loaded = true; setLoading(false); } };
    const t = setTimeout(stopLoading, 4000);
    getCurrentUser()
      .then(u => { setUser(u); stopLoading(); })
      .catch(() => stopLoading());
    const unsub = onAuthStateChange(u => { setUser(u); stopLoading(); });
    return () => { unsub(); clearTimeout(t); };
  }, []);

  // ── Session inactivity timeout (30 min) ──────────────────────────────────────
  React.useEffect(() => {
    if (!user) return;
    const TIMEOUT_MS = 30 * 60 * 1000;
    let timer = setTimeout(handleLogout, TIMEOUT_MS);
    const reset = () => { clearTimeout(timer); timer = setTimeout(handleLogout, TIMEOUT_MS); };
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (view: FleetView) => { setCurrentView(view); setMobileOpen(false); };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setModule(null);
    setCurrentView('FleetDashboard');
  };

  const handleLogin = (u: User) => {
    setUser(u);
    const access = getModuleAccess(u);
    if (access === 'fleet')           setModule('fleet');
    else if (access === 'operations') setModule('operations');
    else                              setModule(null); // chooser
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-100">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500 font-medium">Loading…</p>
      </div>
    </div>
  );

  // ── Not logged in ─────────────────────────────────────────────────────────────
  if (!user) return <Login onLogin={handleLogin} />;

  // ── Module chooser ────────────────────────────────────────────────────────────
  if (module === null) {
    return <ModuleChooser user={user} onSelect={(m: ActiveModule) => setModule(m)} onLogout={handleLogout} />;
  }

  // ── Operations module (direct render — no iframe) ─────────────────────────────
  if (module === 'operations') {
    const canSwitchToFleet = user.role === 'Admin' || user.fleet_role != null;
    return (
      <OperationsModule
        user={user}
        onSwitchToFleet={canSwitchToFleet ? () => setModule('fleet') : undefined}
        onLogout={handleLogout}
      />
    );
  }

  // ── Fleet module ──────────────────────────────────────────────────────────────
  const renderFleetView = () => {
    switch (currentView) {
      case 'FleetDashboard':  return <FleetDashboard user={user} />;
      case 'Vehicles':        return <Vehicles user={user} />;
      case 'Inspections':     return <Inspections user={user} />;
      case 'Costs':           return <Costs user={user} />;
      case 'Licenses':        return <Licenses user={user} />;
      case 'FleetReports':    return <FleetReports />;
      case 'Templates':       return <Templates user={user} />;
      case 'Compliance':      return <Compliance user={user} />;
      case 'Administration':  return <Administration currentUser={user} />;
      default:                return <FleetDashboard user={user} />;
    }
  };

  const canSwitchToOps = user.role === 'Admin' || user.fleet_role != null;

  return (
    <div className="flex h-screen bg-zinc-100 font-sans overflow-hidden">
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <Sidebar
        user={user}
        currentView={currentView}
        setCurrentView={navigate}
        collapsed={isSidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={isMobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          onLogout={handleLogout}
          onMobileMenuToggle={() => setMobileOpen(prev => !prev)}
          onSwitchModule={canSwitchToOps ? setModule : undefined}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-100 p-4 md:p-8">
          {renderFleetView()}
        </main>
      </div>
    </div>
  );
};

export default App;
