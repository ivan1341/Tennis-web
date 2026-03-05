import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
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

interface PlayerStats {
  pg: number;
  pp: number;
  pts: number;
  pj: number;
  sets: number;
  games: number;
}

interface OrientedMatchResult {
  set1One: number;
  set1Two: number;
  set2One: number;
  set2Two: number;
  set3One: number;
  set3Two: number;
  isWalkover: boolean;
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

const getOrientedResult = (
  results: MatchResult[],
  playerOneId: number,
  playerTwoId: number
): OrientedMatchResult | null => {
  const existing = results.find((result) => getPairKey(result.player_one_id, result.player_two_id) === getPairKey(playerOneId, playerTwoId));
  if (!existing) return null;

  if (existing.player_one_id === playerOneId) {
    return {
      set1One: existing.set1_player_one_games,
      set1Two: existing.set1_player_two_games,
      set2One: existing.set2_player_one_games,
      set2Two: existing.set2_player_two_games,
      set3One: existing.set3_player_one_games,
      set3Two: existing.set3_player_two_games,
      isWalkover: Boolean(existing.is_walkover)
    };
  }

  return {
    set1One: existing.set1_player_two_games,
    set1Two: existing.set1_player_one_games,
    set2One: existing.set2_player_two_games,
    set2Two: existing.set2_player_one_games,
    set3One: existing.set3_player_two_games,
    set3Two: existing.set3_player_one_games,
    isWalkover: Boolean(existing.is_walkover)
  };
};

const summarizeMatch = (result: OrientedMatchResult): { setsOne: number; setsTwo: number; gamesOne: number; gamesTwo: number } => {
  const pairs: Array<[number, number]> = [
    [result.set1One, result.set1Two],
    [result.set2One, result.set2Two],
    [result.set3One, result.set3Two]
  ];

  let setsOne = 0;
  let setsTwo = 0;
  let gamesOne = 0;
  let gamesTwo = 0;

  pairs.forEach(([one, two]) => {
    gamesOne += one;
    gamesTwo += two;
    if (one > two) setsOne += 1;
    if (two > one) setsTwo += 1;
  });

  return { setsOne, setsTwo, gamesOne, gamesTwo };
};

const hasDraftChanges = (
  draft: {
    set1One: string;
    set1Two: string;
    set2One: string;
    set2Two: string;
    set3One: string;
    set3Two: string;
    isWalkover: boolean;
  },
  existing: OrientedMatchResult | null
): boolean => {
  if (!existing) {
    return (
      draft.set1One.trim() !== '' ||
      draft.set1Two.trim() !== '' ||
      draft.set2One.trim() !== '' ||
      draft.set2Two.trim() !== '' ||
      draft.set3One.trim() !== '' ||
      draft.set3Two.trim() !== '' ||
      draft.isWalkover
    );
  }

  const normalize = (value: string): string => (value.trim() === '' ? '0' : value.trim());
  return (
    normalize(draft.set1One) !== String(existing.set1One) ||
    normalize(draft.set1Two) !== String(existing.set1Two) ||
    normalize(draft.set2One) !== String(existing.set2One) ||
    normalize(draft.set2Two) !== String(existing.set2Two) ||
    normalize(draft.set3One) !== String(existing.set3One) ||
    normalize(draft.set3Two) !== String(existing.set3Two) ||
    draft.isWalkover !== existing.isWalkover
  );
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
  const [resultDrafts, setResultDrafts] = useState<
    Record<
      string,
      {
        set1One: string;
        set1Two: string;
        set2One: string;
        set2Two: string;
        set3One: string;
        set3Two: string;
        isWalkover: boolean;
      }
    >
  >({});

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

  const getDraftForMatch = (
    playerOneId: number,
    playerTwoId: number
  ): {
    set1One: string;
    set1Two: string;
    set2One: string;
    set2Two: string;
    set3One: string;
    set3Two: string;
    isWalkover: boolean;
  } => {
    const key = getPairKey(playerOneId, playerTwoId);
    if (resultDrafts[key]) return resultDrafts[key];

    const existing = getOrientedResult(matchResults, playerOneId, playerTwoId);
    if (!existing) return { set1One: '', set1Two: '', set2One: '', set2Two: '', set3One: '', set3Two: '', isWalkover: false };

    return {
      set1One: String(existing.set1One),
      set1Two: String(existing.set1Two),
      set2One: String(existing.set2One),
      set2Two: String(existing.set2Two),
      set3One: String(existing.set3One),
      set3Two: String(existing.set3Two),
      isWalkover: existing.isWalkover
    };
  };

  const updateDraft = (
    playerOneId: number,
    playerTwoId: number,
    next: {
      set1One: string;
      set1Two: string;
      set2One: string;
      set2Two: string;
      set3One: string;
      set3Two: string;
      isWalkover: boolean;
    }
  ) => {
    const key = getPairKey(playerOneId, playerTwoId);
    setResultDrafts((prev) => ({ ...prev, [key]: next }));
  };

  const handleSaveMatch = async (groupNumber: number, playerOneId: number, playerTwoId: number) => {
    if (!token || !tournament || selectedRound === null) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    const draft = getDraftForMatch(playerOneId, playerTwoId);
    const parsedSet1One = Number(draft.set1One);
    const parsedSet1Two = Number(draft.set1Two);
    const parsedSet2One = Number(draft.set2One);
    const parsedSet2Two = Number(draft.set2Two);
    const parsedSet3One = Number(draft.set3One);
    const parsedSet3Two = Number(draft.set3Two);
    if (
      draft.set1One.trim() === '' ||
      draft.set1Two.trim() === '' ||
      draft.set2One.trim() === '' ||
      draft.set2Two.trim() === '' ||
      Number.isNaN(parsedSet1One) ||
      Number.isNaN(parsedSet1Two) ||
      Number.isNaN(parsedSet2One) ||
      Number.isNaN(parsedSet2Two) ||
      (draft.set3One.trim() !== '' && Number.isNaN(parsedSet3One)) ||
      (draft.set3Two.trim() !== '' && Number.isNaN(parsedSet3Two))
    ) {
      setError('Debes ingresar Set 1 y Set 2. Set 3 es opcional.');
      return;
    }
    const normalizedSet3One = draft.set3One.trim() === '' ? 0 : parsedSet3One;
    const normalizedSet3Two = draft.set3Two.trim() === '' ? 0 : parsedSet3Two;
    if (
      parsedSet1One < 0 ||
      parsedSet1Two < 0 ||
      parsedSet2One < 0 ||
      parsedSet2Two < 0 ||
      normalizedSet3One < 0 ||
      normalizedSet3Two < 0
    ) {
      setError('Los sets no pueden ser negativos');
      return;
    }
    if (parsedSet1One === parsedSet1Two || parsedSet2One === parsedSet2Two) {
      setError('Set 1 y Set 2 deben tener ganador.');
      return;
    }
    const setPairs: Array<[number, number]> = [
      [parsedSet1One, parsedSet1Two],
      [parsedSet2One, parsedSet2Two],
      [normalizedSet3One, normalizedSet3Two]
    ];
    const hasInvalidTie = setPairs.some(([one, two]) => one === two && one !== 0);
    if (hasInvalidTie) {
      setError('Cada set debe tener ganador (o 0/0 si no se jugó).');
      return;
    }
    const summary = summarizeMatch({
      set1One: parsedSet1One,
      set1Two: parsedSet1Two,
      set2One: parsedSet2One,
      set2Two: parsedSet2Two,
      set3One: normalizedSet3One,
      set3Two: normalizedSet3Two,
      isWalkover: draft.isWalkover
    });
    if (summary.setsOne === summary.setsTwo) {
      setError('Debe existir un ganador en sets');
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
          set1_player_one_games: parsedSet1One,
          set1_player_two_games: parsedSet1Two,
          set2_player_one_games: parsedSet2One,
          set2_player_two_games: parsedSet2Two,
          set3_player_one_games: normalizedSet3One,
          set3_player_two_games: normalizedSet3Two,
          is_walkover: draft.isWalkover
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const isSelectedRoundClosed = selectedRoundData !== null && selectedRoundData.end_date < todayIso;

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
        </section>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <h3 className="round-title">Ronda {selectedRound ?? '-'}</h3>
        <p className="muted">
          PG: ganados, PP: perdidos, PTS: 3 por victoria y 1 por derrota (W.O. deja 0 al perdedor, NR resta 1 al cerrar ronda), PJ: jugados, S: sets, J: juegos.
        </p>

        {selectedRound === null ? (
          <p className="muted">No hay rondas creadas todavía.</p>
        ) : (
          groups.map((group) => {
            const groupMatches = buildGroupMatches(group);
            const statsByPlayer = new Map<number, PlayerStats>();

            group.players.forEach((player) => {
              if (player.id !== null) {
                statsByPlayer.set(player.id, { pg: 0, pp: 0, pts: 0, pj: 0, sets: 0, games: 0 });
              }
            });

            groupMatches.forEach((match) => {
              const playerOneId = match.playerOne.id as number;
              const playerTwoId = match.playerTwo.id as number;
              const result = getOrientedResult(matchResults, playerOneId, playerTwoId);
              const playerOneStats = statsByPlayer.get(playerOneId);
              const playerTwoStats = statsByPlayer.get(playerTwoId);
              if (!playerOneStats || !playerTwoStats) return;

              if (!result) {
                if (isSelectedRoundClosed) {
                  playerOneStats.pts -= 1;
                  playerTwoStats.pts -= 1;
                }
                return;
              }

              playerOneStats.pj += 1;
              playerTwoStats.pj += 1;
              const summary = summarizeMatch(result);
              playerOneStats.sets += summary.setsOne;
              playerTwoStats.sets += summary.setsTwo;
              playerOneStats.games += summary.gamesOne;
              playerTwoStats.games += summary.gamesTwo;

              if (summary.setsOne > summary.setsTwo) {
                playerOneStats.pg += 1;
                playerTwoStats.pp += 1;
                playerOneStats.pts += 3;
                playerTwoStats.pts += result.isWalkover ? 0 : 1;
              } else {
                playerTwoStats.pg += 1;
                playerOneStats.pp += 1;
                playerTwoStats.pts += 3;
                playerOneStats.pts += result.isWalkover ? 0 : 1;
              }
            });

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
                        {group.players.map((opponentInfo, colIdx) => {
                          if (rowIdx === colIdx) {
                            return <td key={`cell-${group.name}-${rowIdx}-${colIdx}`}>-</td>;
                          }
                          if (playerInfo.id === null || opponentInfo.id === null) {
                            return <td key={`cell-${group.name}-${rowIdx}-${colIdx}`}>Por definir</td>;
                          }

                          const versus = getOrientedResult(matchResults, playerInfo.id, opponentInfo.id);
                          return (
                            <td key={`cell-${group.name}-${rowIdx}-${colIdx}`}>
                              {versus
                                ? `${versus.set1One}/${versus.set1Two} ${versus.set2One}/${versus.set2Two}${
                                    versus.set3One !== 0 || versus.set3Two !== 0 ? ` [${versus.set3One} : ${versus.set3Two}]` : ''
                                  }${versus.isWalkover ? ' (W.O.)' : ''}`
                                : 'NR'}
                            </td>
                          );
                        })}
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.pg ?? 0) : '-'}</td>
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.pp ?? 0) : '-'}</td>
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.pts ?? 0) : '-'}</td>
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.pj ?? 0) : '-'}</td>
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.sets ?? 0) : '-'}</td>
                        <td>{playerInfo.id !== null ? (statsByPlayer.get(playerInfo.id)?.games ?? 0) : '-'}</td>
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
                        <th>Set 1</th>
                        <th>Set 2</th>
                        <th>Set 3</th>
                        <th>W.O.</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMatches.map((match) => {
                        const playerOneId = match.playerOne.id as number;
                        const playerTwoId = match.playerTwo.id as number;
                        const existing = getOrientedResult(matchResults, playerOneId, playerTwoId);
                        const canEdit =
                          user?.role === 'admin' ||
                          (existing === null && (user?.id === playerOneId || user?.id === playerTwoId));
                        const draft = getDraftForMatch(playerOneId, playerTwoId);
                        const hasChanges = hasDraftChanges(draft, existing);
                        const actionLabel = existing !== null && user?.role !== 'admin' ? 'Enviado' : 'Guardar';

                        return (
                          <tr key={`match-${group.groupNumber}-${playerOneId}-${playerTwoId}`}>
                            <td>{match.playerOne.name}</td>
                            <td>{match.playerTwo.name}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set1One}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: event.target.value,
                                      set1Two: draft.set1Two,
                                      set2One: draft.set2One,
                                      set2Two: draft.set2Two,
                                      set3One: draft.set3One,
                                      set3Two: draft.set3Two,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set1Two}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: draft.set1One,
                                      set1Two: event.target.value,
                                      set2One: draft.set2One,
                                      set2Two: draft.set2Two,
                                      set3One: draft.set3One,
                                      set3Two: draft.set3Two,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set2One}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: draft.set1One,
                                      set1Two: draft.set1Two,
                                      set2One: event.target.value,
                                      set2Two: draft.set2Two,
                                      set3One: draft.set3One,
                                      set3Two: draft.set3Two,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set2Two}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: draft.set1One,
                                      set1Two: draft.set1Two,
                                      set2One: draft.set2One,
                                      set2Two: event.target.value,
                                      set3One: draft.set3One,
                                      set3Two: draft.set3Two,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set3One}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: draft.set1One,
                                      set1Two: draft.set1Two,
                                      set2One: draft.set2One,
                                      set2Two: draft.set2Two,
                                      set3One: event.target.value,
                                      set3Two: draft.set3Two,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.set3Two}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    updateDraft(playerOneId, playerTwoId, {
                                      set1One: draft.set1One,
                                      set1Two: draft.set1Two,
                                      set2One: draft.set2One,
                                      set2Two: draft.set2Two,
                                      set3One: draft.set3One,
                                      set3Two: event.target.value,
                                      isWalkover: draft.isWalkover
                                    })
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={draft.isWalkover}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateDraft(playerOneId, playerTwoId, {
                                    set1One: draft.set1One,
                                    set1Two: draft.set1Two,
                                    set2One: draft.set2One,
                                    set2Two: draft.set2Two,
                                    set3One: draft.set3One,
                                    set3Two: draft.set3Two,
                                    isWalkover: event.target.checked
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="secondary-btn"
                                disabled={!canEdit || !hasChanges}
                                onClick={() => handleSaveMatch(group.groupNumber, playerOneId, playerTwoId)}
                              >
                                {actionLabel}
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

