import { apiFetch } from './apiClient';

export interface ContactSettings {
  contact_email: string;
}

export async function getContactSettings(): Promise<ContactSettings> {
  return apiFetch<ContactSettings>('/api/settings/contact', { method: 'GET' });
}

export async function updateContactSettings(contactEmail: string, token: string): Promise<ContactSettings> {
  return apiFetch<ContactSettings>('/api/admin/settings/contact', {
    method: 'PUT',
    token,
    body: JSON.stringify({ contact_email: contactEmail })
  });
}

