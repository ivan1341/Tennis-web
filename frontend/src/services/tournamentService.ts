import { apiFetch } from './apiClient';

export interface Tournament {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  groups_count: number;
  rounds_count: number;
}

export interface TournamentAssignedPlayer {
  tournament_id: number;
  user_id: number;
  group_number: number;
  name: string;
}

export interface MatchResult {
  id: number;
  tournament_id: number;
  round_number: number;
  group_number: number;
  player_one_id: number;
  player_two_id: number;
  player_one_score: number;
  player_two_score: number;
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

export async function getTournaments(): Promise<Tournament[]> {
  const response = await apiFetch<{ tournaments: Tournament[] }>('/api/tournaments', {
    method: 'GET'
  });
  return response.tournaments;
}

export async function getTournamentById(id: number): Promise<Tournament | null> {
  const tournaments = await getTournaments();
  const tournament = tournaments.find((item) => item.id === id);
  return tournament ?? null;
}

export async function getTournamentPlayers(tournamentId: number): Promise<TournamentAssignedPlayer[]> {
  const response = await apiFetch<{ players: TournamentAssignedPlayer[] }>(
    `/api/tournament-players?tournament_id=${tournamentId}`,
    { method: 'GET' }
  );
  return response.players;
}

export async function getTournamentRounds(tournamentId: number): Promise<TournamentRound[]> {
  const response = await apiFetch<{ rounds: TournamentRound[] }>(
    `/api/tournament-rounds?tournament_id=${tournamentId}`,
    { method: 'GET' }
  );
  return response.rounds;
}

export async function getMatchResults(tournamentId: number, roundNumber: number): Promise<MatchResult[]> {
  const response = await apiFetch<{ results: MatchResult[] }>(
    `/api/match-results?tournament_id=${tournamentId}&round_number=${roundNumber}`,
    { method: 'GET' }
  );
  return response.results;
}

export interface SaveMatchResultInput {
  tournament_id: number;
  round_number: number;
  group_number: number;
  player_one_id: number;
  player_two_id: number;
  player_one_score: number;
  player_two_score: number;
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

export async function createTournamentRound(input: CreateTournamentRoundInput, token: string): Promise<TournamentRound> {
  const response = await apiFetch<{ round: TournamentRound }>('/api/admin/tournament-rounds', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
  return response.round;
}

export interface CreateTournamentInput {
  name: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  groups_count: number;
  rounds_count: number;
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
  return response.tournament;
}

export interface UpdateTournamentInput extends CreateTournamentInput {
  id: number;
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
  return response.tournament;
}

