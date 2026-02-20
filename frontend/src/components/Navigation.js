import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, FileText, Users, LogOut, Settings, Menu, X } from 'lucide-react';

const Navigation = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src="/lambert-logo.jpg" 
              alt="Lambert" 
              style={{ height: '40px', width: 'auto' }}
            />
          </Link>
        </div>

        <button className="nav-toggle" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`nav-menu ${isOpen ? 'nav-menu-open' : ''}`}>
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'nav-link-active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <Home size={20} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/inspections"
            className={`nav-link ${isActive('/inspections') ? 'nav-link-active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <ClipboardCheck size={20} />
            <span>Inspections</span>
          </Link>

          {['admin', 'supervisor'].includes(user?.role) && (
            <Link
              to="/forms"
              className={`nav-link ${isActive('/forms') ? 'nav-link-active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <FileText size={20} />
              <span>Forms</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link
              to="/users"
              className={`nav-link ${isActive('/users') ? 'nav-link-active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <Users size={20} />
              <span>Users</span>
            </Link>
{user?.role === 'admin' && (
  <Link
    to="/admin"
    className={`nav-link ${isActive('/admin') ? 'nav-link-active' : ''}`}
    onClick={() => setIsOpen(false)}
  >
    <Settings size={20} />
    <span>Admin</span>
  </Link>
)}

          <button onClick={onLogout} className="nav-link nav-logout">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
