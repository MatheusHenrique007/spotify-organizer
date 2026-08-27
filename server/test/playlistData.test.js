import { describe, it, expect, vi, beforeEach } from 'vitest';

const { spotifyFetch, SpotifyApiError } = vi.hoisted(() => {
  class SpotifyApiError extends Error {
    constructor(status, message) {
      super(message);
      this.name = 'SpotifyApiError';
      this.status = status;
    }
  }
  return { spotifyFetch: vi.fn(), SpotifyApiError };
});

const { getCachedGenres, setCachedGenres } = vi.hoisted(() => ({
  getCachedGenres: vi.fn(),
  setCachedGenres: vi.fn()
}));

vi.mock('../src/lib/spotifyClient.js', () => ({
  spotifyFetch,
  spotifyFetchAllPages: vi.fn(),
  SpotifyApiError
}));

vi.mock('../src/lib/genreCache.js', () => ({ getCachedGenres, setCachedGenres }));

import { getArtistGenreMap } from '../src/lib/playlistData.js';

beforeEach(() => {
  spotifyFetch.mockReset();
  getCachedGenres.mockReset();
  setCachedGenres.mockReset();
});

describe('getArtistGenreMap', () => {
  it('uses the cached genres and does not call Spotify when the artist is already cached', async () => {
    getCachedGenres.mockReturnValue(['rock']);
    const { genreMap, failedArtistIds } = await getArtistGenreMap(['artist-1']);

    expect(genreMap.get('artist-1')).toEqual(['rock']);
    expect(spotifyFetch).not.toHaveBeenCalled();
    expect(failedArtistIds).toEqual([]);
  });

  it('fetches from Spotify when the artist is not cached', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockResolvedValue({ id: 'artist-1', genres: ['pop'] });

    const { genreMap } = await getArtistGenreMap(['artist-1']);

    expect(spotifyFetch).toHaveBeenCalledWith('/artists/artist-1');
    expect(genreMap.get('artist-1')).toEqual(['pop']);
  });

  it('stores the freshly fetched genres in the cache', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockResolvedValue({ id: 'artist-1', genres: ['pop'] });

    await getArtistGenreMap(['artist-1']);

    expect(setCachedGenres).toHaveBeenCalledWith('artist-1', ['pop']);
  });

  it('only queries each unique artist once, even if it appears multiple times', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockResolvedValue({ id: 'artist-1', genres: ['pop'] });

    await getArtistGenreMap(['artist-1', 'artist-1', 'artist-1']);

    expect(spotifyFetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Spotify fails for one artist (e.g. 429) and reports it as failed', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockRejectedValue(new SpotifyApiError(429, 'Spotify rate limit exceeded. Retry after ~80000s.'));

    const { genreMap, failedArtistIds } = await getArtistGenreMap(['artist-1']);

    expect(genreMap.has('artist-1')).toBe(false);
    expect(failedArtistIds).toEqual(['artist-1']);
    expect(setCachedGenres).not.toHaveBeenCalled();
  });

  it('returns a partial genreMap when some artists succeed and others fail', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockImplementation(async (path) => {
      if (path === '/artists/artist-ok') return { id: 'artist-ok', genres: ['rock'] };
      throw new SpotifyApiError(429, 'rate limited');
    });

    const { genreMap, failedArtistIds } = await getArtistGenreMap(['artist-ok', 'artist-fail']);

    expect(genreMap.get('artist-ok')).toEqual(['rock']);
    expect(genreMap.has('artist-fail')).toBe(false);
    expect(failedArtistIds).toEqual(['artist-fail']);
  });

  it('behaves exactly as before when Spotify responds normally for every artist', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockImplementation(async (path) => {
      const id = path.split('/').pop();
      return { id, genres: [`genre-${id}`] };
    });

    const { genreMap, failedArtistIds } = await getArtistGenreMap(['a1', 'a2']);

    expect(genreMap.get('a1')).toEqual(['genre-a1']);
    expect(genreMap.get('a2')).toEqual(['genre-a2']);
    expect(failedArtistIds).toEqual([]);
  });

  it('re-throws unexpected non-SpotifyApiError failures instead of silently swallowing them', async () => {
    getCachedGenres.mockReturnValue(null);
    spotifyFetch.mockRejectedValue(new TypeError('unexpected'));

    await expect(getArtistGenreMap(['artist-1'])).rejects.toThrow('unexpected');
  });
});
