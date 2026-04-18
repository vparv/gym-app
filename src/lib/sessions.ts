import type {
  ExerciseLog,
  PlannedExercise,
  WorkoutDay,
  WorkoutDayStatus,
  WorkoutSession,
} from '../types';

export function getActiveSession(sessions: WorkoutSession[]) {
  return [...sessions]
    .filter((session) => session.status === 'in_progress')
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
}

export function getLatestCompletedSessionForDay(dayId: string, sessions: WorkoutSession[]) {
  return getCompletedSessionsForDay(dayId, sessions)[0];
}

export function getCompletedSessionsForDay(dayId: string, sessions: WorkoutSession[]) {
  return [...sessions]
    .filter((session) => session.dayId === dayId && session.status === 'completed')
    .sort((left, right) =>
      (right.completedAt ?? right.startedAt).localeCompare(left.completedAt ?? left.startedAt)
    );
}

export function getWorkoutDayStatus(dayId: string, sessions: WorkoutSession[]): WorkoutDayStatus {
  const activeSession = getActiveSession(sessions);

  if (activeSession?.dayId === dayId) {
    return 'in_progress';
  }

  return getLatestCompletedSessionForDay(dayId, sessions) ? 'completed' : 'not_started';
}

export function getSessionLogs(sessionId: string, logs: ExerciseLog[]) {
  return logs
    .filter((log) => log.sessionId === sessionId)
    .sort((left, right) => left.programExerciseId.localeCompare(right.programExerciseId));
}

export function getSessionLogByExerciseId(
  sessionId: string,
  programExerciseId: string,
  logs: ExerciseLog[]
) {
  return logs.find(
    (log) => log.sessionId === sessionId && log.programExerciseId === programExerciseId
  );
}

export function countLoggedExercisesInSession(sessionId: string, logs: ExerciseLog[]) {
  return getSessionLogs(sessionId, logs).filter((log) => log.setLogs.length > 0).length;
}

export function countHandledExercisesInSession(sessionId: string, logs: ExerciseLog[]) {
  return getSessionLogs(sessionId, logs).length;
}

export function getNextExerciseForSession(
  exercises: PlannedExercise[],
  sessionId: string,
  logs: ExerciseLog[]
) {
  const loggedExerciseIds = new Set(
    getSessionLogs(sessionId, logs).map((log) => log.programExerciseId)
  );

  return exercises.find((exercise) => !loggedExerciseIds.has(exercise.id));
}

export function getSuggestedWorkoutDay(days: WorkoutDay[], sessions: WorkoutSession[]) {
  const activeSession = getActiveSession(sessions);

  if (activeSession) {
    return days.find((day) => day.id === activeSession.dayId) ?? days[0];
  }

  return days.find((day) => getWorkoutDayStatus(day.id, sessions) !== 'completed') ?? days[0];
}

export function formatSessionDate(value?: string) {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatSessionDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
