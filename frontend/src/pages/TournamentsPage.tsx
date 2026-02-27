import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTournaments, type Tournament } from '../services/tournamentService';

export const TournamentsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTournaments();
        setTournaments(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <h1>Torneos</h1>
        </div>
        <div className="app-header-right">
          {user && (
            <>
              <span className="user-label">
                {user.name} ({user.role === 'admin' ? 'Admin' : 'Usuario'})
              </span>
              <button className="secondary-btn" onClick={logout}>
                Cerrar sesión
              </button>
              {user.role === 'admin' && (
                <>
                  <Link className="secondary-btn link-btn" to="/tournaments/new">
                    Agregar torneo
                  </Link>
                  <Link className="secondary-btn link-btn" to="/admin/users">
                    Usuarios
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </header>
      <main className="app-main">
        {loading && <p>Cargando torneos...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <div className="tournaments-grid">
            {tournaments.map((tournament) => (
              <article key={tournament.id} className="card tournament-card">
                <h2>{tournament.name}</h2>
                <p className="tournament-dates">
                  {tournament.start_date} - {tournament.end_date}
                </p>
                <div className="tournament-meta">
                  <div>
                    <span className="meta-label">Participantes</span>
                    <span className="meta-value">{tournament.participants_count}</span>
                  </div>
                  <div>
                    <span className="meta-label">Grupos</span>
                    <span className="meta-value">{tournament.groups_count}</span>
                  </div>
                  <div>
                    <span className="meta-label">Rondas</span>
                    <span className="meta-value">{tournament.rounds_count}</span>
                  </div>
                </div>
                <div className="card-actions">
                  <Link className="secondary-btn link-btn" to={`/tournaments/${tournament.id}`}>
                    Ver detalle
                  </Link>
                  {user?.role === 'admin' && (
                    <Link className="secondary-btn link-btn" to={`/tournaments/${tournament.id}/edit`}>
                      Editar
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {tournaments.length === 0 && <p>No hay torneos registrados todavía.</p>}
          </div>
        )}
      </main>
    </div>
  );
};

