import { describe, expect, it } from 'vitest';

import type { ExerciseLog } from '../types';
import { buildLatestLogsByHistoryKey } from './history';

describe('buildLatestLogsByHistoryKey', () => {
  it('keeps the newest log for each movement history key', () => {
    const logs: ExerciseLog[] = [
      {
        id: '1',
        programExerciseId: 'exercise-1',
        performedOptionKey: 'primary',
        performedOptionLabel: 'DB Bench Press',
        historyKey: 'db-bench-press',
        weekNumber: 1,
        dayName: 'Push',
        loggedAt: '2026-01-01T10:00:00.000Z',
        setLogs: [{ setNumber: 1, weight: '70', repsCompleted: '10' }],
      },
      {
        id: '2',
        programExerciseId: 'exercise-2',
        performedOptionKey: 'substitution-1',
        performedOptionLabel: 'Machine Chest Press',
        historyKey: 'machine-chest-press',
        weekNumber: 1,
        dayName: 'Push',
        loggedAt: '2026-01-01T11:00:00.000Z',
        setLogs: [{ setNumber: 1, weight: '120', repsCompleted: '10' }],
      },
      {
        id: '3',
        programExerciseId: 'exercise-3',
        performedOptionKey: 'primary',
        performedOptionLabel: 'DB Bench Press',
        historyKey: 'db-bench-press',
        weekNumber: 2,
        dayName: 'Push',
        loggedAt: '2026-01-08T10:00:00.000Z',
        setLogs: [{ setNumber: 1, weight: '75', repsCompleted: '9' }],
      },
      {
        id: '4',
        programExerciseId: 'exercise-4',
        performedOptionKey: 'primary',
        performedOptionLabel: 'DB Bench Press',
        historyKey: 'db-bench-press',
        weekNumber: 3,
        dayName: 'Push',
        loggedAt: '2026-01-15T10:00:00.000Z',
        setLogs: [],
      },
    ];

    const latestLogs = buildLatestLogsByHistoryKey(logs);

    expect(latestLogs.get('db-bench-press')?.id).toBe('3');
    expect(latestLogs.get('machine-chest-press')?.id).toBe('2');
  });

  it('returns an empty map when there are no logs', () => {
    expect(buildLatestLogsByHistoryKey([]).size).toBe(0);
  });
});
