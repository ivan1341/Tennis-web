import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createTournamentRound,
  deleteTournament,
  deleteTournamentRound,
  getMatchResults,
  getTournamentPlayers,
  getTournamentRounds,
  getTournaments,
  syncTournamentPlayers,
  withdrawTournamentPlayer,
  updateTournament,
  type MatchResult,
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

interface GroupPlayerView {
  id: number;
  name: string;
}

interface PlayerStats {
  pg: number;
  pp: number;
  pts: number;
  sets: number;
  games: number;
}

const getPairKey = (playerOneId: number, playerTwoId: number): string => {
  const a = Math.min(playerOneId, playerTwoId);
  const b = Math.max(playerOneId, playerTwoId);
  return `${a}-${b}`;
};

const getOrientedResult = (
  results: MatchResult[],
  playerOneId: number,
  playerTwoId: number
): {
  set1One: number;
  set1Two: number;
  set2One: number;
  set2Two: number;
  set3One: number;
  set3Two: number;
  walkoverPlayerId: number | null;
} | null => {
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
      walkoverPlayerId: existing.walkover_player_id
    };
  }
  return {
    set1One: existing.set1_player_two_games,
    set1Two: existing.set1_player_one_games,
    set2One: existing.set2_player_two_games,
    set2Two: existing.set2_player_one_games,
    set3One: existing.set3_player_two_games,
    set3Two: existing.set3_player_one_games,
    walkoverPlayerId: existing.walkover_player_id
  };
};

const summarizeMatch = (result: {
  set1One: number;
  set1Two: number;
  set2One: number;
  set2Two: number;
  set3One: number;
  set3Two: number;
}): { setsOne: number; setsTwo: number; gamesOne: number; gamesTwo: number } => {
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

const compareRankedPlayers = (
  a: { id: number; name: string; stats: PlayerStats },
  b: { id: number; name: string; stats: PlayerStats },
  groupResults: MatchResult[]
): number => {
  if (b.stats.pts !== a.stats.pts) return b.stats.pts - a.stats.pts;
  const direct = getOrientedResult(groupResults, a.id, b.id);
  if (direct) {
    const summary = summarizeMatch(direct);
    if (summary.setsOne !== summary.setsTwo) return summary.setsTwo - summary.setsOne;
  }
  if (b.stats.sets !== a.stats.sets) return b.stats.sets - a.stats.sets;
  if (b.stats.games !== a.stats.games) return b.stats.games - a.stats.games;
  return a.name.localeCompare(b.name, 'es');
};

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
  const [allPlayers, setAllPlayers] = useState<TournamentAssignedPlayer[]>([]);
  const [allMatchResults, setAllMatchResults] = useState<MatchResult[]>([]);
  const [selectedHistoryRound, setSelectedHistoryRound] = useState<number | null>(null);
  const [playersByGroup, setPlayersByGroup] = useState<Record<number, BoardPlayer[]>>({});
  const [savingPlayers, setSavingPlayers] = useState(false);
  const [playersDirty, setPlayersDirty] = useState(false);
  const [dragging, setDragging] = useState<{ fromGroup: number; fromIndex: number } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ groupNumber: number; index: number } | null>(null);
  const [newRoundStartDate, setNewRoundStartDate] = useState('');
  const [newRoundEndDate, setNewRoundEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [deletingRound, setDeletingRound] = useState<number | null>(null);
  const [deletingTournament, setDeletingTournament] = useState(false);
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
        const tournaments = await getTournaments(token);
        const current = tournaments.find((item) => item.id === tournamentId);

        if (!current) {
          setError('No se encontró el torneo');
          return;
        }

        const [roundsData, assignedPlayers, matchResults] = await Promise.all([
          getTournamentRounds(current.id),
          getTournamentPlayers(current.id, true),
          getMatchResults(current.id)
        ]);

        setName(current.name);
        setStartDate(current.start_date);
        setEndDate(current.end_date);
        setParticipantsCount(current.participants_count);
        setRoundsCount(current.rounds_count);
        setRounds(roundsData);
        setSelectedHistoryRound(roundsData.length > 0 ? roundsData[0].round_number : null);
        setAllPlayers(assignedPlayers);
        setAllMatchResults(matchResults);
        const activePlayers = assignedPlayers.filter((item) => item.withdrawn_round_number === null);
        setPlayersByGroup(buildBoardFromAssignments(activePlayers, current.groups_count));
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
  }, [tournamentId, token]);

  const groupsCount = useMemo(() => Math.max(1, Math.ceil(participantsCount / 5)), [participantsCount]);

  const historyGroups = useMemo(() => {
    if (selectedHistoryRound === null) return [] as Array<{ groupNumber: number; players: GroupPlayerView[] }>;
    const usersById = new Map<number, string>();
    allPlayers.forEach((player) => usersById.set(player.user_id, player.name));

    const initialAssignments = new Map<number, number[]>();
    for (let group = 1; group <= groupsCount; group += 1) initialAssignments.set(group, []);
    allPlayers.forEach((player) => {
      if (player.group_number >= 1 && player.group_number <= groupsCount) {
        initialAssignments.get(player.group_number)?.push(player.user_id);
      }
    });

    let currentAssignments = new Map<number, number[]>();
    initialAssignments.forEach((ids, group) => currentAssignments.set(group, [...ids]));

    const isActiveInRound = (playerId: number, roundNumber: number): boolean => {
      const player = allPlayers.find((item) => item.user_id === playerId);
      const withdrawn = player?.withdrawn_round_number ?? null;
      return withdrawn === null || withdrawn > roundNumber;
    };

    const previousRounds = rounds
      .filter((round) => round.round_number < selectedHistoryRound)
      .sort((a, b) => a.round_number - b.round_number);

    previousRounds.forEach((round) => {
      const upByGroup = new Map<number, number[]>();
      const downByGroup = new Map<number, number[]>();

      for (let group = 1; group <= groupsCount; group += 1) {
        const ids = (currentAssignments.get(group) ?? []).filter((id) => isActiveInRound(id, round.round_number));
        const statsByPlayer = new Map<number, PlayerStats>();
        ids.forEach((id) => statsByPlayer.set(id, { pg: 0, pp: 0, pts: 0, sets: 0, games: 0 }));
        const groupResults = allMatchResults.filter(
          (result) => result.round_number === round.round_number && result.group_number === group
        );

        for (let i = 0; i < ids.length; i += 1) {
          for (let j = i + 1; j < ids.length; j += 1) {
            const one = ids[i];
            const two = ids[j];
            const oneStats = statsByPlayer.get(one);
            const twoStats = statsByPlayer.get(two);
            if (!oneStats || !twoStats) continue;
            const result = getOrientedResult(groupResults, one, two);
            if (!result) {
              oneStats.pts -= 1;
              twoStats.pts -= 1;
              continue;
            }
            const summary = summarizeMatch(result);
            oneStats.sets += summary.setsOne;
            twoStats.sets += summary.setsTwo;
            oneStats.games += summary.gamesOne;
            twoStats.games += summary.gamesTwo;
            if (summary.setsOne > summary.setsTwo) {
              oneStats.pg += 1;
              twoStats.pp += 1;
              oneStats.pts += 3;
              twoStats.pts += result.walkoverPlayerId === two ? 0 : 1;
            } else {
              twoStats.pg += 1;
              oneStats.pp += 1;
              twoStats.pts += 3;
              oneStats.pts += result.walkoverPlayerId === one ? 0 : 1;
            }
          }
        }

        const ranking = ids
          .map((id) => ({ id, name: usersById.get(id) ?? `Jugador ${id}`, stats: statsByPlayer.get(id)! }))
          .sort((a, b) => compareRankedPlayers(a, b, groupResults));

        const topTwo = ranking.slice(0, 2).map((item) => item.id);
        const bottomTwo = ranking.slice(Math.max(0, ranking.length - 2)).map((item) => item.id);
        upByGroup.set(group, group === 1 ? [] : topTwo);
        downByGroup.set(group, group === groupsCount ? [] : bottomTwo);
      }

      const nextAssignments = new Map<number, number[]>();
      for (let group = 1; group <= groupsCount; group += 1) {
        const current = (currentAssignments.get(group) ?? []).filter((id) => isActiveInRound(id, round.round_number));
        const leavingUp = new Set(upByGroup.get(group) ?? []);
        const leavingDown = new Set(downByGroup.get(group) ?? []);
        const staying = current.filter((id) => !leavingUp.has(id) && !leavingDown.has(id));
        const incomingFromAbove = group > 1 ? downByGroup.get(group - 1) ?? [] : [];
        const incomingFromBelow = group < groupsCount ? upByGroup.get(group + 1) ?? [] : [];
        nextAssignments.set(group, [...incomingFromAbove, ...staying, ...incomingFromBelow]);
      }
      currentAssignments = nextAssignments;
    });

    return Array.from({ length: groupsCount }, (_, idx) => {
      const groupNumber = idx + 1;
      const ids = (currentAssignments.get(groupNumber) ?? []).filter((id) => isActiveInRound(id, selectedHistoryRound));
      return {
        groupNumber,
        players: ids.map((id) => ({ id, name: usersById.get(id) ?? `Jugador ${id}` }))
      };
    });
  }, [selectedHistoryRound, allPlayers, allMatchResults, rounds, groupsCount]);

  useEffect(() => {
    if (selectedHistoryRound === null || playersDirty) return;
    const board: Record<number, BoardPlayer[]> = {};
    for (let group = 1; group <= groupsCount; group += 1) {
      board[group] = [];
    }
    historyGroups.forEach((group) => {
      board[group.groupNumber] = group.players.map((player) => ({
        user_id: player.id,
        name: player.name
      }));
    });
    setPlayersByGroup(board);
  }, [selectedHistoryRound, historyGroups, groupsCount, playersDirty]);

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
      setSuccess(
        selectedHistoryRound !== null
          ? `Distribución guardada para la ronda ${selectedHistoryRound}.`
          : 'Participantes reordenados correctamente.'
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPlayers(false);
    }
  };

  const handleChangeHistoryRound = (nextRound: number | null) => {
    if (playersDirty) {
      const confirmed = window.confirm(
        'Tienes cambios sin guardar en la ronda actual. Si cambias de ronda, se perderán. ¿Deseas continuar?'
      );
      if (!confirmed) return;
      setPlayersDirty(false);
      setPendingRemove(null);
    }
    setSelectedHistoryRound(nextRound);
  };

  const reloadActivePlayers = async () => {
    const [assignedPlayers, matchResults] = await Promise.all([
      getTournamentPlayers(tournamentId, true),
      getMatchResults(tournamentId)
    ]);
    setAllPlayers(assignedPlayers);
    setAllMatchResults(matchResults);
    const activePlayers = assignedPlayers.filter((item) => item.withdrawn_round_number === null);
    setPlayersByGroup(buildBoardFromAssignments(activePlayers, groupsCount));
    setPlayersDirty(false);
    setPendingRemove(null);
  };

  const handleWithdrawPlayer = async (player: GroupPlayerView) => {
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }
    if (selectedHistoryRound === null) {
      setError('Selecciona una ronda para dar de baja.');
      return;
    }
    if (playersDirty) {
      const continueAction = window.confirm(
        'Tienes cambios de distribución sin guardar. Si continúas, se recargará la lista actual. ¿Deseas continuar?'
      );
      if (!continueAction) return;
    }
    if (!window.confirm(`¿Dar de baja a ${player.name} desde la ronda ${selectedHistoryRound}?`)) {
      return;
    }
    const existsRound = rounds.some((round) => round.round_number === selectedHistoryRound);
    if (!existsRound) {
      setError('La ronda seleccionada ya no existe.');
      return;
    }

    try {
      await withdrawTournamentPlayer(
        {
          tournament_id: tournamentId,
          user_id: player.id,
          from_round_number: selectedHistoryRound
        },
        token
      );
      await reloadActivePlayers();
      setSuccess(`Participante dado de baja desde la ronda ${selectedHistoryRound}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteRound = async (roundNumber: number) => {
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }
    if (!window.confirm(`¿Eliminar la ronda ${roundNumber}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingRound(roundNumber);
    try {
      await deleteTournamentRound({ tournament_id: tournamentId, round_number: roundNumber }, token);
      const refreshedRounds = await getTournamentRounds(tournamentId);
      setRounds(refreshedRounds);
      setRoundsCount(refreshedRounds.length);
      setSelectedHistoryRound((prev) => {
        if (refreshedRounds.length === 0) return null;
        const stillExists = prev !== null && refreshedRounds.some((round) => round.round_number === prev);
        return stillExists ? prev : refreshedRounds[0].round_number;
      });
      await reloadActivePlayers();
      setSuccess(`Ronda ${roundNumber} eliminada correctamente.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingRound(null);
    }
  };

  const handleDeleteTournament = async () => {
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }
    if (!window.confirm(`¿Eliminar el torneo "${name}" completo? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingTournament(true);
    try {
      await deleteTournament(tournamentId, token);
      navigate('/tournaments');
    } catch (err) {
      setError((err as Error).message);
      setDeletingTournament(false);
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
      setSelectedHistoryRound((prev) => prev ?? createdRound.round_number);
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
                  {rounds.map((round) => {
                    const isLastRound = round.round_number === Math.max(...rounds.map((item) => item.round_number));
                    return (
                      <li key={round.id} className="edit-round-item">
                        <span>
                          Ronda {round.round_number}: {round.start_date} - {round.end_date}
                        </span>
                        {isLastRound && (
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={deletingRound !== null}
                            onClick={() => void handleDeleteRound(round.round_number)}
                          >
                            {deletingRound === round.round_number ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="muted">Solo se puede eliminar la última ronda.</p>
            </div>

            <div className="round-create-form">
              <h3>Participantes inscritos (drag and drop)</h3>
              <p className="muted">La distribución manual se edita por ronda: selecciona ronda, arrastra jugadoras y guarda.</p>

              <label>
                Ver posiciones de la ronda
                <select
                  value={selectedHistoryRound ?? ''}
                  onChange={(event) =>
                    handleChangeHistoryRound(event.target.value === '' ? null : Number(event.target.value))
                  }
                  disabled={rounds.length === 0}
                >
                  {rounds.length === 0 ? (
                    <option value="">Sin rondas</option>
                  ) : (
                    rounds.map((round) => (
                      <option key={round.id} value={round.round_number}>
                        Ronda {round.round_number}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedHistoryRound !== null && (
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
                        <h4>Grupo {groupNumber} (Ronda {selectedHistoryRound})</h4>
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
                                  <div className="edit-item-actions">
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      onClick={() => setPendingRemove({ groupNumber, index })}
                                    >
                                      Baja del torneo
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      onClick={() => void handleWithdrawPlayer({ id: player.user_id, name: player.name })}
                                    >
                                      Baja de la ronda
                                    </button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void handleSavePlayers()}
                disabled={!playersDirty || savingPlayers || selectedHistoryRound === null}
              >
                {savingPlayers ? 'Guardando participantes...' : 'Guardar distribución de participantes'}
              </button>
            </div>

            <div className="round-create-form">
              <h3>Eliminar torneo</h3>
              <button
                type="button"
                className="secondary-btn"
                disabled={deletingTournament}
                onClick={() => void handleDeleteTournament()}
              >
                {deletingTournament ? 'Eliminando torneo...' : 'Eliminar torneo'}
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

