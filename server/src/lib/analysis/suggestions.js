function topEntries(counter, limit) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function buildRenameSuggestion(playlist, tracks, artistGenreMap) {
  const artistCounts = new Map();
  const genreCounts = new Map();

  for (const item of tracks) {
    const track = item.track;
    if (!track) continue;
    for (const artist of track.artists || []) {
      artistCounts.set(artist.name, (artistCounts.get(artist.name) || 0) + 1);
      for (const genre of artistGenreMap.get(artist.id) || []) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }
  }

  const topArtists = topEntries(artistCounts, 3);
  const topGenres = topEntries(genreCounts, 3);

  if (topArtists.length === 0) return null;

  const genrePart = topGenres.length ? ` (${topGenres.join(', ')})` : '';
  const suggestedName = `${topArtists.join(' & ')}${genrePart}`.slice(0, 100);
  const suggestedDescription = topGenres.length
    ? `A mix featuring ${topArtists.join(', ')} — genres: ${topGenres.join(', ')}.`
    : `A mix featuring ${topArtists.join(', ')}.`;

  return {
    playlistId: playlist.id,
    currentName: playlist.name,
    suggestedName,
    suggestedDescription,
    topArtists,
    topGenres
  };
}

export function buildMergeCandidates(similarityResults, threshold = 0.5) {
  return similarityResults
    .filter((result) => result.overallScore >= threshold)
    .map((result) => ({
      playlistIdA: result.playlistIdA,
      playlistIdB: result.playlistIdB,
      nameA: result.nameA,
      nameB: result.nameB,
      overallScore: result.overallScore,
      reason: `${Math.round(result.overallScore * 100)}% similarity (tracks, artists, genres)`
    }));
}
