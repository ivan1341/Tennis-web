import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTournamentRound, getTournamentRounds, getTournaments, updateTournament, type TournamentRound } from '../services/tournamentService';
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
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [newRoundStartDate, setNewRoundStartDate] = useState('');
  const [newRoundEndDate, setNewRoundEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        const roundsData = await getTournamentRounds(current.id);
        setRounds(roundsData);
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
    setSuccess(null);

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

  const handleCreateRound = async () => {
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    if (newRoundStartDate === '' || newRoundEndDate === '') {
      setError('Debes elegir fecha inicio y fecha fin para la ronda.');
      return;
    }

    if (newRoundStartDate > newRoundEndDate) {
      setError('La fecha inicio no puede ser mayor a la fecha fin.');
      return;
    }

    if (newRoundStartDate < startDate || newRoundEndDate > endDate) {
      setError('Las fechas de la ronda deben estar dentro de las fechas del torneo.');
      return;
    }

    const hasOverlap = rounds.some(
      (round) => newRoundStartDate <= round.end_date && newRoundEndDate >= round.start_date
    );
    if (hasOverlap) {
      setError('Las fechas de la ronda se traslapan con otra ronda existente.');
      return;
    }

    setCreatingRound(true);
    try {
      const createdRound = await createTournamentRound(
        {
          tournament_id: tournamentId,
          start_date: newRoundStartDate,
          end_date: newRoundEndDate
        },
        token
      );
      setRoundsCount((prev) => prev + 1);
      setRounds((prev) => [...prev, createdRound].sort((a, b) => a.round_number - b.round_number));
      setNewRoundStartDate('');
      setNewRoundEndDate('');
      setSuccess('Ronda creada correctamente.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingRound(false);
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
            <h2>Editar torneo #{name}</h2>

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

            <label>
              Rondas actuales
              <input type="number" min={0} value={roundsCount} readOnly />
            </label>

            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text">{success}</p>}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Guardando...' : 'Actualizar torneo'}
            </button>

            <div className="round-create-form">
              <h3>Crear nueva ronda</h3>
              <label>
                Fecha inicio
                <input
                  type="date"
                  value={newRoundStartDate}
                  onChange={(event) => setNewRoundStartDate(event.target.value)}
                />
              </label>
              <label>
                Fecha fin
                <input
                  type="date"
                  value={newRoundEndDate}
                  onChange={(event) => setNewRoundEndDate(event.target.value)}
                />
              </label>
              <button type="button" className="secondary-btn" disabled={creatingRound} onClick={() => void handleCreateRound()}>
                {creatingRound ? 'Creando...' : 'Crear ronda'}
              </button>
            </div>

            <p className="muted">
              <Link to="/tournaments">Volver a torneos</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
};

