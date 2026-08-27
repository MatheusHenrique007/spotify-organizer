import { trackFingerprint } from './normalize.js';

export function findDuplicates(tracks) {
  const byId = new Map();
  const byFingerprint = new Map();

  for (const entry of tracks) {
    const track = entry.item;
    if (!track || !track.id) continue;

    if (!byId.has(track.id)) byId.set(track.id, []);
    byId.get(track.id).push(entry);

    const fingerprint = trackFingerprint(track);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
    byFingerprint.get(fingerprint).push(entry);
  }

  const exactDuplicates = [...byId.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([trackId, entries]) => ({
      type: 'exact',
      trackId,
      name: entries[0].item.name,
      artist: entries[0].item.artists?.[0]?.name,
      occurrences: entries.map((entry) => ({ addedAt: entry.added_at, uri: entry.item.uri }))
    }));

  const exactIds = new Set(exactDuplicates.map((duplicate) => duplicate.trackId));

  const fuzzyDuplicates = [...byFingerprint.entries()]
    .filter(([, entries]) => {
      const uniqueIds = new Set(entries.map((entry) => entry.item.id));
      return uniqueIds.size > 1 && ![...uniqueIds].every((id) => exactIds.has(id));
    })
    .map(([fingerprint, entries]) => ({
      type: 'fuzzy',
      fingerprint,
      name: entries[0].item.name,
      artist: entries[0].item.artists?.[0]?.name,
      occurrences: entries.map((entry) => ({
        trackId: entry.item.id,
        uri: entry.item.uri,
        addedAt: entry.added_at
      }))
    }));

  return { exactDuplicates, fuzzyDuplicates };
}
