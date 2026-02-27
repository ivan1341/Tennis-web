import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTournament } from '../services/tournamentService';

export const AddTournamentPage: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantsCount, setParticipantsCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    try {
      await createTournament(
        {
          name,
          start_date: startDate,
          end_date: endDate,
          participants_count: participantsCount,
          groups_count: groupsCount,
          rounds_count: roundsCount
        },
        token
      );
      navigate('/tournaments');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <h1>Agregar torneo</h1>
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
            </>
          )}
        </div>
      </header>

      <main className="app-main centered">
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2>Nuevo torneo</h2>

          <label>
            Nombre del torneo
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label>
            Fecha inicio
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>

          <label>
            Fecha fin
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>

          <label>
            Participantes
            <input
              type="number"
              min={0}
              value={participantsCount}
              onChange={(e) => setParticipantsCount(Number(e.target.value))}
              required
            />
          </label>

          <label>
            Grupos
            <input
              type="number"
              min={0}
              value={groupsCount}
              onChange={(e) => setGroupsCount(Number(e.target.value))}
              required
            />
          </label>

          <label>
            Rondas
            <input
              type="number"
              min={0}
              value={roundsCount}
              onChange={(e) => setRoundsCount(Number(e.target.value))}
              required
            />
          </label>

          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar torneo'}
          </button>

          <p className="muted">
            <Link to="/tournaments">Volver a torneos</Link>
          </p>
        </form>
      </main>
    </div>
  );
};

