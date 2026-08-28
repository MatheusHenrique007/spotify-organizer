// Pure summary derived only from the playlists array already loaded by the Dashboard —
// no extra request. trackCount comes from the real backend shape (routes/playlists.js).
export function calculateLibrarySummary(playlists) {
  const totalPlaylists = playlists.length;
  const totalTracks = playlists.reduce((sum, playlist) => sum + (playlist.trackCount || 0), 0);
  const emptyPlaylists = playlists.filter((playlist) => (playlist.trackCount || 0) === 0).length;

  return { totalPlaylists, totalTracks, emptyPlaylists };
}
