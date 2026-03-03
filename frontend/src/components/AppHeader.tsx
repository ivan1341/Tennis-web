import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AppHeaderProps {
  title: string;
}

interface NavItem {
  to: string;
  label: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    setIsNavOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  const navItems = useMemo<NavItem[]>(() => {
    if (!user) {
      return [];
    }

    const base: NavItem[] = [{ to: '/tournaments', label: 'Torneos' }];
    if (user.role === 'admin') {
      base.push(
        { to: '/tournaments/new', label: 'Agregar torneo' },
        { to: '/admin/users', label: 'Usuarios' }
      );
    }
    return base;
  }, [user]);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setIsNavOpen((prev) => !prev)}
          aria-label="Abrir menú de navegación"
          aria-expanded={isNavOpen}
        >
          ☰
        </button>

        <h1>{title}</h1>

        <nav className="app-nav desktop-nav">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="app-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {user && (
        <div className="app-header-right">
          <div className="user-menu-wrapper">
            <button
              type="button"
              className="user-name-btn"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              aria-expanded={isUserMenuOpen}
            >
              {user.name}
            </button>

            {isUserMenuOpen && (
              <div className="user-dropdown-menu">
                {navItems.map((item) => (
                  <Link key={`dropdown-${item.to}`} to={item.to} className="user-dropdown-link">
                    {item.label}
                  </Link>
                ))}
                <button type="button" className="user-dropdown-link user-dropdown-logout" onClick={logout}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isNavOpen && (
        <div className="mobile-nav-panel">
          <nav className="app-nav mobile-nav">
            {navItems.map((item) => (
              <Link key={`mobile-${item.to}`} to={item.to} className="app-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

