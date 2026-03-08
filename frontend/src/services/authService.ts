import { apiFetch } from './apiClient';
import type { AuthUser } from '../context/AuthContext';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const normalizeAuthUser = (user: AuthUser): AuthUser => ({
  ...user,
  id: Number(user.id)
});

const normalizeAuthResponse = (response: AuthResponse): AuthResponse => ({
  ...response,
  user: normalizeAuthUser(response.user)
});

export async function loginRequest(phone: string, password: string): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password })
  });
  return normalizeAuthResponse(response);
}

export async function registerRequest(
  name: string,
  phone: string,
  password: string
): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, phone, password })
  });
  return normalizeAuthResponse(response);
}

export async function getMeRequest(token: string): Promise<AuthUser> {
  const response = await apiFetch<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
    token
  });
  return normalizeAuthUser(response.user);
}

