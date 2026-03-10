import { apiFetch } from './apiClient';

export interface Tournament {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  groups_count: number;
  rounds_count: number;
  regulation_pdf_url?: string | null;
}

const normalizeTournament = (item: Tournament): Tournament => ({
  ...item,
  id: Number(item.id),
  participants_count: Number(item.participants_count),
  groups_count: Number(item.groups_count),
  rounds_count: Number(item.rounds_count)
  ,
  regulation_pdf_url: item.regulation_pdf_url ?? null
});

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  return false;
};

const normalizeTournamentAssignedPlayer = (item: TournamentAssignedPlayer): TournamentAssignedPlayer => ({
  ...item,
  tournament_id: Number(item.tournament_id),
  user_id: Number(item.user_id),
  group_number: Number(item.group_number),
  position_index: Number(item.position_index),
  withdrawn_round_number: toNullableNumber(item.withdrawn_round_number)
});

const normalizeTournamentRound = (item: TournamentRound): TournamentRound => ({
  ...item,
  id: Number(item.id),
  tournament_id: Number(item.tournament_id),
  round_number: Number(item.round_number)
});

const normalizeMatchResult = (item: MatchResult): MatchResult => ({
  ...item,
  id: Number(item.id),
  tournament_id: Number(item.tournament_id),
  round_number: Number(item.round_number),
  group_number: Number(item.group_number),
  player_one_id: Number(item.player_one_id),
  player_two_id: Number(item.player_two_id),
  set1_player_one_games: Number(item.set1_player_one_games),
  set1_player_two_games: Number(item.set1_player_two_games),
  set2_player_one_games: Number(item.set2_player_one_games),
  set2_player_two_games: Number(item.set2_player_two_games),
  set3_player_one_games: Number(item.set3_player_one_games),
  set3_player_two_games: Number(item.set3_player_two_games),
  is_walkover: toBoolean(item.is_walkover),
  walkover_player_id: toNullableNumber(item.walkover_player_id)
});

export interface TournamentAssignedPlayer {
  tournament_id: number;
  user_id: number;
  group_number: number;
  position_index: number;
  withdrawn_round_number: number | null;
  name: string;
}

export interface MatchResult {
  id: number;
  tournament_id: number;
  round_number: number;
  group_number: number;
  player_one_id: number;
  player_two_id: number;
  set1_player_one_games: number;
  set1_player_two_games: number;
  set2_player_one_games: number;
  set2_player_two_games: number;
  set3_player_one_games: number;
  set3_player_two_games: number;
  is_walkover: boolean;
  walkover_player_id: number | null;
  player_one_name: string;
  player_two_name: string;
}

export interface TournamentRound {
  id: number;
  tournament_id: number;
  round_number: number;
  start_date: string;
  end_date: string;
}

export async function getTournaments(token?: string | null): Promise<Tournament[]> {
  const response = await apiFetch<{ tournaments: Tournament[] }>('/api/tournaments', {
    method: 'GET',
    token
  });
  return response.tournaments.map(normalizeTournament);
}

export async function getTournamentById(id: number, token?: string | null): Promise<Tournament | null> {
  const tournaments = await getTournaments(token);
  const tournament = tournaments.find((item) => item.id === id);
  return tournament ?? null;
}

export async function getTournamentPlayers(
  tournamentId: number,
  includeWithdrawn = false
): Promise<TournamentAssignedPlayer[]> {
  const query = includeWithdrawn
    ? `/api/tournament-players?tournament_id=${tournamentId}&include_withdrawn=1`
    : `/api/tournament-players?tournament_id=${tournamentId}`;
  const response = await apiFetch<{ players: TournamentAssignedPlayer[] }>(
    query,
    { method: 'GET' }
  );
  return response.players.map(normalizeTournamentAssignedPlayer);
}

export async function getTournamentRounds(tournamentId: number): Promise<TournamentRound[]> {
  const response = await apiFetch<{ rounds: TournamentRound[] }>(
    `/api/tournament-rounds?tournament_id=${tournamentId}`,
    { method: 'GET' }
  );
  return response.rounds.map(normalizeTournamentRound);
}

export async function getMatchResults(tournamentId: number, roundNumber?: number): Promise<MatchResult[]> {
  const query =
    typeof roundNumber === 'number' && roundNumber > 0
      ? `/api/match-results?tournament_id=${tournamentId}&round_number=${roundNumber}`
      : `/api/match-results?tournament_id=${tournamentId}`;
  const response = await apiFetch<{ results: MatchResult[] }>(
    query,
    { method: 'GET' }
  );
  return response.results.map(normalizeMatchResult);
}

export interface SaveMatchResultInput {
  tournament_id: number;
  round_number: number;
  group_number: number;
  player_one_id: number;
  player_two_id: number;
  set1_player_one_games: number;
  set1_player_two_games: number;
  set2_player_one_games: number;
  set2_player_two_games: number;
  set3_player_one_games: number;
  set3_player_two_games: number;
  is_walkover: boolean;
  walkover_player_id: number | null;
}

export async function saveMatchResult(input: SaveMatchResultInput, token: string): Promise<void> {
  await apiFetch<{ message: string }>('/api/match-results', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}

export interface CreateTournamentRoundInput {
  tournament_id: number;
  start_date: string;
  end_date: string;
}

export interface SyncTournamentPlayersInput {
  tournament_id: number;
  players: Array<{
    user_id: number;
    group_number: number;
    position_index: number;
  }>;
}

export async function createTournamentRound(input: CreateTournamentRoundInput, token: string): Promise<TournamentRound> {
  const response = await apiFetch<{ round: TournamentRound }>('/api/admin/tournament-rounds', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
  return normalizeTournamentRound(response.round);
}

export async function syncTournamentPlayers(input: SyncTournamentPlayersInput, token: string): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/tournament-players/sync', {
    method: 'PUT',
    token,
    body: JSON.stringify(input)
  });
}

export async function withdrawTournamentPlayer(
  input: { tournament_id: number; user_id: number; from_round_number: number },
  token: string
): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/tournament-players/withdraw', {
    method: 'PUT',
    token,
    body: JSON.stringify(input)
  });
}

export async function deleteTournamentRound(
  input: { tournament_id: number; round_number: number },
  token: string
): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/tournament-rounds', {
    method: 'DELETE',
    token,
    body: JSON.stringify(input)
  });
}

export async function deleteTournament(id: number, token: string): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/tournaments', {
    method: 'DELETE',
    token,
    body: JSON.stringify({ id })
  });
}

export interface CreateTournamentInput {
  name: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  groups_count: number;
  round_start_date: string;
  round_end_date: string;
}

export async function createTournament(
  input: CreateTournamentInput,
  token: string
): Promise<Tournament> {
  const response = await apiFetch<{ tournament: Tournament }>('/api/admin/tournaments', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
  return normalizeTournament(response.tournament);
}

export interface UpdateTournamentInput {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  groups_count: number;
  rounds_count: number;
}

export async function updateTournament(
  input: UpdateTournamentInput,
  token: string
): Promise<Tournament> {
  const response = await apiFetch<{ tournament: Tournament }>('/api/admin/tournaments', {
    method: 'PUT',
    token,
    body: JSON.stringify(input)
  });
  return normalizeTournament(response.tournament);
}

export async function uploadTournamentRegulation(
  tournamentId: number,
  file: File,
  token: string
): Promise<{ regulation_pdf_url: string }> {
  const form = new FormData();
  form.append('tournament_id', String(tournamentId));
  form.append('regulation_pdf', file);

  return apiFetch<{ regulation_pdf_url: string }>('/api/admin/tournament-regulations', {
    method: 'POST',
    token,
    body: form
  });
}

