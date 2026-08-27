import { describe, it, expect } from 'vitest';
import { isDedupeWarningVisible } from '../src/pages/PlanBuilderPage.jsx';

describe('isDedupeWarningVisible', () => {
  it('shows the warning for dedupe_tracks', () => {
    expect(isDedupeWarningVisible('dedupe_tracks')).toBe(true);
  });

  it('does not show the warning for other operation types', () => {
    expect(isDedupeWarningVisible('remove_tracks')).toBe(false);
    expect(isDedupeWarningVisible('add_tracks')).toBe(false);
    expect(isDedupeWarningVisible('replace_tracks')).toBe(false);
    expect(isDedupeWarningVisible('reorder_tracks')).toBe(false);
    expect(isDedupeWarningVisible('rename_playlist')).toBe(false);
    expect(isDedupeWarningVisible('change_description')).toBe(false);
    expect(isDedupeWarningVisible('change_cover_image')).toBe(false);
  });
});
