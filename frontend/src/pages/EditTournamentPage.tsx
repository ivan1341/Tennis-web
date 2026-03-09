import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createTournamentRound,
  getTournamentPlayers,
  getTournamentRounds,
  getTournaments,
  syncTournamentPlayers,
  updateTournament,
  type TournamentAssignedPlayer,
  type TournamentRound
} from '../services/tournamentService';
import { AppHeader } from '../components/AppHeader';

interface BoardPlayer {
  user_id: number;
  name: string;
}

interface SnackbarState {
  message: string;
  type: 'error' | 'success';
}

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
  const [playersByGroup, setPlayersByGroup] = useState<Record<number, BoardPlayer[]>>({});
  const [savingPlayers, setSavingPlayers] = useState(false);
  const [playersDirty, setPlayersDirty] = useState(false);
  const [dragging, setDragging] = useState<{ fromGroup: number; fromIndex: number } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ groupNumber: number; index: number } | null>(null);
  const [newRoundStartDate, setNewRoundStartDate] = useState('');
  const [newRoundEndDate, setNewRoundEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  const buildBoardFromAssignments = (assignments: TournamentAssignedPlayer[], groups: number): Record<number, BoardPlayer[]> => {
    const board: Record<number, BoardPlayer[]> = {};
    for (let group = 1; group <= groups; group += 1) {
      board[group] = [];
    }
    assignments
      .slice()
      .sort((a, b) => a.group_number - b.group_number || a.position_index - b.position_index || a.name.localeCompare(b.name, 'es'))
      .forEach((item) => {
        if (!board[item.group_number]) board[item.group_number] = [];
        board[item.group_number].push({ user_id: item.user_id, name: item.name });
      });
    return board;
  };

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

        const [roundsData, assignedPlayers] = await Promise.all([
          getTournamentRounds(current.id),
          getTournamentPlayers(current.id)
        ]);

        setName(current.name);
        setStartDate(current.start_date);
        setEndDate(current.end_date);
        setParticipantsCount(current.participants_count);
        setRoundsCount(current.rounds_count);
        setRounds(roundsData);
        setPlayersByGroup(buildBoardFromAssignments(assignedPlayers, current.groups_count));
        setPlayersDirty(false);
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

  useEffect(() => {
    if (!error) return;
    setSnackbar({ message: error, type: 'error' });
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    setSnackbar({ message: success, type: 'success' });
    setSuccess(null);
  }, [success]);

  useEffect(() => {
    if (!snackbar) return;
    const timer = window.setTimeout(() => setSnackbar(null), 3500);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  const applyOverflowShift = (board: Record<number, BoardPlayer[]>, startGroup: number): boolean => {
    for (let group = startGroup; group <= groupsCount; group += 1) {
      while ((board[group] ?? []).length > 5) {
        if (group === groupsCount) return false;
        const shifted = board[group].pop();
        if (!shifted) return false;
        board[group + 1] = board[group + 1] ?? [];
        board[group + 1].unshift(shifted);
      }
    }
    return true;
  };

  const handleDropPlayer = (targetGroup: number, targetIndex: number) => {
    if (!dragging) return;

    setPlayersByGroup((prev) => {
      const next: Record<number, BoardPlayer[]> = {};
      for (let group = 1; group <= groupsCount; group += 1) {
        next[group] = [...(prev[group] ?? [])];
      }

      const sourcePlayers = next[dragging.fromGroup] ?? [];
      const moved = sourcePlayers[dragging.fromIndex];
      if (!moved) return prev;

      sourcePlayers.splice(dragging.fromIndex, 1);
      const destinationPlayers = next[targetGroup] ?? [];

      let insertIndex = Math.max(0, Math.min(targetIndex, destinationPlayers.length));
      if (dragging.fromGroup === targetGroup && dragging.fromIndex < insertIndex) {
        insertIndex -= 1;
      }
      destinationPlayers.splice(insertIndex, 0, moved);

      const shifted = applyOverflowShift(next, targetGroup);
      if (!shifted) {
        setError('No hay espacio para desplazar jugadoras al siguiente grupo.');
        return prev;
      }

      setPlayersDirty(true);
      setPendingRemove(null);
      setError(null);
      return next;
    });

    setDragging(null);
  };

  const handleRemovePlayer = (groupNumber: number, index: number) => {
    setPlayersByGroup((prev) => {
      const next: Record<number, BoardPlayer[]> = {};
      for (let group = 1; group <= groupsCount; group += 1) {
        next[group] = [...(prev[group] ?? [])];
      }
      next[groupNumber].splice(index, 1);
      return next;
    });
    setPlayersDirty(true);
    setPendingRemove(null);
    setError(null);
  };

  const handleSavePlayers = async () => {
    setError(null);
    setSuccess(null);
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    setSavingPlayers(true);
    try {
      const payload = Object.entries(playersByGroup).flatMap(([group, players]) =>
        players.map((player, idx) => ({
          user_id: player.user_id,
          group_number: Number(group),
          position_index: idx + 1
        }))
      );

      await syncTournamentPlayers(
        {
          tournament_id: tournamentId,
          players: payload
        },
        token
      );
      setPlayersDirty(false);
      setSuccess('Participantes reordenados correctamente.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPlayers(false);
    }
  };

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

            <div className="round-create-form">
              <h3>Rondas del torneo</h3>
              {rounds.length === 0 ? (
                <p className="muted">No hay rondas registradas.</p>
              ) : (
                <ul className="edit-rounds-list">
                  {rounds.map((round) => (
                    <li key={round.id}>
                      Ronda {round.round_number}: {round.start_date} - {round.end_date}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="round-create-form">
              <h3>Participantes inscritos (drag and drop)</h3>
              <p className="muted">Arrastra para mover dentro del grupo o entre grupos. Usa "Dar de baja" para remover y reacomodar.</p>
              <div className="edit-groups-grid">
                {Array.from({ length: groupsCount }, (_, idx) => idx + 1).map((groupNumber) => {
                  const players = playersByGroup[groupNumber] ?? [];
                  return (
                    <section
                      key={groupNumber}
                      className="edit-group-card"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDropPlayer(groupNumber, players.length)}
                    >
                      <h4>Grupo {groupNumber}</h4>
                      {players.length === 0 ? (
                        <p className="muted">Sin participantes</p>
                      ) : (
                        <ol className="edit-group-list">
                          {players.map((player, index) => (
                            <li
                              key={`${player.user_id}-${groupNumber}`}
                              className="edit-group-item"
                              draggable
                              onDragStart={() => setDragging({ fromGroup: groupNumber, fromIndex: index })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleDropPlayer(groupNumber, index);
                              }}
                            >
                              <span>{index + 1}. {player.name}</span>
                              {pendingRemove?.groupNumber === groupNumber && pendingRemove.index === index ? (
                                <div className="edit-item-actions">
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => handleRemovePlayer(groupNumber, index)}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setPendingRemove(null)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => setPendingRemove({ groupNumber, index })}
                                >
                                  Dar de baja
                                </button>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  );
                })}
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void handleSavePlayers()}
                disabled={!playersDirty || savingPlayers}
              >
                {savingPlayers ? 'Guardando participantes...' : 'Guardar distribución de participantes'}
              </button>
            </div>

            <p className="muted">
              <Link to="/tournaments">Volver a torneos</Link>
            </p>
          </form>
        )}
      </main>
      {snackbar && (
        <div className={`snackbar snackbar-${snackbar.type}`} role="status" aria-live="polite">
          {snackbar.message}
        </div>
      )}
    </div>
  );
};

