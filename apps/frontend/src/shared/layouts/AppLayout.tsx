import { PropsWithChildren, useEffect, useState } from 'react';
import { BarChart3, Beaker, Boxes, Factory, History, LogOut, Maximize2, Menu, Minimize2, Settings, Users, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { clearSessionAndRedirect, getSessionUser } from '../../features/auth/session';
import { NotificationBell } from '../components/NotificationBell';
import { useActivePlant } from '../../features/plant/useActivePlant';

const items = [
  { to: '/fabricacion', label: 'Fabricación', icon: Factory, roles: ['FABRICACION', 'ADMIN'] },
  { to: '/laboratorio', label: 'Laboratorio', icon: Beaker, roles: ['LABORATORIO', 'ADMIN'] },
  { to: '/envasado', label: 'Envasado', icon: Boxes, roles: ['ENVASADO', 'ADMIN'] },
  { to: '/jefatura', label: 'Resumen diario', icon: BarChart3, roles: ['JEFATURA', 'ADMIN'] },
  { to: '/historial', label: 'Historial', icon: History, roles: ['MONITOREO', 'JEFATURA', 'ADMIN'] },
  { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] }
];

const roleLabels: Record<string, string> = {
  FABRICACION: 'Fabricación', LABORATORIO: 'Laboratorio', ENVASADO: 'Envasado',
  MONITOREO: 'Monitoreo', JEFATURA: 'Jefatura', ADMIN: 'Administrador'
};

export function AppLayout({ children }: PropsWithChildren) {
  const user = getSessionUser();
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const allowed = items.filter((item) => item.roles.includes(user?.role ?? ''));
  const { plants, active, select } = useActivePlant();
  const plantQuery = active ? `?plant=${active.code}` : '';

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // El navegador puede bloquear la API; el resto del panel debe seguir operativo.
    }
  };

  return (
    <div className="plant-shell">
      <aside className={`plant-sidebar ${open ? 'is-open' : ''}`}>
        <header className="plant-brand">
          <img className="plant-brand__logo" src="/brand/grupo-disal-logo.png" alt="Grupo DISAL" />
          <div className="plant-selector"><select aria-label="Planta activa" value={active?.code ?? ''} onChange={(e) => void select(e.target.value)}>{plants.map((plant) => <option key={plant.id} value={plant.code}>{plant.name}</option>)}</select></div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </header>
        <nav>
          {allowed.map((item) => <NavLink key={item.to} to={`${item.to}${plantQuery}`} onClick={() => setOpen(false)}><item.icon size={19}/><span>{item.label}</span></NavLink>)}
        </nav>
        <footer>
          <div className="plant-user"><Settings size={18}/><div><strong>{user?.fullName}</strong><small>{roleLabels[user?.role ?? ''] ?? user?.role}</small></div></div>
          <button className="plant-logout" onClick={clearSessionAndRedirect}><LogOut size={18}/> Salir</button>
        </footer>
      </aside>
      {open ? <button className="plant-sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar menú" /> : null}
      <main className="plant-main">
        <div className="plant-screen-controls">
          <button className="plant-menu" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={21}/> Menú</button>
          {['FABRICACION', 'LABORATORIO', 'ENVASADO', 'ADMIN'].includes(user?.role ?? '') ? <NotificationBell/> : null}
          <button className="plant-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
            {isFullscreen ? <Minimize2 size={21}/> : <Maximize2 size={21}/>}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
