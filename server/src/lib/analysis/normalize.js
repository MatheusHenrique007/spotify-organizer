const DIACRITICS_PATTERN = /[̀-ͯ]/g;

export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .replace(/\(feat\.?[^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeArtist(artist) {
  return normalizeTitle(artist);
}

export function trackFingerprint(track) {
  const title = normalizeTitle(track.name);
  const artist = normalizeArtist(track.artists?.[0]?.name);
  return `${title}::${artist}`;
}
