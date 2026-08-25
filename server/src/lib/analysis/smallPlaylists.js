const DEFAULT_MIN_TRACKS = 3;
const DEFAULT_STALE_DAYS = 180;

export function findSmallOrAbandonedPlaylists(playlists, tracksByPlaylistId, options = {}) {
  const minTracks = options.minTracks ?? DEFAULT_MIN_TRACKS;
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const now = options.now ?? Date.now();

  return playlists
    .map((playlist) => {
      const tracks = tracksByPlaylistId.get(playlist.id) || [];
      const isSmall = tracks.length < minTracks;

      const addedDates = tracks
        .map((item) => item.added_at)
        .filter(Boolean)
        .map((date) => new Date(date).getTime());
      const mostRecentAddedAt = addedDates.length ? Math.max(...addedDates) : null;
      const daysSinceLastAdd = mostRecentAddedAt
        ? Math.floor((now - mostRecentAddedAt) / (1000 * 60 * 60 * 24))
        : null;
      const isStale = daysSinceLastAdd !== null && daysSinceLastAdd > staleDays;

      return {
        playlistId: playlist.id,
        name: playlist.name,
        trackCount: tracks.length,
        isSmall,
        isStale,
        daysSinceLastAdd,
        flagged: isSmall || isStale
      };
    })
    .filter((result) => result.flagged);
}
