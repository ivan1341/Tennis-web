import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { getContactSettings, updateContactSettings } from '../services/settingsService';

export const AdminSettingsPage: React.FC = () => {
  const { token } = useAuth();
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const settings = await getContactSettings();
        setContactEmail(settings.contact_email);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateContactSettings(contactEmail, token);
      setContactEmail(result.contact_email);
      setSuccess('Correo de contacto actualizado correctamente.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader title="Configuración" />
      <main className="app-main centered">
        <section className="card form-card">
          <h2>Contacto general</h2>
          {loading ? (
            <p>Cargando configuración...</p>
          ) : (
            <form onSubmit={handleSave}>
              <label>
                Correo de contacto
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  required
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              {success && <p className="success-text">{success}</p>}
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </form>
          )}
          <p className="muted">
            <Link to="/tournaments">Volver a torneos</Link>
          </p>
        </section>
      </main>
    </div>
  );
};

