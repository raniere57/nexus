import type { Checker, Service, Server, CheckerResult, ServiceSnapshot } from '../types';

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let payload: any;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inesperada do servidor (status ${res.status})`);
  }

  // If the response is not OK, try to extract a useful error message
  if (!res.ok) {
    // Elysia validation errors (TypeBox schema failures)
    if (payload.type === 'validation') {
      const summary = payload.summary || payload.message || 'Erro de validação';
      throw new Error(summary);
    }

    // Our custom API envelope errors { success: false, error, message }
    if (payload.message) {
      throw new Error(payload.message);
    }
    if (payload.error && typeof payload.error === 'string') {
      throw new Error(payload.error);
    }

    throw new Error(`Erro do servidor (status ${res.status})`);
  }

  // Success path: handle both envelope { success, data } and raw responses
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success) {
      throw new Error(payload.message || payload.error || 'Request failed');
    }
    return payload.data;
  }

  // If backend returns raw data (no envelope), return as-is
  return payload as T;
}

export const servicesApi = {
  getAll: () => fetch('/api/services').then(res => handleResponse<Service[]>(res)),
  getById: (id: string) => fetch(`/api/services/${id}`).then(res => handleResponse<Service>(res)),
  create: (data: Partial<Service>) => fetch('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Service>(res)),
  update: (id: string, data: Partial<Service>) => fetch(`/api/services/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Service>(res)),
  delete: (id: string) => fetch(`/api/services/${id}`, {
    method: 'DELETE'
  }).then(res => handleResponse<{ success: boolean }>(res))
};

export const checkersApi = {
  getByServiceId: (serviceId: string) => fetch(`/api/services/${serviceId}/checkers`).then(res => handleResponse<Checker[]>(res)),
  create: (serviceId: string, data: Partial<Checker>) => fetch(`/api/services/${serviceId}/checkers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Checker>(res)),
  update: (id: string, data: Partial<Checker>) => fetch(`/api/checkers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Checker>(res)),
  delete: (id: string) => fetch(`/api/checkers/${id}`, {
    method: 'DELETE'
  }).then(res => handleResponse<{ success: boolean }>(res))
};

export const monitoringApi = {
  getServiceStatus: () => fetch('/api/status').then(res => handleResponse<ServiceSnapshot[]>(res)),
  getTvStatus: () => fetch('/api/status/tv').then(res => handleResponse<any[]>(res)),
  getResults: (serviceId?: string, limit = 50) => {
    const url = serviceId ? `/api/results?serviceId=${serviceId}&limit=${limit}` : `/api/results?limit=${limit}`;
    return fetch(url).then(res => handleResponse<CheckerResult[]>(res));
  }
};

export const serversApi = {
  getAll: () => fetch('/api/servers').then(res => handleResponse<Server[]>(res)),
  getStatus: () => fetch('/api/servers/status').then(res => handleResponse<any[]>(res)),
  getById: (id: string) => fetch(`/api/servers/${id}`).then(res => handleResponse<Server>(res)),
  create: (data: Partial<Server>) => fetch('/api/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Server>(res)),
  update: (id: string, data: Partial<Server>) => fetch(`/api/servers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => handleResponse<Server>(res)),
  delete: (id: string) => fetch(`/api/servers/${id}`, {
    method: 'DELETE'
  }).then(res => handleResponse<{ success: boolean }>(res))
};

