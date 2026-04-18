import type { ExerciseLog } from '../types';

export function buildLatestLogsByHistoryKey(logs: ExerciseLog[]) {
  const latestLogs = new Map<string, ExerciseLog>();

  logs.forEach((log) => {
    if (log.setLogs.length === 0) {
      return;
    }

    const currentLatest = latestLogs.get(log.historyKey);

    if (!currentLatest || log.loggedAt > currentLatest.loggedAt) {
      latestLogs.set(log.historyKey, log);
    }
  });

  return latestLogs;
}
