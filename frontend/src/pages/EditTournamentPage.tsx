import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTournaments, updateTournament } from '../services/tournamentService';
import { AppHeader } from '../components/AppHeader';

export const EditTournamentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantsCount, setParticipantsCount] = useState(0);
  const [roundsCount, setRoundsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTournament = async () => {
      setLoadingInitial(true);
      setError(null);

      try {
        const tournaments = await getTournaments();
        const current = tournaments.find((item) => item.id === tournamentId);

        if (!current) {
          setError('No se encontró el torneo');
          return;
        }

        setName(current.name);
        setStartDate(current.start_date);
        setEndDate(current.end_date);
        setParticipantsCount(current.participants_count);
        setRoundsCount(current.rounds_count);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingInitial(false);
      }
    };

    if (!Number.isNaN(tournamentId) && tournamentId > 0) {
      void loadTournament();
    } else {
      setError('ID de torneo inválido');
      setLoadingInitial(false);
    }
  }, [tournamentId]);

  const groupsCount = useMemo(() => Math.max(1, Math.ceil(participantsCount / 5)), [participantsCount]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    if (participantsCount < 5 || participantsCount % 5 !== 0) {
      setError('Los participantes deben ser múltiplos de 5 (5, 10, 15, ...).');
      return;
    }

    setLoading(true);
    try {
      await updateTournament(
        {
          id: tournamentId,
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
      <AppHeader title="Editar torneo" />

      <main className="app-main centered">
        {loadingInitial ? (
          <p>Cargando torneo...</p>
        ) : (
          <form className="card form-card" onSubmit={handleSubmit}>
            <h2>Editar torneo #{tournamentId}</h2>

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
                min={5}
                step={5}
                value={participantsCount}
                onChange={(e) => setParticipantsCount(Number(e.target.value))}
                required
              />
            </label>

            <label>
              Grupos
              <input
                type="number"
                min={1}
                value={groupsCount}
                readOnly
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Guardando...' : 'Actualizar torneo'}
            </button>

            <p className="muted">
              <Link to="/tournaments">Volver a torneos</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
};

