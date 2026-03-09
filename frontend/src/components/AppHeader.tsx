import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getContactSettings } from '../services/settingsService';

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
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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
        { to: '/admin/users', label: 'Usuarios' },
        { to: '/admin/settings', label: 'Configuración' }
      );
    }
    return base;
  }, [user]);

  const openContact = async () => {
    setIsContactOpen(true);
    setContactLoading(true);
    setContactError(null);
    try {
      const data = await getContactSettings();
      setContactEmail(data.contact_email);
    } catch (err) {
      setContactError((err as Error).message);
      setContactEmail('');
    } finally {
      setContactLoading(false);
    }
  };

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
          {user && (
            <button type="button" className="app-nav-link app-nav-link-btn" onClick={() => void openContact()}>
              Contacto
            </button>
          )}
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
            {user && (
              <button type="button" className="app-nav-link app-nav-link-btn" onClick={() => void openContact()}>
                Contacto
              </button>
            )}
            {navItems.map((item) => (
              <Link key={`mobile-${item.to}`} to={item.to} className="app-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {isContactOpen && (
        <div className="modal-overlay" onClick={() => setIsContactOpen(false)}>
          <div className="modal-card card" onClick={(event) => event.stopPropagation()}>
            <h2>Contacto</h2>
            {contactLoading ? (
              <p>Cargando información de contacto...</p>
            ) : contactError ? (
              <p className="error-text">{contactError}</p>
            ) : (
              <p>
                Para más información escríbenos a{' '}
                <a href={`mailto:${contactEmail}`} className="app-nav-link-contacto">
                  {contactEmail}
                </a>
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={() => setIsContactOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

