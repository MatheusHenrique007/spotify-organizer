import { describeOperation } from './operationPresentation.js';

// Two real entry shapes exist (server/src/routes/plans.js and server/src/routes/spicetify.js):
//   playlist entry: { id, timestamp, planId, operationCount, results: [{success, operationId, type, error?}] }
//   spicetify entry: { id, timestamp, type: 'spicetify_theme', action, result: 'success'|'failure', details }
// No playlist name/title is ever stored in history — only operation type, success, and error text —
// so search intentionally never claims to match a playlist name.

export function getEntryKind(entry) {
  return entry.type === 'spicetify_theme' ? 'spicetify' : 'playlist';
}

// A playlist entry can be a mix of successful and failed operations; it only counts as an
// overall success when every operation in it succeeded. A spicetify entry already carries a
// single real result string.
export function getEntryStatus(entry) {
  if (getEntryKind(entry) === 'spicetify') {
    return entry.result === 'success' ? 'success' : 'error';
  }
  const results = Array.isArray(entry.results) ? entry.results : [];
  if (results.length === 0) return 'success';
  return results.every((result) => result.success) ? 'success' : 'error';
}

function getEntrySearchText(entry) {
  if (getEntryKind(entry) === 'spicetify') {
    return [entry.action, entry.result, entry.details?.stderr].filter(Boolean).join(' ');
  }
  const results = Array.isArray(entry.results) ? entry.results : [];
  return results
    .flatMap((result) => [describeOperation(result).label, result.type, result.error])
    .filter(Boolean)
    .join(' ');
}

export function filterHistory(entries, { query = '', type = 'all', status = 'all' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    const kind = getEntryKind(entry);

    if (type !== 'all' && type !== kind) return false;
    if (status !== 'all' && getEntryStatus(entry) !== status) return false;

    if (normalizedQuery) {
      const haystack = getEntrySearchText(entry).toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }

    return true;
  });
}
