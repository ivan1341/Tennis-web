import { apiFetch } from './apiClient';

export interface AdminUser {
  id: number;
  name: string;
  phone: string;
  role: 'admin' | 'user';
}

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
  return response.users;
}

export async function createAdminUser(input: CreateAdminUserInput, token: string): Promise<AdminUser> {
  return apiFetch<AdminUser>('/api/admin/users', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}

export async function updateAdminUser(input: UpdateAdminUserInput, token: string): Promise<AdminUser> {
  return apiFetch<AdminUser>('/api/admin/users', {
    method: 'PUT',
    token,
    body: JSON.stringify(input)
  });
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

