import type {
  ExerciseLog,
  SetLog,
  WorkoutDayName,
  WorkoutProgram,
  WorkoutSession,
  WorkoutSessionStatus,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const REMOTE_SCOPE_ID = 'default';
const PROGRAM_TABLE = 'gym_program_state';
const LOG_TABLE = 'gym_exercise_logs';
const SESSION_TABLE = 'gym_workout_sessions';

export type AppDataLoadResult = {
  program: WorkoutProgram | null;
  logs: ExerciseLog[];
  sessions: WorkoutSession[];
  mode: 'supabase';
  notice?: string;
};

export type StorageMutationResult = {
  mode: 'supabase';
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
  assertSupabaseConfigured();

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
    throw new Error(`Supabase could not load the workout program. ${programResult.error.message}`);
  }

  if (logsResult.error) {
    throw new Error(`Supabase could not load workout logs. ${logsResult.error.message}`);
  }

  if (sessionsResult.error) {
    throw new Error(`Supabase could not load workout sessions. ${sessionsResult.error.message}`);
  }

  const rawRemoteProgram = programResult.data?.program ?? null;
  const remoteProgram = isValidWorkoutProgram(rawRemoteProgram) ? rawRemoteProgram : null;

  if (rawRemoteProgram && !remoteProgram) {
    throw new Error('Supabase returned invalid workout program data.');
  }

  const remoteSessions = (sessionsResult.data ?? [])
    .map(mapRemoteSessionRow)
    .filter(isValidWorkoutSession);
  const invalidSessionCount = (sessionsResult.data?.length ?? 0) - remoteSessions.length;

  return {
    program: remoteProgram,
    logs: (logsResult.data ?? []).map(mapRemoteLogRow),
    sessions: remoteSessions,
    mode: 'supabase',
    notice:
      invalidSessionCount > 0
        ? 'Some invalid workout sessions were ignored while loading Supabase data.'
        : undefined,
  };
}

export async function saveProgram(program: WorkoutProgram): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(PROGRAM_TABLE).upsert({
    scope_id: REMOTE_SCOPE_ID,
    program,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Supabase could not save the active week. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function upsertSession(
  session: WorkoutSession,
  _nextSessions: WorkoutSession[]
): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(SESSION_TABLE)
    .upsert(mapWorkoutSessionToRemoteRow(session), { onConflict: 'id' });

  if (error) {
    throw new Error(`Supabase could not save this workout session. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function deleteSession(
  sessionId: string,
  _nextSessions: WorkoutSession[],
  _nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const [logDeleteResult, sessionDeleteResult] = await Promise.all([
    supabase.from(LOG_TABLE).delete().eq('scope_id', REMOTE_SCOPE_ID).eq('session_id', sessionId),
    supabase.from(SESSION_TABLE).delete().eq('scope_id', REMOTE_SCOPE_ID).eq('id', sessionId),
  ]);

  if (logDeleteResult.error) {
    throw new Error(
      `Supabase could not remove workout logs for this session. ${logDeleteResult.error.message}`
    );
  }

  if (sessionDeleteResult.error) {
    throw new Error(`Supabase could not remove this workout session. ${sessionDeleteResult.error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function upsertExerciseLog(
  log: ExerciseLog,
  _nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(LOG_TABLE)
    .upsert(mapExerciseLogToRemoteRow(log), { onConflict: 'id' });

  if (error) {
    throw new Error(`Supabase could not save this workout log. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function deleteExerciseLog(
  logId: string,
  _nextLogs: ExerciseLog[]
): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(LOG_TABLE)
    .delete()
    .eq('scope_id', REMOTE_SCOPE_ID)
    .eq('id', logId);

  if (error) {
    throw new Error(`Supabase could not remove this workout log. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function replaceProgramAndClearLogs(
  program: WorkoutProgram
): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('replace_gym_program', {
    p_scope_id: REMOTE_SCOPE_ID,
    p_program: program,
  });

  if (error) {
    throw new Error(`Supabase could not replace the program. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
}

export async function clearLogsOnly(): Promise<StorageMutationResult> {
  assertSupabaseConfigured();

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('clear_gym_logs', {
    p_scope_id: REMOTE_SCOPE_ID,
  });

  if (error) {
    throw new Error(`Supabase could not clear the workout logs. ${error.message}`);
  }

  return {
    mode: 'supabase',
    notice: 'Synced to Supabase.',
  };
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

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is required for this app. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
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
