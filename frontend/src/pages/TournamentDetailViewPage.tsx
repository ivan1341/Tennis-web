import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createTournamentRound,
  getMatchResults,
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  saveMatchResult,
  type MatchResult,
  type Tournament,
  type TournamentAssignedPlayer,
  type TournamentRound
} from '../services/tournamentService';
import { AppHeader } from '../components/AppHeader';

interface GroupPlayer {
  id: number | null;
  name: string;
}

interface GroupData {
  groupNumber: number;
  name: string;
  players: GroupPlayer[];
}

interface GroupMatch {
  groupNumber: number;
  playerOne: GroupPlayer;
  playerTwo: GroupPlayer;
}

const getPairKey = (playerOneId: number, playerTwoId: number): string => {
  const a = Math.min(playerOneId, playerTwoId);
  const b = Math.max(playerOneId, playerTwoId);
  return `${a}-${b}`;
};

const buildGroups = (tournament: Tournament, assignedPlayers: TournamentAssignedPlayer[]): GroupData[] => {
  const groupsCount = Math.max(1, tournament.groups_count || 1);
  const groupedPlayers = Array.from({ length: groupsCount }, (_, idx) =>
    assignedPlayers
      .filter((player) => player.group_number === idx + 1)
      .map((player) => ({ id: player.user_id, name: player.name }))
  );
  const maxAssignedInGroup = groupedPlayers.reduce((max, players) => Math.max(max, players.length), 0);
  const playersPerGroup = Math.max(
    2,
    maxAssignedInGroup,
    Math.min(5, Math.ceil((tournament.participants_count || groupsCount * 2) / groupsCount))
  );

  return Array.from({ length: groupsCount }, (_, groupIndex) => ({
    groupNumber: groupIndex + 1,
    name: `Grupo ${groupIndex + 1}`,
    players: [
      ...groupedPlayers[groupIndex],
      ...Array.from({ length: playersPerGroup - groupedPlayers[groupIndex].length }, () => ({
        id: null,
        name: 'Por definir'
      }))
    ]
  }));
};

const buildGroupMatches = (group: GroupData): GroupMatch[] => {
  const assignedPlayers = group.players.filter(
    (player): player is GroupPlayer & { id: number } => player.id !== null
  );
  const matches: GroupMatch[] = [];

  for (let i = 0; i < assignedPlayers.length; i += 1) {
    for (let j = i + 1; j < assignedPlayers.length; j += 1) {
      matches.push({
        groupNumber: group.groupNumber,
        playerOne: assignedPlayers[i],
        playerTwo: assignedPlayers[j]
      });
    }
  }

  return matches;
};

export const TournamentDetailViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { user, token } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [assignedPlayers, setAssignedPlayers] = useState<TournamentAssignedPlayer[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [newRoundStartDate, setNewRoundStartDate] = useState('');
  const [newRoundEndDate, setNewRoundEndDate] = useState('');
  const [resultDrafts, setResultDrafts] = useState<Record<string, { scoreOne: string; scoreTwo: string }>>({});

  useEffect(() => {
    const load = async () => {
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        setError('ID de torneo inválido');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [data, players] = await Promise.all([
          getTournamentById(tournamentId),
          getTournamentPlayers(tournamentId)
        ]);
        if (!data) {
          setError('Torneo no encontrado');
          setTournament(null);
          return;
        }

        const roundsData = await getTournamentRounds(data.id);
        setTournament(data);
        setAssignedPlayers(players);
        setRounds(roundsData);
        setSelectedRound(roundsData.length > 0 ? roundsData[0].round_number : null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tournamentId]);

  useEffect(() => {
    const loadResults = async () => {
      if (!tournament || selectedRound === null) {
        setMatchResults([]);
        return;
      }
      try {
        const results = await getMatchResults(tournament.id, selectedRound);
        setMatchResults(results);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    void loadResults();
  }, [tournament, selectedRound]);

  const handleCreateRound = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token || !tournament) {
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

    try {
      const createdRound = await createTournamentRound(
        {
          tournament_id: tournament.id,
          start_date: newRoundStartDate,
          end_date: newRoundEndDate
        },
        token
      );

      const nextRounds = [...rounds, createdRound].sort((a, b) => a.round_number - b.round_number);
      setRounds(nextRounds);
      setTournament({ ...tournament, rounds_count: nextRounds.length });
      setSelectedRound(createdRound.round_number);
      setNewRoundStartDate('');
      setNewRoundEndDate('');
      setSuccess('Ronda creada correctamente');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getDraftForMatch = (playerOneId: number, playerTwoId: number): { scoreOne: string; scoreTwo: string } => {
    const key = getPairKey(playerOneId, playerTwoId);
    if (resultDrafts[key]) return resultDrafts[key];

    const existing = matchResults.find((result) => getPairKey(result.player_one_id, result.player_two_id) === key);
    if (!existing) return { scoreOne: '', scoreTwo: '' };

    if (existing.player_one_id === playerOneId) {
      return { scoreOne: String(existing.player_one_score), scoreTwo: String(existing.player_two_score) };
    }
    return { scoreOne: String(existing.player_two_score), scoreTwo: String(existing.player_one_score) };
  };

  const updateDraft = (playerOneId: number, playerTwoId: number, next: { scoreOne: string; scoreTwo: string }) => {
    const key = getPairKey(playerOneId, playerTwoId);
    setResultDrafts((prev) => ({ ...prev, [key]: next }));
  };

  const handleSaveMatch = async (groupNumber: number, playerOneId: number, playerTwoId: number) => {
    if (!token || !tournament || selectedRound === null) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    const draft = getDraftForMatch(playerOneId, playerTwoId);
    const parsedOne = Number(draft.scoreOne);
    const parsedTwo = Number(draft.scoreTwo);
    if (draft.scoreOne.trim() === '' || draft.scoreTwo.trim() === '' || Number.isNaN(parsedOne) || Number.isNaN(parsedTwo)) {
      setError('Debes ingresar ambos resultados con números válidos');
      return;
    }
    if (parsedOne < 0 || parsedTwo < 0) {
      setError('Los resultados no pueden ser negativos');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await saveMatchResult(
        {
          tournament_id: tournament.id,
          round_number: selectedRound,
          group_number: groupNumber,
          player_one_id: playerOneId,
          player_two_id: playerTwoId,
          player_one_score: parsedOne,
          player_two_score: parsedTwo
        },
        token
      );

      const refreshed = await getMatchResults(tournament.id, selectedRound);
      setMatchResults(refreshed);
      setSuccess('Resultado guardado correctamente');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p>Cargando detalle del torneo...</p>
        </main>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p className="error-text">{error ?? 'No se pudo cargar el torneo'}</p>
          <Link to="/tournaments">Volver a torneos</Link>
        </main>
      </div>
    );
  }

  const groups = buildGroups(tournament, assignedPlayers);
  const selectedRoundData = rounds.find((round) => round.round_number === selectedRound) ?? null;

  return (
    <div className="app-shell">
      <AppHeader title={tournament.name} />

      <main className="app-main tournament-detail-main">
        <section className="card tournament-detail-hero">
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
          <div className="round-selector">
            <label htmlFor="round-select">Ronda</label>
            <select
              id="round-select"
              value={selectedRound ?? ''}
              onChange={(event) => setSelectedRound(Number(event.target.value))}
              disabled={rounds.length === 0}
            >
              {rounds.length === 0 ? (
                <option value="">Sin rondas</option>
              ) : (
                rounds.map((round) => (
                  <option key={round.id} value={round.round_number}>
                    {round.round_number}
                  </option>
                ))
              )}
            </select>
          </div>
          {selectedRoundData && (
            <p className="round-dates">
              Ronda {selectedRoundData.round_number}: {selectedRoundData.start_date} - {selectedRoundData.end_date}
            </p>
          )}
          {user?.role === 'admin' && (
            <form className="round-create-form" onSubmit={handleCreateRound}>
              <h3>Crear ronda</h3>
              <label>
                Fecha inicio
                <input
                  type="date"
                  value={newRoundStartDate}
                  onChange={(event) => setNewRoundStartDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Fecha fin
                <input
                  type="date"
                  value={newRoundEndDate}
                  onChange={(event) => setNewRoundEndDate(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="secondary-btn">
                Crear ronda
              </button>
            </form>
          )}
        </section>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <h3 className="round-title">Ronda {selectedRound ?? '-'}</h3>

        {selectedRound === null ? (
          <p className="muted">No hay rondas creadas todavía.</p>
        ) : (
          groups.map((group) => {
            const groupMatches = buildGroupMatches(group);

            return (
              <section key={group.name} className="card detail-group-card">
              <h3>{group.name}</h3>
              <div className="detail-table-wrapper">
                <table className="detail-round-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      {group.players.map((playerInfo, idx) => (
                        <th key={`head-player-${idx}`}>{playerInfo.name}</th>
                      ))}
                      <th>PG</th>
                      <th>PP</th>
                      <th>PTS</th>
                      <th>PJ</th>
                      <th>S</th>
                      <th>J</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.players.map((playerInfo, rowIdx) => (
                      <tr key={`row-${group.name}-${rowIdx}`}>
                        <td>{playerInfo.name}</td>
                        {group.players.map((_, colIdx) => (
                          <td key={`cell-${group.name}-${rowIdx}-${colIdx}`}>
                            {rowIdx === colIdx ? '-' : 'Por definir'}
                          </td>
                        ))}
                        <td>0</td>
                        <td>0</td>
                        <td>0</td>
                        <td>0</td>
                        <td>0</td>
                        <td>0</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="results-title">Resultados del grupo</h4>
              {groupMatches.length === 0 ? (
                <p className="muted">No hay suficientes jugadores asignados para registrar partidos.</p>
              ) : (
                <div className="detail-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Jugador A</th>
                        <th>Jugador B</th>
                        <th>Resultado A</th>
                        <th>Resultado B</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMatches.map((match) => {
                        const playerOneId = match.playerOne.id as number;
                        const playerTwoId = match.playerTwo.id as number;
                        const canEdit =
                          user?.role === 'admin' || user?.id === playerOneId || user?.id === playerTwoId;
                        const draft = getDraftForMatch(playerOneId, playerTwoId);

                        return (
                          <tr key={`match-${group.groupNumber}-${playerOneId}-${playerTwoId}`}>
                            <td>{match.playerOne.name}</td>
                            <td>{match.playerTwo.name}</td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={draft.scoreOne}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateDraft(playerOneId, playerTwoId, {
                                    scoreOne: event.target.value,
                                    scoreTwo: draft.scoreTwo
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={draft.scoreTwo}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateDraft(playerOneId, playerTwoId, {
                                    scoreOne: draft.scoreOne,
                                    scoreTwo: event.target.value
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="secondary-btn"
                                disabled={!canEdit}
                                onClick={() => handleSaveMatch(group.groupNumber, playerOneId, playerTwoId)}
                              >
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </section>
            );
          })
        )}

        <p className="muted">
          <Link to="/tournaments">Volver a torneos</Link>
        </p>
      </main>
    </div>
  );
};

