import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ExerciseLog,
  SetLog,
  WorkoutDayName,
  WorkoutProgram,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const PROGRAM_STORAGE_KEY = 'gym-program:v1';
export const LOG_STORAGE_KEY = 'gym-logs:v1';
export const SESSION_STORAGE_KEY = 'gym-sessions:v1';

const REMOTE_SCOPE_ID = 'default';
const PROGRAM_TABLE = 'gym_program_state';
const LOG_TABLE = 'gym_exercise_logs';
const SESSION_TABLE = 'gym_workout_sessions';

export type AppDataLoadResult = {
  program: WorkoutProgram | null;
  logs: ExerciseLog[];
  sessions: WorkoutSession[];
  mode: 'supabase' | 'local-cache';
  notice?: string;
};

export type StorageMutationResult = {
  mode: 'supabase' | 'local-cache';
  notice?: string;
};

type RemoteProgramRow = {
  program: WorkoutProgram;
};

type RemoteLogRow = {
  id: string;
  program_exercise_id: string;
  day_id: string | null;
  session_id: string | null;
  performed_option_key: string;
  performed_option_label: string;
  history_key: string;
  week_number: number;
  day_name: WorkoutDayName;
  logged_at: string;
  exercise_note: string | null;
  set_logs: SetLog[];
};

type RemoteSessionRow = {
  id: string;
  day_id: string;
  day_name: WorkoutDayName;
  week_number: number;
  status: WorkoutSessionStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export async function loadAppData(): Promise<AppDataLoadResult> {
  const [rawLocalProgram, rawLocalLogs, rawLocalSessions] = await Promise.all([
    loadLocalProgram(),
    loadLocalLogs(),
    loadLocalSessions(),
  ]);

  const localProgram = isValidWorkoutProgram(rawLocalProgram) ? rawLocalProgram : null;
  const localLogs = Array.isArray(rawLocalLogs) ? rawLocalLogs : [];
  const localSessions = Array.isArray(rawLocalSessions)
    ? rawLocalSessions.filter(isValidWorkoutSession)
    : [];
  const localProgramWasInvalid = rawLocalProgram !== null && !localProgram;
  const localSessionsWereInvalid =
    Array.isArray(rawLocalSessions) && rawLocalSessions.length !== localSessions.length;
  const localNotices = [
    localProgramWasInvalid ? 'The saved local workout program was invalid and was ignored.' : undefined,
    localSessionsWereInvalid ? 'Some saved local workout sessions were invalid and were ignored.' : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  if (!isSupabaseConfigured()) {
    return {
      program: localProgram,
      logs: localLogs,
      sessions: localSessions,
      mode: 'local-cache',
      notice:
        localNotices ||
        'Supabase is not configured yet, so the app is using local storage only.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const [programResult, logsResult, sessionsResult] = await Promise.all([
      supabase
        .from(PROGRAM_TABLE)
        .select('program')
        .eq('scope_id', REMOTE_SCOPE_ID)
        .maybeSingle<RemoteProgramRow>(),
      supabase
        .from(LOG_TABLE)
        .select(
          'id, program_exercise_id, day_id, session_id, performed_option_key, performed_option_label, history_key, week_number, day_name, logged_at, exercise_note, set_logs'
        )
        .eq('scope_id', REMOTE_SCOPE_ID)
        .order('logged_at', { ascending: true })
        .returns<RemoteLogRow[]>(),
      supabase
        .from(SESSION_TABLE)
        .select('id, day_id, day_name, week_number, status, started_at, completed_at, created_at')
        .eq('scope_id', REMOTE_SCOPE_ID)
        .order('created_at', { ascending: true })
        .returns<RemoteSessionRow[]>(),
    ]);

    if (programResult.error) {
      throw programResult.error;
    }

    if (logsResult.error) {
      throw logsResult.error;
    }

    if (sessionsResult.error) {
      throw sessionsResult.error;
    }

    const rawRemoteProgram = programResult.data?.program ?? null;
    const remoteProgram = isValidWorkoutProgram(rawRemoteProgram) ? rawRemoteProgram : null;
    const remoteLogs = (logsResult.data ?? []).map(mapRemoteLogRow);
    const remoteSessions = (sessionsResult.data ?? [])
      .map(mapRemoteSessionRow)
      .filter(isValidWorkoutSession);
    const remoteProgramWasInvalid = rawRemoteProgram !== null && !remoteProgram;
    const remoteSessionsWereInvalid =
      (sessionsResult.data?.length ?? 0) !== remoteSessions.length;

    if (remoteProgram) {
      await saveLocalSnapshot(remoteProgram, remoteLogs, remoteSessions);

      return {
        program: remoteProgram,
        logs: remoteLogs,
        sessions: remoteSessions,
        mode: 'supabase',
        notice:
          [
            localNotices || undefined,
            remoteSessionsWereInvalid
              ? 'Some Supabase workout sessions were invalid and were ignored.'
              : undefined,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      };
    }

    if (localProgram) {
      await writeRemoteSnapshot(localProgram, localLogs, localSessions);
      await saveLocalSnapshot(localProgram, localLogs, localSessions);

      return {
        program: localProgram,
        logs: localLogs,
        sessions: localSessions,
        mode: 'supabase',
        notice: [
          localNotices || undefined,
          remoteProgramWasInvalid
            ? 'Supabase had invalid workout data, so the local cache was used to repair it.'
            : undefined,
          'Migrated your existing local workout data into Supabase.',
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    return {
      program: null,
      logs: [],
      sessions: [],
      mode: 'local-cache',
      notice:
        [
          localNotices || undefined,
          remoteProgramWasInvalid ? 'Supabase returned invalid workout data.' : undefined,
          remoteSessionsWereInvalid
            ? 'Some Supabase workout sessions were invalid and were ignored.'
            : undefined,
        ]
          .filter(Boolean)
          .join(' ') || undefined,
    };
  } catch (error) {
    return {
      program: localProgram,
      logs: localLogs,
      sessions: localSessions,
      mode: 'local-cache',
      notice: [
        localNotices || undefined,
        `Could not reach Supabase. ${getErrorMessage(error)}`,
        localProgram ? 'Using the local cache instead.' : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
}

export async function saveProgram(program: WorkoutProgram): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalProgram(program);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(PROGRAM_TABLE).upsert({
      scope_id: REMOTE_SCOPE_ID,
      program,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Supabase could not save the active week. ${error.message}`);
    }

    await saveLocalProgram(program);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalProgram(program);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function upsertSession(
  session: WorkoutSession,
  nextSessions: WorkoutSession[]
): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalSessions(nextSessions);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(SESSION_TABLE)
      .upsert(mapWorkoutSessionToRemoteRow(session), { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase could not save this workout session. ${error.message}`);
    }

    await saveLocalSessions(nextSessions);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalSessions(nextSessions);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function deleteSession(
  sessionId: string,
  nextSessions: WorkoutSession[],
  nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalLogs(nextLogs);
    await saveLocalSessions(nextSessions);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const [logDeleteResult, sessionDeleteResult] = await Promise.all([
      supabase.from(LOG_TABLE).delete().eq('scope_id', REMOTE_SCOPE_ID).eq('session_id', sessionId),
      supabase.from(SESSION_TABLE).delete().eq('scope_id', REMOTE_SCOPE_ID).eq('id', sessionId),
    ]);

    if (logDeleteResult.error) {
      throw new Error(`Supabase could not remove workout logs for this session. ${logDeleteResult.error.message}`);
    }

    if (sessionDeleteResult.error) {
      throw new Error(`Supabase could not remove this workout session. ${sessionDeleteResult.error.message}`);
    }

    await saveLocalLogs(nextLogs);
    await saveLocalSessions(nextSessions);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalLogs(nextLogs);
    await saveLocalSessions(nextSessions);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function upsertExerciseLog(
  log: ExerciseLog,
  nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalLogs(nextLogs);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(LOG_TABLE)
      .upsert(mapExerciseLogToRemoteRow(log), { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase could not save this workout log. ${error.message}`);
    }

    await saveLocalLogs(nextLogs);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalLogs(nextLogs);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function deleteExerciseLog(
  logId: string,
  nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalLogs(nextLogs);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(LOG_TABLE)
      .delete()
      .eq('scope_id', REMOTE_SCOPE_ID)
      .eq('id', logId);

    if (error) {
      throw new Error(`Supabase could not remove this workout log. ${error.message}`);
    }

    await saveLocalLogs(nextLogs);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalLogs(nextLogs);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function replaceProgramAndClearLogs(
  program: WorkoutProgram
): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalSnapshot(program, [], []);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('replace_gym_program', {
      p_scope_id: REMOTE_SCOPE_ID,
      p_program: program,
    });

    if (error) {
      throw new Error(`Supabase could not replace the program. ${error.message}`);
    }

    await saveLocalSnapshot(program, [], []);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalSnapshot(program, [], []);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

export async function clearLogsOnly(): Promise<StorageMutationResult> {
  if (!isSupabaseConfigured()) {
    await saveLocalLogs([]);
    await saveLocalSessions([]);
    return {
      mode: 'local-cache',
      notice: 'Saved locally because Supabase is not configured.',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('clear_gym_logs', {
      p_scope_id: REMOTE_SCOPE_ID,
    });

    if (error) {
      throw new Error(`Supabase could not clear the workout logs. ${error.message}`);
    }

    await saveLocalLogs([]);
    await saveLocalSessions([]);

    return {
      mode: 'supabase',
      notice: 'Synced to Supabase.',
    };
  } catch (error) {
    await saveLocalLogs([]);
    await saveLocalSessions([]);
    return {
      mode: 'local-cache',
      notice: `Saved locally only because Supabase is unavailable. ${getErrorMessage(error)}`,
    };
  }
}

async function loadLocalProgram() {
  const value = await AsyncStorage.getItem(PROGRAM_STORAGE_KEY);
  return value ? (JSON.parse(value) as WorkoutProgram) : null;
}

async function saveLocalProgram(program: WorkoutProgram) {
  await AsyncStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(program));
}

async function loadLocalLogs() {
  const value = await AsyncStorage.getItem(LOG_STORAGE_KEY);
  return value ? (JSON.parse(value) as ExerciseLog[]) : [];
}

async function saveLocalLogs(logs: ExerciseLog[]) {
  await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
}

async function loadLocalSessions() {
  const value = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  return value ? (JSON.parse(value) as WorkoutSession[]) : [];
}

async function saveLocalSessions(sessions: WorkoutSession[]) {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

async function saveLocalSnapshot(
  program: WorkoutProgram,
  logs: ExerciseLog[],
  sessions: WorkoutSession[]
) {
  await AsyncStorage.multiSet([
    [PROGRAM_STORAGE_KEY, JSON.stringify(program)],
    [LOG_STORAGE_KEY, JSON.stringify(logs)],
    [SESSION_STORAGE_KEY, JSON.stringify(sessions)],
  ]);
}

async function writeRemoteSnapshot(
  program: WorkoutProgram,
  logs: ExerciseLog[],
  sessions: WorkoutSession[]
) {
  const supabase = getSupabaseClient();
  const replaceResult = await supabase.rpc('replace_gym_program', {
    p_scope_id: REMOTE_SCOPE_ID,
    p_program: program,
  });

  if (replaceResult.error) {
    throw new Error(
      `Supabase could not initialize the workout program. ${replaceResult.error.message}`
    );
  }

  if (sessions.length) {
    const { error } = await supabase
      .from(SESSION_TABLE)
      .upsert(sessions.map(mapWorkoutSessionToRemoteRow), { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase could not migrate workout sessions. ${error.message}`);
    }
  }

  if (!logs.length) {
    return;
  }

  const { error } = await supabase
    .from(LOG_TABLE)
    .upsert(logs.map(mapExerciseLogToRemoteRow), { onConflict: 'id' });

  if (error) {
    throw new Error(`Supabase could not migrate the saved workout logs. ${error.message}`);
  }
}

function mapRemoteLogRow(row: RemoteLogRow): ExerciseLog {
  return {
    id: row.id,
    programExerciseId: row.program_exercise_id,
    dayId: row.day_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    performedOptionKey: row.performed_option_key,
    performedOptionLabel: row.performed_option_label,
    historyKey: row.history_key,
    weekNumber: row.week_number,
    dayName: row.day_name,
    loggedAt: row.logged_at,
    exerciseNote: row.exercise_note ?? undefined,
    setLogs: Array.isArray(row.set_logs) ? row.set_logs.map(mapSetLog) : [],
  };
}

function mapRemoteSessionRow(row: RemoteSessionRow): WorkoutSession {
  return {
    id: row.id,
    dayId: row.day_id,
    dayName: row.day_name,
    weekNumber: row.week_number,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapExerciseLogToRemoteRow(log: ExerciseLog) {
  return {
    id: log.id,
    scope_id: REMOTE_SCOPE_ID,
    program_exercise_id: log.programExerciseId,
    day_id: log.dayId ?? null,
    session_id: log.sessionId ?? null,
    performed_option_key: log.performedOptionKey,
    performed_option_label: log.performedOptionLabel,
    history_key: log.historyKey,
    week_number: log.weekNumber,
    day_name: log.dayName,
    logged_at: log.loggedAt,
    exercise_note: log.exerciseNote ?? null,
    set_logs: log.setLogs,
  };
}

function mapWorkoutSessionToRemoteRow(session: WorkoutSession) {
  return {
    id: session.id,
    scope_id: REMOTE_SCOPE_ID,
    day_id: session.dayId,
    day_name: session.dayName,
    week_number: session.weekNumber,
    status: session.status,
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    created_at: session.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function mapSetLog(setLog: SetLog): SetLog {
  return {
    setNumber: Number(setLog.setNumber),
    weight: String(setLog.weight ?? ''),
    repsCompleted:
      typeof setLog.repsCompleted === 'string' && setLog.repsCompleted.length > 0
        ? setLog.repsCompleted
        : undefined,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function isValidWorkoutProgram(program: WorkoutProgram | null): program is WorkoutProgram {
  if (!program) {
    return false;
  }

  if (
    typeof program.importedAt !== 'string' ||
    typeof program.sourceName !== 'string' ||
    typeof program.activeWeek !== 'number' ||
    !Array.isArray(program.weeks) ||
    program.weeks.length === 0
  ) {
    return false;
  }

  return program.weeks.some(
    (week) =>
      typeof week?.weekNumber === 'number' &&
      week.weekNumber === program.activeWeek &&
      Array.isArray(week.days)
  );
}

function isValidWorkoutSession(session: WorkoutSession) {
  if (!session || typeof session !== 'object') {
    return false;
  }

  const status = session.status;

  return (
    typeof session.id === 'string' &&
    typeof session.dayId === 'string' &&
    typeof session.dayName === 'string' &&
    typeof session.weekNumber === 'number' &&
    isValidSessionStatus(status) &&
    typeof session.startedAt === 'string' &&
    typeof session.createdAt === 'string' &&
    (status === 'in_progress' ? !session.completedAt : typeof session.completedAt === 'string')
  );
}

function isValidSessionStatus(status: WorkoutSessionStatus) {
  return status === 'in_progress' || status === 'completed';
}
