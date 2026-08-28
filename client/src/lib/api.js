const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body || null;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });

  if (!response.ok) {
    let message = response.statusText;
    let body = null;
    try {
      body = await response.json();
      message = body.message || message;
    } catch {
      // ignore body parse failure
    }
    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  authStatus: () => request('/auth/status'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/me'),
  getPlaylists: () => request('/playlists'),
  getPlaylistTracks: (id) => request(`/playlists/${id}/tracks`),
  getAnalysis: () => request('/analysis'),
  buildPlan: (body) => request('/plans/build', { method: 'POST', body: JSON.stringify(body) }),
  executePlan: (body) => request('/plans/execute', { method: 'POST', body: JSON.stringify(body) }),
  getHistory: () => request('/history'),
  getHistoryEntry: (id) => request(`/history/${id}`),
  getSpicetifyStatus: () => request('/spicetify/status'),
  saveSpicetifyTheme: (body) => request('/spicetify/theme', { method: 'POST', body: JSON.stringify(body) }),
  applySpicetifyTheme: (body = {}) => request('/spicetify/apply', { method: 'POST', body: JSON.stringify(body) }),
  restoreSpicetify: (body = {}) => request('/spicetify/restore', { method: 'POST', body: JSON.stringify(body) }),
  backupSpicetify: (body = {}) => request('/spicetify/backup', { method: 'POST', body: JSON.stringify(body) })
};
