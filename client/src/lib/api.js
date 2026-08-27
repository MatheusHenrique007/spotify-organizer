const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // ignore body parse failure
    }
    throw new ApiError(response.status, message);
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
  getHistoryEntry: (id) => request(`/history/${id}`)
};
