import { trackFingerprint } from './normalize.js';

export function findDuplicates(tracks) {
  const byId = new Map();
  const byFingerprint = new Map();

  for (const item of tracks) {
    const track = item.track;
    if (!track || !track.id) continue;

    if (!byId.has(track.id)) byId.set(track.id, []);
    byId.get(track.id).push(item);

    const fingerprint = trackFingerprint(track);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
    byFingerprint.get(fingerprint).push(item);
  }

  const exactDuplicates = [...byId.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([trackId, items]) => ({
      type: 'exact',
      trackId,
      name: items[0].track.name,
      artist: items[0].track.artists?.[0]?.name,
      occurrences: items.map((item) => ({ addedAt: item.added_at, uri: item.track.uri }))
    }));

  const exactIds = new Set(exactDuplicates.map((duplicate) => duplicate.trackId));

  const fuzzyDuplicates = [...byFingerprint.entries()]
    .filter(([, items]) => {
      const uniqueIds = new Set(items.map((item) => item.track.id));
      return uniqueIds.size > 1 && ![...uniqueIds].every((id) => exactIds.has(id));
    })
    .map(([fingerprint, items]) => ({
      type: 'fuzzy',
      fingerprint,
      name: items[0].track.name,
      artist: items[0].track.artists?.[0]?.name,
      occurrences: items.map((item) => ({
        trackId: item.track.id,
        uri: item.track.uri,
        addedAt: item.added_at
      }))
    }));

  return { exactDuplicates, fuzzyDuplicates };
}
