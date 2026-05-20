const API = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Bir hata oluştu' }));
    throw new Error(err.error || 'Bir hata oluştu');
  }
  return res.json();
}

export const api = {
  jobs: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/jobs${q ? '?' + q : ''}`);
    },
    get: (id) => request(`/jobs/${id}`),
    create: (data) => request('/jobs', { method: 'POST', body: data }),
    update: (id, data) => request(`/jobs/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
    addHistory: (id, data) => request(`/jobs/${id}/history`, { method: 'POST', body: data }),
  },
  groups: {
    list: () => request('/groups'),
    create: (data) => request('/groups', { method: 'POST', body: data }),
    update: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  },
  dependencies: {
    list: () => request('/dependencies'),
    create: (data) => request('/dependencies', { method: 'POST', body: data }),
    delete: (id) => request(`/dependencies/${id}`, { method: 'DELETE' }),
  },
  graph: {
    get: () => request('/graph'),
  },
};
