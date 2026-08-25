export function jaccardIndex(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize += 1;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function computePlaylistSimilarity(playlists) {
  const results = [];
  for (let i = 0; i < playlists.length; i += 1) {
    for (let j = i + 1; j < playlists.length; j += 1) {
      const a = playlists[i];
      const b = playlists[j];
      const trackSimilarity = jaccardIndex(a.trackIds, b.trackIds);
      const artistSimilarity = jaccardIndex(a.artistIds, b.artistIds);
      const genreSimilarity = jaccardIndex(a.genres, b.genres);
      const overallScore = trackSimilarity * 0.6 + artistSimilarity * 0.25 + genreSimilarity * 0.15;
      if (overallScore > 0) {
        results.push({
          playlistIdA: a.id,
          playlistIdB: b.id,
          nameA: a.name,
          nameB: b.name,
          trackSimilarity,
          artistSimilarity,
          genreSimilarity,
          overallScore
        });
      }
    }
  }
  return results.sort((x, y) => y.overallScore - x.overallScore);
}

export function buildPlaylistProfile(playlist, tracks, artistGenreMap) {
  const trackIds = new Set();
  const artistIds = new Set();
  const genres = new Set();

  for (const item of tracks) {
    const track = item.track;
    if (!track) continue;
    if (track.id) trackIds.add(track.id);
    for (const artist of track.artists || []) {
      artistIds.add(artist.id);
      for (const genre of artistGenreMap.get(artist.id) || []) {
        genres.add(genre);
      }
    }
  }

  return { id: playlist.id, name: playlist.name, trackIds, artistIds, genres };
}
