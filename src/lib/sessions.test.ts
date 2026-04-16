import { describe, expect, it } from 'vitest';

import type { ExerciseLog, PlannedExercise, WorkoutDay, WorkoutSession } from '../types';
import {
  countLoggedExercisesInSession,
  getActiveSession,
  getCompletedSessionsForDay,
  getNextExerciseForSession,
  getSuggestedWorkoutDay,
  getWorkoutDayStatus,
} from './sessions';

const days: WorkoutDay[] = [
  {
    id: 'week-1-upper',
    weekNumber: 1,
    name: 'Upper',
    focus: 'Strength',
    order: 0,
    exercises: [],
  },
  {
    id: 'week-1-lower',
    weekNumber: 1,
    name: 'Lower',
    focus: 'Strength',
    order: 1,
    exercises: [],
  },
];

const sessions: WorkoutSession[] = [
  {
    id: 'session-1',
    dayId: 'week-1-upper',
    dayName: 'Upper',
    weekNumber: 1,
    status: 'completed',
    startedAt: '2026-04-10T18:00:00.000Z',
    completedAt: '2026-04-10T19:00:00.000Z',
    createdAt: '2026-04-10T18:00:00.000Z',
  },
  {
    id: 'session-2',
    dayId: 'week-1-lower',
    dayName: 'Lower',
    weekNumber: 1,
    status: 'in_progress',
    startedAt: '2026-04-11T18:00:00.000Z',
    createdAt: '2026-04-11T18:00:00.000Z',
  },
];

describe('session helpers', () => {
  it('derives active and completed day states', () => {
    expect(getActiveSession(sessions)?.id).toBe('session-2');
    expect(getWorkoutDayStatus('week-1-lower', sessions)).toBe('in_progress');
    expect(getWorkoutDayStatus('week-1-upper', sessions)).toBe('completed');
    expect(getWorkoutDayStatus('week-2-push', sessions)).toBe('not_started');
  });

  it('returns completed sessions in newest-first order', () => {
    const completed = getCompletedSessionsForDay('week-1-upper', sessions);

    expect(completed).toHaveLength(1);
    expect(completed[0]?.id).toBe('session-1');
  });

  it('counts unique exercise logs in a session and finds the next exercise', () => {
    const exercises: PlannedExercise[] = [
      {
        id: 'exercise-1',
        weekNumber: 1,
        dayName: 'Lower',
        order: 1,
        options: [],
        defaultOptionKey: 'primary',
        warmupSetsText: '1',
        workingSets: 2,
        repsText: '8-10',
        notes: 'One',
      },
      {
        id: 'exercise-2',
        weekNumber: 1,
        dayName: 'Lower',
        order: 2,
        options: [],
        defaultOptionKey: 'primary',
        warmupSetsText: '1',
        workingSets: 2,
        repsText: '8-10',
        notes: 'Two',
      },
    ];

    const logs: ExerciseLog[] = [
      {
        id: 'log-1',
        programExerciseId: 'exercise-1',
        dayId: 'week-1-lower',
        sessionId: 'session-2',
        performedOptionKey: 'primary',
        performedOptionLabel: 'Squat',
        historyKey: 'squat',
        weekNumber: 1,
        dayName: 'Lower',
        loggedAt: '2026-04-11T18:10:00.000Z',
        setLogs: [{ setNumber: 1, weight: '100', repsCompleted: '8' }],
      },
    ];

    expect(countLoggedExercisesInSession('session-2', logs)).toBe(1);
    expect(getNextExerciseForSession(exercises, 'session-2', logs)?.id).toBe('exercise-2');
  });

  it('suggests the active day first and otherwise the first incomplete day', () => {
    expect(getSuggestedWorkoutDay(days, sessions)?.id).toBe('week-1-lower');
    expect(getSuggestedWorkoutDay(days, [sessions[0]]).id).toBe('week-1-lower');
  });
});
