import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMatchResults,
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  saveMatchResult,
  uploadTournamentRegulation,
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

interface RankedPlayer {
  id: number;
  name: string;
  stats: PlayerStats;
}

interface OrientedMatchResult {
  set1One: number;
  set1Two: number;
  set2One: number;
  set2Two: number;
  set3One: number;
  set3Two: number;
  isWalkover: boolean;
  walkoverPlayerId: number | null;
}

const getPairKey = (playerOneId: number, playerTwoId: number): string => {
  const a = Math.min(playerOneId, playerTwoId);
  const b = Math.max(playerOneId, playerTwoId);
  return `${a}-${b}`;
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

const buildGroupsForSelectedRound = (
  tournament: Tournament,
  assignedPlayers: TournamentAssignedPlayer[],
  rounds: TournamentRound[],
  selectedRoundData: TournamentRound | null,
  allMatchResults: MatchResult[]
): GroupData[] => {
  const groupsCount = Math.max(1, tournament.groups_count || 1);
  const usersById = new Map<number, string>();
  assignedPlayers.forEach((player) => usersById.set(player.user_id, player.name));
  const withdrawnByUserId = new Map<number, number | null>();
  assignedPlayers.forEach((player) => withdrawnByUserId.set(player.user_id, player.withdrawn_round_number ?? null));
  const isActiveForRound = (userId: number, roundNumber: number): boolean => {
    const withdrawnRound = withdrawnByUserId.get(userId) ?? null;
    return withdrawnRound === null || withdrawnRound > roundNumber;
  };

  const baseAssignments = new Map<number, number[]>();
  for (let group = 1; group <= groupsCount; group += 1) {
    baseAssignments.set(group, []);
  }
  assignedPlayers.forEach((player) => {
    if (player.group_number >= 1 && player.group_number <= groupsCount) {
      baseAssignments.get(player.group_number)?.push(player.user_id);
    }
  });

  const firstGroupNumber = 1;
  const lastGroupNumber = groupsCount;
  const priorRounds = selectedRoundData
    ? rounds
        .filter((round) => round.round_number < selectedRoundData.round_number && round.end_date < selectedRoundData.start_date)
        .sort((a, b) => a.round_number - b.round_number)
    : [];

  let currentAssignments = new Map<number, number[]>();
  baseAssignments.forEach((value, key) => currentAssignments.set(key, [...value]));

  priorRounds.forEach((round) => {
    const upByGroup = new Map<number, number[]>();
    const downByGroup = new Map<number, number[]>();

    for (let groupNumber = 1; groupNumber <= groupsCount; groupNumber += 1) {
      const ids = (currentAssignments.get(groupNumber) ?? []).filter((id) => isActiveForRound(id, round.round_number));
      const groupPlayers: GroupPlayer[] = ids.map((id) => ({ id, name: usersById.get(id) ?? `Jugador ${id}` }));
      const statsByPlayer = new Map<number, PlayerStats>();
      ids.forEach((id) => statsByPlayer.set(id, { pg: 0, pp: 0, pts: 0, pj: 0, sets: 0, games: 0 }));

      const roundGroupResults = allMatchResults.filter(
        (result) => result.round_number === round.round_number && result.group_number === groupNumber
      );
      const groupMatches = buildGroupMatches({ groupNumber, name: `Grupo ${groupNumber}`, players: groupPlayers });

      groupMatches.forEach((match) => {
        const playerOneId = match.playerOne.id as number;
        const playerTwoId = match.playerTwo.id as number;
        const playerOneStats = statsByPlayer.get(playerOneId);
        const playerTwoStats = statsByPlayer.get(playerTwoId);
        if (!playerOneStats || !playerTwoStats) return;

        const result = getOrientedResult(roundGroupResults, playerOneId, playerTwoId);
        if (!result) {
          playerOneStats.pts -= 1;
          playerTwoStats.pts -= 1;
          return;
        }

        const summary = summarizeMatch(result);
        playerOneStats.pj += 1;
        playerTwoStats.pj += 1;
        playerOneStats.sets += summary.setsOne;
        playerTwoStats.sets += summary.setsTwo;
        playerOneStats.games += summary.gamesOne;
        playerTwoStats.games += summary.gamesTwo;

        if (summary.setsOne > summary.setsTwo) {
          playerOneStats.pg += 1;
          playerTwoStats.pp += 1;
          playerOneStats.pts += 3;
          playerTwoStats.pts += result.walkoverPlayerId === playerTwoId ? 0 : 1;
        } else {
          playerTwoStats.pg += 1;
          playerOneStats.pp += 1;
          playerTwoStats.pts += 3;
          playerOneStats.pts += result.walkoverPlayerId === playerOneId ? 0 : 1;
        }
      });

      const rankedPlayers: RankedPlayer[] = ids
        .map((id) => ({ id, name: usersById.get(id) ?? `Jugador ${id}`, stats: statsByPlayer.get(id)! }))
        .sort((a, b) => compareRankedPlayers(a, b, roundGroupResults));

      const topTwo = rankedPlayers.slice(0, 2).map((item) => item.id);
      const bottomTwo = rankedPlayers.slice(Math.max(0, rankedPlayers.length - 2)).map((item) => item.id);

      upByGroup.set(groupNumber, groupNumber === firstGroupNumber ? [] : topTwo);
      downByGroup.set(groupNumber, groupNumber === lastGroupNumber ? [] : bottomTwo);
    }

    const nextAssignments = new Map<number, number[]>();
    for (let groupNumber = 1; groupNumber <= groupsCount; groupNumber += 1) {
      const current = (currentAssignments.get(groupNumber) ?? []).filter((id) => isActiveForRound(id, round.round_number));
      const leavingUp = new Set(upByGroup.get(groupNumber) ?? []);
      const leavingDown = new Set(downByGroup.get(groupNumber) ?? []);
      const staying = current.filter((id) => !leavingUp.has(id) && !leavingDown.has(id));
      const incomingFromAbove = groupNumber > 1 ? downByGroup.get(groupNumber - 1) ?? [] : [];
      const incomingFromBelow = groupNumber < groupsCount ? upByGroup.get(groupNumber + 1) ?? [] : [];
      nextAssignments.set(groupNumber, [...incomingFromAbove, ...staying, ...incomingFromBelow]);
    }

    currentAssignments = nextAssignments;
  });

  const maxAssignedInGroup = Array.from(currentAssignments.values()).reduce((max, players) => Math.max(max, players.length), 0);
  const playersPerGroup = Math.max(
    2,
    maxAssignedInGroup,
    Math.min(5, Math.ceil((tournament.participants_count || groupsCount * 2) / groupsCount))
  );

  return Array.from({ length: groupsCount }, (_, groupIndex) => {
    const groupNumber = groupIndex + 1;
    const selectedRoundNumber = selectedRoundData?.round_number ?? Number.MAX_SAFE_INTEGER;
    const ids = (currentAssignments.get(groupNumber) ?? []).filter((id) => isActiveForRound(id, selectedRoundNumber));
    const players: GroupPlayer[] = ids.map((id) => ({ id, name: usersById.get(id) ?? `Jugador ${id}` }));
    const placeholders = Array.from({ length: Math.max(0, playersPerGroup - players.length) }, () => ({
      id: null,
      name: 'Por definir'
    }));
    return {
      groupNumber,
      name: `Grupo ${groupNumber}`,
      players: [...players, ...placeholders]
    };
  });
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
      isWalkover: Boolean(existing.is_walkover),
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
    isWalkover: Boolean(existing.is_walkover),
    walkoverPlayerId: existing.walkover_player_id
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
    isWalkoverPlayerOne: boolean;
    isWalkoverPlayerTwo: boolean;
  },
  existing: OrientedMatchResult | null,
  playerOneId: number,
  playerTwoId: number
): boolean => {
  const walkoverPlayerId = draft.isWalkoverPlayerOne ? 1 : draft.isWalkoverPlayerTwo ? 2 : 0;
  if (!existing) {
    return (
      draft.set1One.trim() !== '' ||
      draft.set1Two.trim() !== '' ||
      draft.set2One.trim() !== '' ||
      draft.set2Two.trim() !== '' ||
      draft.set3One.trim() !== '' ||
      draft.set3Two.trim() !== '' ||
      walkoverPlayerId !== 0
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
    walkoverPlayerId !== (existing.walkoverPlayerId === null ? 0 : existing.walkoverPlayerId === playerOneId ? 1 : 2)
  );
};

const compareRankedPlayers = (
  a: RankedPlayer,
  b: RankedPlayer,
  matchResults: MatchResult[]
): number => {
  if (b.stats.pts !== a.stats.pts) return b.stats.pts - a.stats.pts;

  const direct = getOrientedResult(matchResults, a.id, b.id);
  if (direct) {
    const summary = summarizeMatch(direct);
    if (summary.setsOne !== summary.setsTwo) {
      return summary.setsTwo - summary.setsOne;
    }
  }

  if (b.stats.sets !== a.stats.sets) return b.stats.sets - a.stats.sets;
  if (b.stats.games !== a.stats.games) return b.stats.games - a.stats.games;
  return a.name.localeCompare(b.name, 'es');
};

const getMovementLabel = (rank: number, groupNumber: number, firstGroup: number, lastGroup: number): string => {
  const isTopTwo = rank <= 2;
  const isBottomTwo = rank >= 4;

  if (groupNumber === firstGroup) {
    if (isBottomTwo) return 'Baja';
    return '-';
  }

  if (groupNumber === lastGroup) {
    if (isTopTwo) return 'Sube';
    return '-';
  }

  if (isTopTwo) return 'Sube';
  if (isBottomTwo) return 'Baja';
  return '-';
};

export const TournamentDetailViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { user, token } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [assignedPlayers, setAssignedPlayers] = useState<TournamentAssignedPlayer[]>([]);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [allMatchResults, setAllMatchResults] = useState<MatchResult[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [uploadingRegulation, setUploadingRegulation] = useState(false);
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
        isWalkoverPlayerOne: boolean;
        isWalkoverPlayerTwo: boolean;
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
          getTournamentById(tournamentId, token),
          getTournamentPlayers(tournamentId, true)
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
  }, [tournamentId, token]);

  useEffect(() => {
    const loadResults = async () => {
      if (!tournament) {
        setAllMatchResults([]);
        setMatchResults([]);
        return;
      }
      try {
        const results = await getMatchResults(tournament.id);
        setAllMatchResults(results);
      } catch (err) {
        setModalError((err as Error).message);
      }
    };

    void loadResults();
  }, [tournament]);

  useEffect(() => {
    if (selectedRound === null) {
      setMatchResults([]);
      return;
    }
    setMatchResults(allMatchResults.filter((result) => result.round_number === selectedRound));
  }, [allMatchResults, selectedRound]);

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
    isWalkoverPlayerOne: boolean;
    isWalkoverPlayerTwo: boolean;
  } => {
    const key = getPairKey(playerOneId, playerTwoId);
    if (resultDrafts[key]) return resultDrafts[key];

    const existing = getOrientedResult(matchResults, playerOneId, playerTwoId);
    if (!existing) {
      return {
        set1One: '',
        set1Two: '',
        set2One: '',
        set2Two: '',
        set3One: '',
        set3Two: '',
        isWalkoverPlayerOne: false,
        isWalkoverPlayerTwo: false
      };
    }

    const walkoverPlayerOne = existing.walkoverPlayerId === playerOneId;
    const walkoverPlayerTwo = existing.walkoverPlayerId === playerTwoId;

    return {
      set1One: String(existing.set1One),
      set1Two: String(existing.set1Two),
      set2One: existing.set2One === 0 && existing.set2Two === 0 ? '' : String(existing.set2One),
      set2Two: existing.set2One === 0 && existing.set2Two === 0 ? '' : String(existing.set2Two),
      set3One: existing.set3One === 0 && existing.set3Two === 0 ? '' : String(existing.set3One),
      set3Two: existing.set3One === 0 && existing.set3Two === 0 ? '' : String(existing.set3Two),
      isWalkoverPlayerOne: walkoverPlayerOne,
      isWalkoverPlayerTwo: walkoverPlayerTwo
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
      isWalkoverPlayerOne: boolean;
      isWalkoverPlayerTwo: boolean;
    }
  ) => {
    const key = getPairKey(playerOneId, playerTwoId);
    setResultDrafts((prev) => ({ ...prev, [key]: next }));
  };

  const handleSaveMatch = async (groupNumber: number, playerOneId: number, playerTwoId: number) => {
    if (!token || !tournament || selectedRound === null) {
      setModalError('Sesión inválida. Inicia sesión nuevamente.');
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
      Number.isNaN(parsedSet1One) ||
      Number.isNaN(parsedSet1Two) ||
      (draft.set2One.trim() !== '' && Number.isNaN(parsedSet2One)) ||
      (draft.set2Two.trim() !== '' && Number.isNaN(parsedSet2Two)) ||
      (draft.set3One.trim() !== '' && Number.isNaN(parsedSet3One)) ||
      (draft.set3Two.trim() !== '' && Number.isNaN(parsedSet3Two))
    ) {
      setModalError('Debes ingresar Set 1. Set 2 y Set 3 son opcionales.');
      return;
    }
    const isSet2Partial = (draft.set2One.trim() === '') !== (draft.set2Two.trim() === '');
    const isSet3Partial = (draft.set3One.trim() === '') !== (draft.set3Two.trim() === '');
    if (isSet2Partial || isSet3Partial) {
      setModalError('Si capturas Set 2 o Set 3, debes ingresar ambos lados del set.');
      return;
    }
    if (draft.isWalkoverPlayerOne && draft.isWalkoverPlayerTwo) {
      setModalError('Solo un jugador puede marcarse como W.O.');
      return;
    }
    const isWalkover = draft.isWalkoverPlayerOne || draft.isWalkoverPlayerTwo;
    const walkoverPlayerId = draft.isWalkoverPlayerOne ? playerOneId : draft.isWalkoverPlayerTwo ? playerTwoId : null;
    const normalizedSet2One = draft.set2One.trim() === '' ? 0 : parsedSet2One;
    const normalizedSet2Two = draft.set2Two.trim() === '' ? 0 : parsedSet2Two;
    const normalizedSet3One = draft.set3One.trim() === '' ? 0 : parsedSet3One;
    const normalizedSet3Two = draft.set3Two.trim() === '' ? 0 : parsedSet3Two;
    if (
      parsedSet1One < 0 ||
      parsedSet1Two < 0 ||
      normalizedSet2One < 0 ||
      normalizedSet2Two < 0 ||
      normalizedSet3One < 0 ||
      normalizedSet3Two < 0
    ) {
      setModalError('Los sets no pueden ser negativos');
      return;
    }
    if (parsedSet1One === parsedSet1Two) {
      setModalError('Set 1 debe tener ganador.');
      return;
    }
    const setPairs: Array<[number, number]> = [
      [parsedSet1One, parsedSet1Two],
      [normalizedSet2One, normalizedSet2Two],
      [normalizedSet3One, normalizedSet3Two]
    ];
    const hasInvalidTie = setPairs.some(([one, two]) => one === two && one !== 0);
    if (hasInvalidTie) {
      setModalError('Cada set debe tener ganador (o 0/0 si no se jugó).');
      return;
    }
    const summary = summarizeMatch({
      set1One: parsedSet1One,
      set1Two: parsedSet1Two,
      set2One: normalizedSet2One,
      set2Two: normalizedSet2Two,
      set3One: normalizedSet3One,
      set3Two: normalizedSet3Two,
      isWalkover: isWalkover,
      walkoverPlayerId: walkoverPlayerId
    });
    if (summary.setsOne === summary.setsTwo) {
      setModalError('Debe existir un ganador en sets');
      return;
    }

    setModalError(null);
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
          set2_player_one_games: normalizedSet2One,
          set2_player_two_games: normalizedSet2Two,
          set3_player_one_games: normalizedSet3One,
          set3_player_two_games: normalizedSet3Two,
          is_walkover: isWalkover,
          walkover_player_id: walkoverPlayerId
        },
        token
      );

      const refreshed = await getMatchResults(tournament.id);
      setAllMatchResults(refreshed);
      setSuccess('Resultado guardado correctamente');
    } catch (err) {
      setModalError((err as Error).message);
    }
  };

  const handleRegulationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!token || !tournament) {
      setModalError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setModalError('Solo se permiten archivos PDF.');
      event.target.value = '';
      return;
    }

    setUploadingRegulation(true);
    setSuccess(null);
    setModalError(null);
    try {
      const result = await uploadTournamentRegulation(tournament.id, file, token);
      setTournament((prev) => (prev ? { ...prev, regulation_pdf_url: result.regulation_pdf_url } : prev));
      setSuccess('Reglamento actualizado correctamente.');
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setUploadingRegulation(false);
      event.target.value = '';
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

  const selectedRoundData = rounds.find((round) => round.round_number === selectedRound) ?? null;
  const groups = buildGroupsForSelectedRound(tournament, assignedPlayers, rounds, selectedRoundData, allMatchResults);
  const todayIso = new Date().toISOString().slice(0, 10);
  const isSelectedRoundClosed = selectedRoundData !== null && selectedRoundData.end_date < todayIso;
  const groupNumbers = groups.map((group) => group.groupNumber);
  const firstGroupNumber = Math.min(...groupNumbers);
  const lastGroupNumber = Math.max(...groupNumbers);

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
          <div className="tournament-regulation-section">
            <h4>Reglamento del torneo</h4>
            {tournament.regulation_pdf_url ? (
              <p>
                <a href={tournament.regulation_pdf_url} target="_blank" rel="noreferrer">
                  Ver reglamento PDF
                </a>
              </p>
            ) : (
              <p className="muted">Aún no hay reglamento cargado.</p>
            )}
            {user?.role === 'admin' && (
              <label className="file-upload-label">
                Subir o reemplazar PDF
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploadingRegulation}
                  onChange={handleRegulationUpload}
                />
              </label>
            )}
          </div>
        </section>

        {success && <p className="success-text">{success}</p>}

        <h3 className="round-title">Ronda {selectedRound ?? '-'}</h3>
        <p className="muted-gray">
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
                playerTwoStats.pts += result.walkoverPlayerId === playerTwoId ? 0 : 1;
              } else {
                playerTwoStats.pg += 1;
                playerOneStats.pp += 1;
                playerTwoStats.pts += 3;
                playerOneStats.pts += result.walkoverPlayerId === playerOneId ? 0 : 1;
              }
            });

            const rankedPlayers = Array.from(statsByPlayer.entries())
              .map(([id, stats]) => ({
                id,
                name: group.players.find((p) => p.id === id)?.name ?? `Jugador ${id}`,
                stats
              }))
              .sort((a, b) => compareRankedPlayers(a, b, matchResults));

            const movementByPlayerId = new Map<number, string>();
            rankedPlayers.forEach((player, index) => {
              const rank = index + 1;
              movementByPlayerId.set(
                player.id,
                getMovementLabel(rank, group.groupNumber, firstGroupNumber, lastGroupNumber)
              );
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
                      <th>Mov.</th>
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
                                ? `${versus.set1One}/${versus.set1Two}${
                                    versus.set2One !== 0 || versus.set2Two !== 0 ? ` ${versus.set2One}/${versus.set2Two}` : ''
                                  }${
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
                        <td>{playerInfo.id !== null ? (movementByPlayerId.get(playerInfo.id) ?? '-') : '-'}</td>
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
                      {groupMatches
                        .filter((match) => {
                          if (user?.role === 'admin') return true;
                          const playerOneId = match.playerOne.id as number;
                          const playerTwoId = match.playerTwo.id as number;
                          return user?.id === playerOneId || user?.id === playerTwoId;
                        })
                        .map((match) => {
                        const playerOneId = match.playerOne.id as number;
                        const playerTwoId = match.playerTwo.id as number;
                        const existing = getOrientedResult(matchResults, playerOneId, playerTwoId);
                        const canEdit =
                          user?.role === 'admin' ||
                          (existing === null && (user?.id === playerOneId || user?.id === playerTwoId));
                        const draft = getDraftForMatch(playerOneId, playerTwoId);
                        const hasChanges = hasDraftChanges(draft, existing, playerOneId, playerTwoId);
                        const actionLabel = existing !== null && user?.role !== 'admin' ? 'Enviado' : 'Guardar';
                        const isPlayerView = user?.role !== 'admin' && (user?.id === playerOneId || user?.id === playerTwoId);
                        const isSwappedForPlayer = isPlayerView && user?.id === playerTwoId;

                        const displayNameOne = isSwappedForPlayer ? match.playerTwo.name : match.playerOne.name;
                        const displayNameTwo = isSwappedForPlayer ? match.playerOne.name : match.playerTwo.name;

                        const displaySet1One = isSwappedForPlayer ? draft.set1Two : draft.set1One;
                        const displaySet1Two = isSwappedForPlayer ? draft.set1One : draft.set1Two;
                        const displaySet2One = isSwappedForPlayer ? draft.set2Two : draft.set2One;
                        const displaySet2Two = isSwappedForPlayer ? draft.set2One : draft.set2Two;
                        const displaySet3One = isSwappedForPlayer ? draft.set3Two : draft.set3One;
                        const displaySet3Two = isSwappedForPlayer ? draft.set3One : draft.set3Two;

                        const displayWalkoverOne = isSwappedForPlayer ? draft.isWalkoverPlayerTwo : draft.isWalkoverPlayerOne;
                        const displayWalkoverTwo = isSwappedForPlayer ? draft.isWalkoverPlayerOne : draft.isWalkoverPlayerTwo;
                        const isWalkoverChecked = draft.isWalkoverPlayerOne || draft.isWalkoverPlayerTwo;

                        const setDisplayDraft = (
                          next: Partial<{
                            set1One: string;
                            set1Two: string;
                            set2One: string;
                            set2Two: string;
                            set3One: string;
                            set3Two: string;
                            isWalkoverPlayerOne: boolean;
                            isWalkoverPlayerTwo: boolean;
                          }>
                        ) => {
                          const merged = {
                            set1One: displaySet1One,
                            set1Two: displaySet1Two,
                            set2One: displaySet2One,
                            set2Two: displaySet2Two,
                            set3One: displaySet3One,
                            set3Two: displaySet3Two,
                            isWalkoverPlayerOne: displayWalkoverOne,
                            isWalkoverPlayerTwo: displayWalkoverTwo,
                            ...next
                          };

                          if (isSwappedForPlayer) {
                            updateDraft(playerOneId, playerTwoId, {
                              set1One: merged.set1Two,
                              set1Two: merged.set1One,
                              set2One: merged.set2Two,
                              set2Two: merged.set2One,
                              set3One: merged.set3Two,
                              set3Two: merged.set3One,
                              isWalkoverPlayerOne: merged.isWalkoverPlayerTwo,
                              isWalkoverPlayerTwo: merged.isWalkoverPlayerOne
                            });
                          } else {
                            updateDraft(playerOneId, playerTwoId, {
                              set1One: merged.set1One,
                              set1Two: merged.set1Two,
                              set2One: merged.set2One,
                              set2Two: merged.set2Two,
                              set3One: merged.set3One,
                              set3Two: merged.set3Two,
                              isWalkoverPlayerOne: merged.isWalkoverPlayerOne,
                              isWalkoverPlayerTwo: merged.isWalkoverPlayerTwo
                            });
                          }
                        };

                        const applyWalkover = (markFirst: boolean) => {
                          if (markFirst) {
                            setDisplayDraft({
                              set1One: '0',
                              set1Two: '6',
                              set2One: '0',
                              set2Two: '6',
                              set3One: '',
                              set3Two: '',
                              isWalkoverPlayerOne: true,
                              isWalkoverPlayerTwo: false
                            });
                          } else {
                            setDisplayDraft({
                              set1One: '6',
                              set1Two: '0',
                              set2One: '6',
                              set2Two: '0',
                              set3One: '',
                              set3Two: '',
                              isWalkoverPlayerOne: false,
                              isWalkoverPlayerTwo: true
                            });
                          }
                        };

                        return (
                          <tr key={`match-${group.groupNumber}-${playerOneId}-${playerTwoId}`}>
                            <td>{displayNameOne}</td>
                            <td>{displayNameTwo}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet1One}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set1One: event.target.value })}
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet1Two}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set1Two: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet2One}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set2One: event.target.value })}
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet2Two}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set2Two: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet3One}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set3One: event.target.value })}
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={displaySet3Two}
                                  disabled={!canEdit || isWalkoverChecked}
                                  onChange={(event) => setDisplayDraft({ set3Two: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={displayWalkoverOne}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    event.target.checked
                                      ? applyWalkover(true)
                                      : setDisplayDraft({
                                          isWalkoverPlayerOne: false,
                                          isWalkoverPlayerTwo: false
                                        })
                                  }
                                />
                                <span>/</span>
                                <input
                                  type="checkbox"
                                  checked={displayWalkoverTwo}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    event.target.checked
                                      ? applyWalkover(false)
                                      : setDisplayDraft({
                                          isWalkoverPlayerOne: false,
                                          isWalkoverPlayerTwo: false
                                        })
                                  }
                                />
                              </div>
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

      {modalError && (
        <div className="modal-overlay" onClick={() => setModalError(null)}>
          <div className="modal-card card" onClick={(event) => event.stopPropagation()}>
            <h3>Error</h3>
            <p className="error-text">{modalError}</p>
            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={() => setModalError(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

