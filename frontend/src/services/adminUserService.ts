import { apiFetch } from './apiClient';

export interface AdminUser {
  id: number;
  name: string;
  phone: string;
  role: 'admin' | 'user';
}

const normalizeAdminUser = (user: AdminUser): AdminUser => ({
  ...user,
  id: Number(user.id)
});

export interface CreateAdminUserInput {
  name: string;
  phone: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UpdateAdminUserInput {
  id: number;
  name: string;
  phone: string;
  role: 'admin' | 'user';
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const response = await apiFetch<{ users: AdminUser[] }>('/api/admin/users', {
    method: 'GET',
    token
  });
  return response.users.map(normalizeAdminUser);
}

export async function createAdminUser(input: CreateAdminUserInput, token: string): Promise<AdminUser> {
  const response = await apiFetch<AdminUser>('/api/admin/users', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
  return normalizeAdminUser(response);
}

export async function updateAdminUser(input: UpdateAdminUserInput, token: string): Promise<AdminUser> {
  const response = await apiFetch<AdminUser>('/api/admin/users', {
    method: 'PUT',
    token,
    body: JSON.stringify(input)
  });
  return normalizeAdminUser(response);
}

export async function resetUserPassword(
  userId: number,
  password: string,
  token: string
): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/users/password', {
    method: 'PUT',
    token,
    body: JSON.stringify({ user_id: userId, password })
  });
}

export async function assignUserToTournaments(
  userId: number,
  tournamentIds: number[],
  groupNumber: number,
  token: string
): Promise<void> {
  await apiFetch<{ message: string }>('/api/admin/tournament-players', {
    method: 'POST',
    token,
    body: JSON.stringify({
      user_id: userId,
      tournament_ids: tournamentIds,
      group_number: groupNumber
    })
  });
}

