// Smart API layer: Tauri (local SQLite) vs Web (REST API)

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let _tauriApi = null;

async function getTauriApi() {
  if (!_tauriApi) {
    const mod = await import('./api-tauri.js');
    _tauriApi = mod.api;
  }
  return _tauriApi;
}

// ─── Web (REST) API ───────────────────────────────────────────────
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

const webApi = {
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
  sessions: {
    list: () => request('/sessions'),
    create: (data) => request('/sessions', { method: 'POST', body: data }),
    update: (id, data) => request(`/sessions/${id}`, { method: 'PUT', body: data }),
    resume: (id) => request(`/sessions/${id}/resume`, { method: 'PUT' }),
    delete: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  },
  logs: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/logs${q ? '?' + q : ''}`);
    },
    persons: () => request('/logs/persons'),
  },
  comments: {
    list: (jobId) => request(`/jobs/${jobId}/comments`),
    create: (jobId, data) => request(`/jobs/${jobId}/comments`, { method: 'POST', body: data }),
    delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
  },
  backup: {
    export: () => request('/backup/export'),
    import: (data) => request('/backup/import', { method: 'POST', body: data }),
  },
  users: {
    list: () => request('/users'),
    get: (id) => request(`/users/${id}`),
    create: (data) => request('/users', { method: 'POST', body: data }),
    update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
    login: (data) => request('/users/login', { method: 'POST', body: data }),
    changePassword: (id, password_hash) => request(`/users/${id}/password`, { method: 'PUT', body: { password_hash } }),
  },
};

// ─── Unified proxy: auto-detect Tauri vs Web ─────────────────────
function createProxy(target) {
  return new Proxy(target, {
    get(obj, prop) {
      if (typeof obj[prop] === 'object' && obj[prop] !== null) {
        // Nested object (jobs, groups, etc.) — wrap each method
        const section = prop;
        return new Proxy(obj[prop], {
          get(sectionObj, method) {
            if (typeof sectionObj[method] === 'function') {
              return async (...args) => {
                if (isTauri) {
                  const tauriApi = await getTauriApi();
                  return tauriApi[section][method](...args);
                }
                return sectionObj[method](...args);
              };
            }
            return sectionObj[method];
          }
        });
      }
      return obj[prop];
    }
  });
}

export const api = createProxy(webApi);

// Export mode info for UI
export const isDesktopMode = isTauri;
