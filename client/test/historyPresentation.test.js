import { describe, it, expect } from 'vitest';
import { describeExecutionDetails } from '../src/lib/historyPresentation.js';

describe('describeExecutionDetails', () => {
  it('returns null when there are no details (e.g. add_tracks)', () => {
    expect(describeExecutionDetails(undefined)).toBeNull();
  });

  it('represents a first-try success without a retry', () => {
    const result = describeExecutionDetails({
      uris: ['spotify:track:1'],
      attempts: 1,
      retryPerformed: false,
      verificationPassed: true,
      snapshotsUsed: ['snap-1']
    });
    expect(result.summary).toBe('1 tentativa · sem retry');
    expect(result.verificationLabel).toBe('Verificação: confirmada');
    expect(result.verificationClass).toBe('status-success');
    expect(result.snapshotsLabel).toBe('Snapshots utilizados: 1');
  });

  it('represents retryPerformed=true correctly', () => {
    const result = describeExecutionDetails({
      uris: ['spotify:track:1'],
      attempts: 2,
      retryPerformed: true,
      verificationPassed: true,
      snapshotsUsed: ['snap-1', 'snap-2']
    });
    expect(result.summary).toBe('2 tentativas · retry realizado');
    expect(result.retryPerformed).toBe(true);
  });

  it('represents verificationPassed=false correctly', () => {
    const result = describeExecutionDetails({
      uris: ['spotify:track:1'],
      attempts: 2,
      retryPerformed: true,
      verificationPassed: false,
      snapshotsUsed: ['snap-1', 'snap-2']
    });
    expect(result.verificationLabel).toBe('Verificação: falhou');
    expect(result.verificationClass).toBe('status-error');
  });

  it('exposes the affected track count without requiring full URIs to be shown', () => {
    const result = describeExecutionDetails({
      uris: ['spotify:track:1', 'spotify:track:2'],
      attempts: 1,
      retryPerformed: false,
      verificationPassed: true,
      snapshotsUsed: ['snap-1']
    });
    expect(result.uriCount).toBe(2);
  });
});
