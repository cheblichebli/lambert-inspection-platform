import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, FileText, Users, LogOut, Settings, Menu, X, Shield, AlertTriangle, Calendar } from 'lucide-react';
import SyncStatus from './SyncStatus';

const Navigation = ({ user, onLogout, isOnline }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <div className="nav-mobile-bar">
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/lambert-logo-white.png" alt="Lambert" style={{ height: '36px', width: 'auto' }} />
        </Link>
        <button className="nav-toggle" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* ── Sidebar (desktop) + slide-down menu (mobile) ───────────────── */}
      <nav className={`navigation ${isOpen ? 'nav-open' : ''}`}>

        {/* Brand — desktop sidebar only */}
        <div className="nav-brand">
          <Link to="/" onClick={() => setIsOpen(false)}>
            <img src="/lambert-logo-white.png" alt="Lambert" style={{ height: '44px', width: 'auto' }} />
          </Link>
        </div>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
            <Home size={20} />
            <span>Dashboard</span>
          </Link>

          <Link to="/inspections" className={`nav-link ${isActive('/inspections') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
            <ClipboardCheck size={20} />
            <span>Inspections</span>
          </Link>

          <Link to="/schedule" className={`nav-link ${isActive('/schedule') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
            <Calendar size={20} />
            <span>Schedule</span>
          </Link>

          <Link to="/capa" className={`nav-link ${isActive('/capa') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
            <AlertTriangle size={20} />
            <span>CAPA</span>
          </Link>

          {['admin', 'supervisor'].includes(user?.role) && (
            <Link to="/forms" className={`nav-link ${isActive('/forms') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
              <FileText size={20} />
              <span>Forms</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/users" className={`nav-link ${isActive('/users') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
              <Users size={20} />
              <span>Users</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
              <Settings size={20} />
              <span>Admin</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/audit-logs" className={`nav-link ${isActive('/audit-logs') ? 'nav-link-active' : ''}`} onClick={() => setIsOpen(false)}>
              <Shield size={20} />
              <span>Audit Logs</span>
            </Link>
          )}
        </div>

        {/* Bottom section — sync + logout */}
        <div className="nav-bottom">
          <div className="nav-sync-wrapper">
            <SyncStatus isOnline={isOnline} />
          </div>
          <button onClick={onLogout} className="nav-link nav-logout">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

      </nav>

      {/* Mobile overlay — tap outside to close */}
      {isOpen && <div className="nav-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
};

export default Navigation;
