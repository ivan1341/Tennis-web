import { apiFetch } from './apiClient';
import type { AuthUser } from '../context/AuthContext';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function loginRequest(phone: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password })
  });
}

export async function registerRequest(
  name: string,
  phone: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, phone, password })
  });
}

export async function getMeRequest(token: string): Promise<AuthUser> {
  const response = await apiFetch<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
    token
  });
  return response.user;
}

