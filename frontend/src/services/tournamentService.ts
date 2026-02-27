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

