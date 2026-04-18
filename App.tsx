import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { DayList, type WorkoutDayListItem } from './src/components/DayList';
import { ExerciseCard } from './src/components/ExerciseCard';
import { ExerciseFocusScreen } from './src/components/ExerciseFocusScreen';
import { YouTubePlayerModal } from './src/components/YouTubePlayerModal';
import { WeekPicker } from './src/components/WeekPicker';
import { parseWorkoutProgram } from './src/lib/csv';
import { buildLatestLogsByHistoryKey } from './src/lib/history';
import { loadBundledCsvTextAsync, readPickedDocumentTextAsync } from './src/lib/program-source';
import {
  countHandledExercisesInSession,
  countLoggedExercisesInSession,
  formatSessionDate,
  formatSessionDateTime,
  getActiveSession,
  getCompletedSessionsForDay,
  getLatestCompletedSessionForDay,
  getNextExerciseForSession,
  getSessionLogByExerciseId,
  getSessionLogs,
  getWorkoutDayStatus,
} from './src/lib/sessions';
import {
  clearLogsOnly,
  deleteExerciseLog,
  deleteSession,
  loadAppData,
  replaceProgramAndClearLogs,
  saveProgram,
  upsertExerciseLog,
  upsertSession,
} from './src/lib/storage';
import { theme } from './src/theme';
import type {
  AppMessage,
  AppViewState,
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseOption,
  ExerciseSetDraft,
  PlannedExercise,
  WorkoutDay,
  WorkoutProgram,
  WorkoutSession,
} from './src/types';

const SEEDED_PROGRAM_ASSET = require('./src/assets/bodybuilding_transformation_workouts_corrected.csv');
const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'];

type DialogAction = {
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  onPress: () => void | Promise<void>;
};

type DialogState = {
  title: string;
  message: string;
  actions: DialogAction[];
};

type ExerciseAutoSaveState = 'saving' | 'saved' | 'error';

type ExerciseAutoSaveQueue = {
  activePromise?: Promise<void>;
  queuedDraft?: ExerciseLogDraft;
  queuedExercise?: PlannedExercise;
};

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const [bootstrapState, setBootstrapState] = React.useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [program, setProgram] = React.useState<WorkoutProgram | null>(null);
  const [logs, setLogs] = React.useState<ExerciseLog[]>([]);
  const [sessions, setSessions] = React.useState<WorkoutSession[]>([]);
  const [viewState, setViewState] = React.useState<AppViewState>({ screen: 'home' });
  const [drafts, setDrafts] = React.useState<Record<string, ExerciseLogDraft>>({});
  const [autoSaveStates, setAutoSaveStates] = React.useState<Record<string, ExerciseAutoSaveState>>({});
  const [message, setMessage] = React.useState<AppMessage | null>(null);
  const [busyAction, setBusyAction] = React.useState<'replace' | 'clear-logs' | null>(null);
  const [storageMode, setStorageMode] = React.useState<'supabase'>('supabase');
  const [sessionBusy, setSessionBusy] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [justCompletedSessionId, setJustCompletedSessionId] = React.useState<string | null>(null);
  const [focusedExerciseId, setFocusedExerciseId] = React.useState<string | null>(null);
  const [videoPlayerState, setVideoPlayerState] = React.useState<{
    title: string;
    url: string | null;
    notes: string;
  }>({
    title: '',
    url: null,
    notes: '',
  });

  React.useEffect(() => {
    void bootstrapApp();
  }, []);

  const latestLogsByHistoryKey = React.useMemo(() => buildLatestLogsByHistoryKey(logs), [logs]);
  const activeSession = React.useMemo(() => getActiveSession(sessions), [sessions]);

  const activeWeek =
    program?.weeks.find((week) => week.weekNumber === program.activeWeek) ?? program?.weeks[0] ?? null;

  const selectedDay =
    activeWeek && viewState.screen === 'day'
      ? activeWeek.days.find((day) => day.id === viewState.dayId) ?? null
      : null;

  const currentWorkoutDay =
    program && activeSession ? findWorkoutDayById(program, activeSession.dayId) : null;

  const currentDaySession =
    selectedDay && activeSession?.dayId === selectedDay.id ? activeSession : null;

  const focusedExercise =
    selectedDay?.exercises.find((exercise) => exercise.id === focusedExerciseId) ?? null;

  const logsRef = React.useRef(logs);
  const draftsRef = React.useRef(drafts);
  const selectedDayRef = React.useRef(selectedDay);
  const currentDaySessionRef = React.useRef(currentDaySession);
  const autoSaveQueuesRef = React.useRef<Record<string, ExerciseAutoSaveQueue>>({});

  logsRef.current = logs;
  draftsRef.current = drafts;
  selectedDayRef.current = selectedDay;
  currentDaySessionRef.current = currentDaySession;

  const justCompletedSession =
    selectedDay && justCompletedSessionId
      ? sessions.find(
          (session) =>
            session.id === justCompletedSessionId &&
            session.dayId === selectedDay.id &&
            session.status === 'completed'
        ) ?? null
      : null;

  const selectedDayRecentSessions = React.useMemo(
    () => (selectedDay ? getCompletedSessionsForDay(selectedDay.id, sessions).slice(0, 3) : []),
    [selectedDay, sessions]
  );

  const detailMode =
    selectedDay && currentDaySession
      ? 'active'
      : selectedDay && justCompletedSession
        ? 'summary'
        : selectedDay
          ? 'review'
          : null;

  const currentDayLoggedCount =
    selectedDay && currentDaySession
      ? countLoggedExercisesInSession(currentDaySession.id, logs)
      : selectedDay && justCompletedSession
        ? countLoggedExercisesInSession(justCompletedSession.id, logs)
        : 0;

  const currentDayHandledCount =
    selectedDay && currentDaySession
      ? countHandledExercisesInSession(currentDaySession.id, logs)
      : selectedDay && justCompletedSession
        ? countHandledExercisesInSession(justCompletedSession.id, logs)
        : 0;

  const currentDaySkippedCount = Math.max(0, currentDayHandledCount - currentDayLoggedCount);

  const nextExercise =
    selectedDay && currentDaySession
      ? getNextExerciseForSession(selectedDay.exercises, currentDaySession.id, logs)
      : undefined;

  const nextUpDay = React.useMemo(() => {
    if (!activeWeek) {
      return null;
    }

    if (activeSession?.weekNumber === activeWeek.weekNumber) {
      return activeWeek.days.find((day) => day.id === activeSession.dayId) ?? activeWeek.days[0] ?? null;
    }

    return (
      activeWeek.days.find((day) => getWorkoutDayStatus(day.id, sessions) !== 'completed') ??
      activeWeek.days[0] ??
      null
    );
  }, [activeSession, activeWeek, sessions]);

  const dayItems = React.useMemo<WorkoutDayListItem[]>(
    () =>
      activeWeek
        ? activeWeek.days.map((day) => ({
            day,
            status: getWorkoutDayStatus(day.id, sessions),
            completedAt: getLatestCompletedSessionForDay(day.id, sessions)?.completedAt,
            isNextUp: nextUpDay?.id === day.id,
          }))
        : [],
    [activeWeek, nextUpDay, sessions]
  );

  React.useEffect(() => {
    if (viewState.screen === 'day' && !selectedDay) {
      setViewState({ screen: 'home' });
      draftsRef.current = {};
      setDrafts({});
      setAutoSaveStates({});
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
    }
  }, [selectedDay, viewState]);

  React.useEffect(() => {
    if (!selectedDay || !focusedExerciseId) {
      return;
    }

    if (!selectedDay.exercises.some((exercise) => exercise.id === focusedExerciseId)) {
      setFocusedExerciseId(null);
    }
  }, [focusedExerciseId, selectedDay]);

  async function bootstrapApp() {
    setBootstrapState('loading');
    setBootstrapError(null);
    setMessage(null);

    try {
      const { program: storedProgram, logs: storedLogs, sessions: storedSessions, notice, mode } =
        await loadAppData();

      if (storedProgram) {
        setProgram(storedProgram);
        logsRef.current = storedLogs;
        setLogs(storedLogs);
        setSessions(storedSessions);
        setStorageMode(mode);
        setViewState({ screen: 'home' });
        clearAllDrafts();
        setJustCompletedSessionId(null);
        if (notice) {
          setMessage({
            type: 'success',
            text: notice,
          });
        }
        setBootstrapState('ready');
        return;
      }

      const seededProgram = await createProgramFromCsvSource(
        await loadBundledCsvTextAsync(SEEDED_PROGRAM_ASSET),
        'bodybuilding_transformation_workouts_corrected.csv'
      );

      const result = await replaceProgramAndClearLogs(seededProgram);

      setProgram(seededProgram);
      logsRef.current = [];
      setLogs([]);
      setSessions([]);
      setStorageMode(result.mode);
      setViewState({ screen: 'home' });
      clearAllDrafts();
      setJustCompletedSessionId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Loaded the bundled workout program. ${result.notice}`
          : 'Loaded the bundled workout program. You can replace it later from the Program screen.',
      });
      setBootstrapState('ready');
    } catch (error) {
      setBootstrapError(getErrorMessage(error));
      setBootstrapState('error');
    }
  }

  const persistActiveWeek = async (weekNumber: number) => {
    if (!program) {
      return undefined;
    }

    const nextProgram = {
      ...program,
      activeWeek: weekNumber,
    };

    const result = await saveProgram(nextProgram);
    setProgram(nextProgram);
    setStorageMode(result.mode);
    return result;
  };

  const handleWeekSelect = async (weekNumber: number) => {
    try {
      const result = await persistActiveWeek(weekNumber);
      setMessage(
        result?.notice
          ? {
              type: 'success',
              text: result.notice,
            }
          : null
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not switch weeks. ${getErrorMessage(error)}`,
      });
    }
  };

  const openDayScreen = async (day: WorkoutDay) => {
    try {
      if (program?.activeWeek !== day.weekNumber) {
        await persistActiveWeek(day.weekNumber);
      }

      await waitForAllAutoSaves();
      setViewState({ screen: 'day', dayId: day.id });
      clearAllDrafts();
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
      setMessage(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not open that workout day. ${getErrorMessage(error)}`,
      });
    }
  };

  const handleOpenDay = (dayId: string) => {
    const day = activeWeek?.days.find((currentDay) => currentDay.id === dayId);

    if (!day) {
      setMessage({
        type: 'error',
        text: 'That workout day could not be found.',
      });
      return;
    }

    if (!activeSession) {
      void openDayScreen(day);
      return;
    }

    if (activeSession.dayId === dayId) {
      void openDayScreen(day);
      return;
    }

    setDialog({
      title: 'Another workout is in progress',
      message:
        'You still have an unfinished workout. Resume the current one, discard it and switch days, or cancel.',
      actions: [
        {
          label: 'Resume current',
          tone: 'primary',
          onPress: () => {
            if (currentWorkoutDay) {
              void openDayScreen(currentWorkoutDay);
            }
          },
        },
        {
          label: 'Discard and switch',
          tone: 'danger',
          onPress: () => void handleDiscardAndSwitch(activeSession, day),
        },
        {
          label: 'Cancel',
          tone: 'secondary',
          onPress: () => undefined,
        },
      ],
    });
  };

  const clearAllDrafts = () => {
    draftsRef.current = {};
    setDrafts({});
    setAutoSaveStates({});
  };

  const setExerciseAutoSaveState = (
    exerciseId: string,
    nextState: ExerciseAutoSaveState | undefined
  ) => {
    setAutoSaveStates((currentStates) => {
      if (!nextState) {
        if (!(exerciseId in currentStates)) {
          return currentStates;
        }

        const remainingStates = { ...currentStates };
        delete remainingStates[exerciseId];
        return remainingStates;
      }

      if (currentStates[exerciseId] === nextState) {
        return currentStates;
      }

      return {
        ...currentStates,
        [exerciseId]: nextState,
      };
    });
  };

  const waitForExerciseAutoSave = async (exerciseId: string) => {
    const activePromise = autoSaveQueuesRef.current[exerciseId]?.activePromise;

    if (activePromise) {
      await activePromise;
    }
  };

  const waitForAllAutoSaves = async () => {
    const activePromises = Object.values(autoSaveQueuesRef.current)
      .map((queue) => queue.activePromise)
      .filter((promise): promise is Promise<void> => Boolean(promise));

    if (activePromises.length) {
      await Promise.all(activePromises);
    }
  };

  const handleBackToProgram = async () => {
    await waitForAllAutoSaves();
    setViewState({ screen: 'home' });
    clearAllDrafts();
    setJustCompletedSessionId(null);
    setFocusedExerciseId(null);
    setMessage(null);
  };

  const updateDraft = (exerciseId: string, nextDraft: ExerciseLogDraft) => {
    setDrafts((currentDrafts) => {
      const nextDrafts = {
        ...currentDrafts,
        [exerciseId]: nextDraft,
      };
      draftsRef.current = nextDrafts;
      return nextDrafts;
    });
  };

  const clearDraft = (exerciseId: string) => {
    setDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[exerciseId];
      draftsRef.current = nextDrafts;
      return nextDrafts;
    });
    setExerciseAutoSaveState(exerciseId, undefined);
  };

  const handleStartLog = async (
    exercise: PlannedExercise,
    existingLog?: ExerciseLog,
    preferredOptionKey?: string
  ) => {
    let currentSession = currentDaySessionRef.current;

    if (!currentSession) {
      const currentDay = selectedDayRef.current;

      if (!currentDay) {
        setMessage({
          type: 'error',
          text: 'Open a workout day before starting an exercise.',
        });
        return;
      }

      currentSession = await startWorkoutSession(currentDay);

      if (!currentSession) {
        return;
      }
    }

    const existingDraft = draftsRef.current[exercise.id];
    const nextDraft = existingLog
      ? existingDraft ?? createDraftFromLog(existingLog)
      : existingDraft ?? createExerciseDraft(exercise, preferredOptionKey ?? exercise.defaultOptionKey);

    updateDraft(exercise.id, nextDraft);
    setExerciseAutoSaveState(exercise.id, undefined);
    setFocusedExerciseId(exercise.id);
    setMessage(null);
  };

  const handleCancelEdit = (exerciseId: string) => {
    clearDraft(exerciseId);
  };

  const handleSkipExercise = async (
    exercise: PlannedExercise,
    preferredOptionKey?: string
  ) => {
    const currentSession = currentDaySessionRef.current;
    const currentDay = selectedDayRef.current;

    if (!currentSession || !currentDay) {
      setMessage({
        type: 'error',
        text: 'Start a workout session before skipping an exercise.',
      });
      return;
    }

    await waitForExerciseAutoSave(exercise.id);
    setSessionBusy(true);

    try {
      const nextLog = buildSkippedExerciseLog({
        exercise,
        session: currentSession,
        day: currentDay,
        optionKey: preferredOptionKey ?? exercise.defaultOptionKey,
      });
      const existingSessionLog = getSessionLogByExerciseId(currentSession.id, exercise.id, logsRef.current);

      if (existingSessionLog && createExerciseLogSnapshot(existingSessionLog) === createExerciseLogSnapshot(nextLog)) {
        clearDraft(exercise.id);
        setMessage({
          type: 'success',
          text: `${nextLog.performedOptionLabel} is already marked as skipped for this workout.`,
        });
        return;
      }

      const nextLogs = upsertLogInCollection(logsRef.current, nextLog);
      const result = await upsertExerciseLog(nextLog, nextLogs);

      logsRef.current = nextLogs;
      setLogs(nextLogs);
      setStorageMode(result.mode);
      clearDraft(exercise.id);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Skipped ${nextLog.performedOptionLabel} for this workout. ${result.notice}`
          : `Skipped ${nextLog.performedOptionLabel} for this workout.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not skip that exercise. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const persistExerciseLog = async (
    exercise: PlannedExercise,
    draft: ExerciseLogDraft,
    options?: {
      closeDraftOnSuccess?: boolean;
      showSuccessMessage?: boolean;
    }
  ) => {
    const currentSession = currentDaySessionRef.current;
    const currentDay = selectedDayRef.current;
    const closeDraftOnSuccess = options?.closeDraftOnSuccess ?? false;
    const showSuccessMessage = options?.showSuccessMessage ?? false;

    if (!currentSession || !currentDay) {
      if (showSuccessMessage) {
        setMessage({
          type: 'error',
          text: 'Start a workout session before saving exercise logs.',
        });
      }
      return false;
    }

    const nextLog = buildExerciseLogFromDraft({
      exercise,
      draft,
      session: currentSession,
      day: currentDay,
    });

    if (!nextLog) {
      if (showSuccessMessage) {
        setMessage({
          type: 'error',
          text: 'Enter a weight for every started set before saving.',
        });
      }
      return false;
    }

    const existingSessionLog = getSessionLogByExerciseId(currentSession.id, exercise.id, logsRef.current);

    if (existingSessionLog && createExerciseLogSnapshot(existingSessionLog) === createExerciseLogSnapshot(nextLog)) {
      if (closeDraftOnSuccess) {
        clearDraft(exercise.id);
      }
      return true;
    }

    const nextLogs = upsertLogInCollection(logsRef.current, nextLog);
    const result = await upsertExerciseLog(nextLog, nextLogs);

    logsRef.current = nextLogs;
    setLogs(nextLogs);
    setStorageMode(result.mode);

    if (closeDraftOnSuccess) {
      clearDraft(exercise.id);
    }

    if (showSuccessMessage) {
      setMessage({
        type: 'success',
        text: result.notice
          ? `Saved ${nextLog.performedOptionLabel} for this workout. ${result.notice}`
          : `Saved ${nextLog.performedOptionLabel} for this workout.`,
      });
    }

    return true;
  };

  const queueExerciseAutoSave = (exercise: PlannedExercise, draft: ExerciseLogDraft) => {
    try {
      const currentSession = currentDaySessionRef.current;
      const currentDay = selectedDayRef.current;

      if (!currentSession || !currentDay) {
        return;
      }

      const nextLog = buildExerciseLogFromDraft({
        exercise,
        draft,
        session: currentSession,
        day: currentDay,
      });

      if (!nextLog) {
        return;
      }

      const existingQueue = autoSaveQueuesRef.current[exercise.id];
      const hasPendingSave = Boolean(existingQueue?.activePromise || existingQueue?.queuedDraft);
      const existingSessionLog = getSessionLogByExerciseId(currentSession.id, exercise.id, logsRef.current);

      if (
        !hasPendingSave &&
        existingSessionLog &&
        createExerciseLogSnapshot(existingSessionLog) === createExerciseLogSnapshot(nextLog)
      ) {
        setExerciseAutoSaveState(exercise.id, 'saved');
        return;
      }

      const queue = existingQueue ?? (autoSaveQueuesRef.current[exercise.id] = {});

      queue.queuedExercise = exercise;
      queue.queuedDraft = draft;
      setExerciseAutoSaveState(exercise.id, 'saving');

      if (queue.activePromise) {
        return;
      }

      queue.activePromise = (async () => {
        while (queue.queuedExercise && queue.queuedDraft) {
          const queuedExercise = queue.queuedExercise;
          const queuedDraft = queue.queuedDraft;

          queue.queuedExercise = undefined;
          queue.queuedDraft = undefined;

          await persistExerciseLog(queuedExercise, queuedDraft);

          if (!queue.queuedExercise && draftsRef.current[queuedExercise.id]) {
            setExerciseAutoSaveState(queuedExercise.id, 'saved');
          }
        }
      })()
        .catch((error) => {
          if (draftsRef.current[exercise.id]) {
            setExerciseAutoSaveState(exercise.id, 'error');
          }
          setMessage({
            type: 'error',
            text: `Could not save your workout log. ${getErrorMessage(error)}`,
          });
        })
        .finally(() => {
          delete autoSaveQueuesRef.current[exercise.id];
        });
    } catch (error) {
      setExerciseAutoSaveState(exercise.id, 'error');
      setMessage({
        type: 'error',
        text: `Could not save your workout log. ${getErrorMessage(error)}`,
      });
    }
  };

  const handleDraftChange = (exercise: PlannedExercise, nextDraft: ExerciseLogDraft) => {
    updateDraft(exercise.id, nextDraft);

    if (!hasAllWeights(nextDraft)) {
      const hasActiveSave = Boolean(autoSaveQueuesRef.current[exercise.id]?.activePromise);

      if (!hasActiveSave) {
        setExerciseAutoSaveState(exercise.id, undefined);
      }
      return;
    }

    queueExerciseAutoSave(exercise, nextDraft);
  };

  const removeSessionLog = async (log: ExerciseLog) => {
    await waitForExerciseAutoSave(log.programExerciseId);
    setSessionBusy(true);

    try {
      const nextLogs = logs.filter((currentLog) => currentLog.id !== log.id);
      const result = await deleteExerciseLog(log.id, nextLogs);

      logsRef.current = nextLogs;
      setLogs(nextLogs);
      setStorageMode(result.mode);
      clearDraft(log.programExerciseId);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Removed that exercise from the workout. ${result.notice}`
          : 'Removed that exercise from the workout.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not remove that exercise log. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const startWorkoutSession = async (
    day: WorkoutDay,
    successPrefix = 'Started your workout',
    baseSessions: WorkoutSession[] = sessions
  ) => {
    if (getActiveSession(baseSessions)) {
      setMessage({
        type: 'error',
        text: 'Finish or discard the current workout before starting another one.',
      });
      return null;
    }

    setSessionBusy(true);

    try {
      const nextSession = createWorkoutSession(day);
      const nextSessions = [...baseSessions, nextSession];
      const result = await upsertSession(nextSession, nextSessions);

      currentDaySessionRef.current = nextSession;
      selectedDayRef.current = day;
      setSessions(nextSessions);
      setStorageMode(result.mode);
      setViewState({ screen: 'day', dayId: day.id });
      clearAllDrafts();
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `${successPrefix} for ${day.name}. ${result.notice}`
          : `${successPrefix} for ${day.name}.`,
      });
      return nextSession;
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not start that workout. ${getErrorMessage(error)}`,
      });
      return null;
    } finally {
      setSessionBusy(false);
    }
  };

  const discardWorkoutSession = async (session: WorkoutSession, successText: string) => {
    await waitForAllAutoSaves();
    setSessionBusy(true);

    try {
      const nextSessions = sessions.filter((currentSession) => currentSession.id !== session.id);
      const nextLogs = logs.filter((log) => log.sessionId !== session.id);
      const result = await deleteSession(session.id, nextSessions, nextLogs);

      setSessions(nextSessions);
      logsRef.current = nextLogs;
      setLogs(nextLogs);
      setStorageMode(result.mode);
      clearAllDrafts();
      setFocusedExerciseId(null);
      if (justCompletedSessionId === session.id) {
        setJustCompletedSessionId(null);
      }
      setMessage({
        type: 'success',
        text: result.notice ? `${successText} ${result.notice}` : successText,
      });
      return true;
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not discard that workout. ${getErrorMessage(error)}`,
      });
      return false;
    } finally {
      setSessionBusy(false);
    }
  };

  const handleStartOverSession = async (session: WorkoutSession, day: WorkoutDay) => {
    const nextSessions = sessions.filter((currentSession) => currentSession.id !== session.id);
    const discarded = await discardWorkoutSession(
      session,
      `Discarded the in-progress ${day.name} workout.`
    );

    if (!discarded) {
      return;
    }

    await startWorkoutSession(day, 'Started a fresh workout', nextSessions);
  };

  const handleDiscardAndSwitch = async (session: WorkoutSession, day: WorkoutDay) => {
    const discarded = await discardWorkoutSession(
      session,
      'Discarded the unfinished workout and opened the new day.'
    );

    if (!discarded) {
      return;
    }

    await openDayScreen(day);
  };

  const finishWorkoutSession = async () => {
    if (!currentDaySession || !selectedDay) {
      return;
    }

    if (currentDayHandledCount === 0) {
      setMessage({
        type: 'error',
        text: 'Log or skip at least one exercise before finishing the workout.',
      });
      return;
    }

    const missingCount = selectedDay.exercises.length - currentDayHandledCount;

    if (missingCount > 0) {
      setDialog({
        title: 'Finish workout?',
        message: `You handled ${currentDayHandledCount} of ${selectedDay.exercises.length} exercises. You can still finish now, or keep going before you mark the day complete.`,
        actions: [
          {
            label: 'Keep logging',
            tone: 'secondary',
            onPress: () => undefined,
          },
          {
            label: 'Finish workout',
            tone: 'primary',
            onPress: () => void completeWorkoutSession(currentDaySession),
          },
        ],
      });
      return;
    }

    await completeWorkoutSession(currentDaySession);
  };

  const cancelWorkoutSession = async () => {
    if (!currentDaySession || !selectedDay) {
      return;
    }

    if (currentDayHandledCount === 0) {
      await discardWorkoutSession(
        currentDaySession,
        `Canceled the ${selectedDay.name} workout before any exercises were handled.`
      );
      return;
    }

    setDialog({
      title: 'Cancel workout?',
      message: `This will delete the in-progress ${selectedDay.name} workout and remove the ${currentDayHandledCount} exercise entr${currentDayHandledCount === 1 ? 'y' : 'ies'} already saved in it.`,
      actions: [
        {
          label: 'Keep workout',
          tone: 'secondary',
          onPress: () => undefined,
        },
        {
          label: 'Cancel workout',
          tone: 'danger',
          onPress: () =>
            void discardWorkoutSession(
              currentDaySession,
              `Canceled the in-progress ${selectedDay.name} workout and removed its saved logs.`
            ),
        },
      ],
    });
  };

  const completeWorkoutSession = async (session: WorkoutSession) => {
    await waitForAllAutoSaves();
    setSessionBusy(true);

    try {
      const completedSession: WorkoutSession = {
        ...session,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
      const nextSessions = replaceSessionInCollection(sessions, completedSession);
      const result = await upsertSession(completedSession, nextSessions);

      setSessions(nextSessions);
      setStorageMode(result.mode);
      setJustCompletedSessionId(session.id);
      clearAllDrafts();
      setFocusedExerciseId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Marked ${session.dayName} complete. ${result.notice}`
          : `Marked ${session.dayName} complete.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not finish this workout. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const undoFinishWorkout = async () => {
    if (!justCompletedSession || !selectedDay) {
      return;
    }

    setSessionBusy(true);

    try {
      const reopenedSession: WorkoutSession = {
        ...justCompletedSession,
        status: 'in_progress',
        completedAt: undefined,
      };
      const nextSessions = replaceSessionInCollection(sessions, reopenedSession);
      const result = await upsertSession(reopenedSession, nextSessions);

      setSessions(nextSessions);
      setStorageMode(result.mode);
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Reopened ${selectedDay.name}. ${result.notice}`
          : `Reopened ${selectedDay.name}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not reopen that workout. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const handleReplaceProgram = async () => {
    setBusyAction('replace');
    setMessage(null);

    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: CSV_MIME_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.length) {
        setBusyAction(null);
        return;
      }

      const pickedAsset = pickerResult.assets[0];
      const csvText = await readPickedDocumentTextAsync(pickedAsset);
      const nextProgram = await createProgramFromCsvSource(csvText, pickedAsset.name);

      await waitForAllAutoSaves();
      const storageResult = await replaceProgramAndClearLogs(nextProgram);

      setProgram(nextProgram);
      logsRef.current = [];
      setLogs([]);
      setSessions([]);
      setStorageMode(storageResult.mode);
      setViewState({ screen: 'home' });
      clearAllDrafts();
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
      setMessage({
        type: 'success',
        text: storageResult.notice
          ? `Replaced the program with ${pickedAsset.name}, cleared all saved progress, and ${storageResult.notice.toLowerCase()}`
          : `Replaced the program with ${pickedAsset.name} and cleared all saved progress.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not replace the program. ${getErrorMessage(error)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearLogs = () => {
    if (!logs.length && !sessions.length) {
      setMessage({
        type: 'success',
        text: 'There is no saved workout progress to clear.',
      });
      return;
    }

    setDialog({
      title: 'Clear workout progress?',
      message:
        'This removes all saved sessions and exercise logs, but keeps the current workout plan and week selection.',
      actions: [
        {
          label: 'Cancel',
          tone: 'secondary',
          onPress: () => undefined,
        },
        {
          label: 'Clear progress',
          tone: 'danger',
          onPress: () => void confirmClearLogs(),
        },
      ],
    });
  };

  const confirmClearLogs = async () => {
    setBusyAction('clear-logs');
    setMessage(null);

    try {
      await waitForAllAutoSaves();
      const result = await clearLogsOnly();
      logsRef.current = [];
      setLogs([]);
      setSessions([]);
      setStorageMode(result.mode);
      clearAllDrafts();
      setJustCompletedSessionId(null);
      setFocusedExerciseId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Cleared all saved workout progress. ${result.notice}`
          : 'Cleared all saved workout progress.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not clear progress. ${getErrorMessage(error)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not open that link. ${getErrorMessage(error)}`,
      });
    }
  };

  const handlePlayVideo = (label: string, url: string, notes: string) => {
    setVideoPlayerState({
      title: label,
      url,
      notes,
    });
  };

  const completedDayCount = dayItems.filter((item) => item.status === 'completed').length;
  const isVideoModalVisible = Boolean(videoPlayerState.url);

  const renderPlanPage = () => {
    if (!program) {
      return null;
    }

    return (
      <>
        <WeekPicker
          weeks={program.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            block: week.block,
          }))}
          activeWeek={program.activeWeek}
          onSelectWeek={(weekNumber) => void handleWeekSelect(weekNumber)}
        />

        <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelOverline}>Schedule</Text>
            <Text style={styles.panelTitle}>Workout days</Text>
          </View>

          <DayList items={dayItems} onSelectDay={handleOpenDay} />
        </View>
      </>
    );
  };

  const renderManagePage = () => (
    <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelOverline}>Maintenance</Text>
        <Text style={styles.panelTitle}>Program management</Text>
        <Text style={styles.panelSubtitle}>
          Replace the workout CSV or clear your saved progress without deleting the plan.
        </Text>
      </View>

      <View style={styles.manageGrid}>
        <View style={styles.manageCard}>
          <Text style={styles.manageCardEyebrow}>Import</Text>
          <Text style={styles.manageCardTitle}>Replace the program</Text>
          <Text style={styles.manageCardBody}>
            Load a new CSV and reset workout history so the app matches the new plan from day one.
          </Text>
          <Pressable
            disabled={busyAction !== null}
            onPress={() => void handleReplaceProgram()}
            style={[styles.primaryButton, busyAction !== null ? styles.buttonDisabled : undefined]}
          >
            <Text style={styles.primaryButtonText}>
              {busyAction === 'replace' ? 'Replacing program...' : 'Replace Program'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.manageCard, styles.manageCardDanger]}>
          <Text style={styles.manageCardEyebrow}>Reset</Text>
          <Text style={styles.manageCardTitle}>Clear saved progress</Text>
          <Text style={styles.manageCardBody}>
            Remove workout sessions and exercise logs, but keep the current program and week selection.
          </Text>
          <Pressable
            disabled={busyAction !== null}
            onPress={handleClearLogs}
            style={[styles.secondaryButton, busyAction !== null ? styles.buttonDisabled : undefined]}
          >
            <Text style={styles.secondaryButtonText}>
              {busyAction === 'clear-logs' ? 'Clearing progress...' : 'Clear Logs'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.manageMeta}>Current source: {program?.sourceName ?? 'Unknown source'}</Text>
    </View>
  );

  const renderDetailHeaderCard = () => {
    if (!selectedDay || !activeWeek || !detailMode) {
      return null;
    }

    const dayStatus = getWorkoutDayStatus(selectedDay.id, sessions);
    const latestCompletedSession = selectedDayRecentSessions[0];

    return (
      <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
        <View style={styles.detailStatusRow}>
          <View style={styles.detailStatusMetaRow}>
            <Pressable style={styles.backButton} onPress={() => void handleBackToProgram()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.detailEyebrow}>
              Week {activeWeek.weekNumber} · {activeWeek.block}
            </Text>
          </View>
          <Text
            style={[
              styles.dayStatusPill,
              dayStatus === 'completed'
                ? styles.dayStatusPillCompleted
                : dayStatus === 'in_progress'
                  ? styles.dayStatusPillActive
                  : styles.dayStatusPillPending,
            ]}
          >
            {dayStatus === 'completed'
              ? 'Completed'
              : dayStatus === 'in_progress'
                ? 'In progress'
                : 'Selected'}
          </Text>
        </View>

        <Text style={[styles.detailTitle, isCompact ? styles.detailTitleCompact : undefined]}>
          {selectedDay.name}
          <Text style={styles.detailTitleDivider}> · </Text>
          <Text style={styles.detailTitleMeta}>{selectedDay.focus}</Text>
        </Text>

        <View style={styles.detailMetricRow}>
          <View style={styles.detailMetricCard}>
            <Text style={styles.detailMetricLabel}>Exercises</Text>
            <Text style={styles.detailMetricValue}>{selectedDay.exercises.length}</Text>
          </View>

          <View style={styles.detailMetricCard}>
            <Text style={styles.detailMetricLabel}>Last completed</Text>
            <Text style={styles.detailMetricValue}>
              {latestCompletedSession ? formatSessionDate(latestCompletedSession.completedAt) : 'Not yet'}
            </Text>
          </View>
        </View>

        {detailMode === 'review' ? (
          <Pressable
            disabled={sessionBusy}
            onPress={() => void startWorkoutSession(selectedDay)}
            style={[styles.primaryButton, sessionBusy ? styles.buttonDisabled : undefined]}
          >
            <Text style={styles.primaryButtonText}>Start Workout</Text>
          </Pressable>
        ) : null}

        {detailMode === 'active' && currentDaySession ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Workout in progress</Text>
            <Text style={styles.summaryBody}>
              {currentDayHandledCount} of {selectedDay.exercises.length} exercises handled.
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${selectedDay.exercises.length
                      ? (currentDayHandledCount / selectedDay.exercises.length) * 100
                      : 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.summaryMeta}>
              Started {formatSessionDateTime(currentDaySession.startedAt)}
            </Text>
            {currentDaySkippedCount > 0 ? (
              <Text style={styles.summaryMeta}>
                {currentDayLoggedCount} logged · {currentDaySkippedCount} skipped
              </Text>
            ) : null}
            <Text style={styles.summaryBody}>
              {nextExercise
                ? `Up next: ${nextExercise.options[0]?.label ?? 'Next exercise'}`
                : 'Every exercise in this workout has a saved outcome. Finish when you are ready.'}
            </Text>
            <View style={styles.actionsRow}>
              <Pressable
                disabled={sessionBusy || currentDayHandledCount === 0}
                onPress={() => void finishWorkoutSession()}
                style={[
                  styles.primaryButton,
                  (sessionBusy || currentDayHandledCount === 0) ? styles.buttonDisabled : undefined,
                ]}
              >
                <Text style={styles.primaryButtonText}>Finish Workout</Text>
              </Pressable>

              <Pressable
                disabled={sessionBusy}
                onPress={() => void cancelWorkoutSession()}
                style={[styles.secondaryButton, sessionBusy ? styles.buttonDisabled : undefined]}
              >
                <Text style={styles.secondaryButtonText}>Cancel Workout</Text>
              </Pressable>
            </View>
            {currentDayHandledCount === 0 ? (
              <Text style={styles.inlineHint}>
                Start logging or skip an exercise before finishing, or cancel this workout to delete it.
              </Text>
            ) : null}
          </View>
        ) : null}

        {detailMode === 'summary' && justCompletedSession ? (
          <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
            <Text style={styles.summaryTitle}>Workout complete</Text>
            <Text style={styles.summaryBody}>
              Finished {formatSessionDateTime(justCompletedSession.completedAt ?? justCompletedSession.startedAt)}.
            </Text>
            <Text style={styles.summaryBody}>
              You handled {currentDayHandledCount} of {selectedDay.exercises.length} exercises in this session.
            </Text>
            {currentDaySkippedCount > 0 ? (
              <Text style={styles.summaryMeta}>
                {currentDayLoggedCount} logged · {currentDaySkippedCount} skipped
              </Text>
            ) : null}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, styles.progressFillComplete, { width: '100%' }]} />
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                disabled={sessionBusy}
                onPress={() => void undoFinishWorkout()}
                style={[styles.secondaryButton, sessionBusy ? styles.buttonDisabled : undefined]}
              >
                <Text style={styles.secondaryButtonText}>Undo Finish</Text>
              </Pressable>

              <Pressable
                disabled={sessionBusy}
                onPress={() => void handleBackToProgram()}
                style={[styles.primaryButton, sessionBusy ? styles.buttonDisabled : undefined]}
              >
                <Text style={styles.primaryButtonText}>Back to Week</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  if (bootstrapState === 'loading') {
    return <LoadingScreen />;
  }

  if (bootstrapState === 'error' || !program || !activeWeek) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top']} style={styles.bootstrapScreen}>
          <StatusBar style="dark" />
          <View style={styles.bootstrapCard}>
            <Text style={styles.bootstrapTitle}>Unable to load the app</Text>
            <Text style={styles.bootstrapBody}>
              {bootstrapError ?? 'The saved workout data is missing or invalid. Try again to reload it.'}
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => void bootstrapApp()}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={styles.app}>
        <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.page,
              isCompact ? styles.pageCompact : undefined,
            ]}
          >
            {viewState.screen === 'home' ? (
              <>
                <View style={styles.rootHeader}>
                  <View style={[styles.rootHeaderTopRow, isCompact ? styles.rootHeaderTopRowCompact : undefined]}>
                    <Text
                      style={[styles.rootHeaderTitle, isCompact ? styles.rootHeaderTitleCompact : undefined]}
                    >
                      Training
                    </Text>
                    <View style={styles.rootHeaderChip}>
                      <Text style={styles.rootHeaderChipText}>Week {activeWeek.weekNumber}</Text>
                    </View>
                  </View>
                </View>

                {message ? <MessageBanner message={message} /> : null}

                {renderPlanPage()}
              </>
            ) : selectedDay ? (
              <>
                {message ? <MessageBanner message={message} /> : null}

                {renderDetailHeaderCard()}

                {selectedDayRecentSessions.length ? (
                  <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelOverline}>History</Text>
                      <Text style={styles.panelTitle}>Recent sessions</Text>
                      <Text style={styles.panelSubtitle}>
                        The latest completed workouts for this exact day.
                      </Text>
                    </View>

                    <View style={styles.sessionHistoryList}>
                      {selectedDayRecentSessions.map((session) => {
                        const loggedCount = countLoggedExercisesInSession(session.id, logs);
                        const handledCount = countHandledExercisesInSession(session.id, logs);
                        const skippedCount = Math.max(0, handledCount - loggedCount);

                        return (
                          <View key={session.id} style={styles.sessionHistoryCard}>
                            <Text style={styles.sessionHistoryTitle}>
                              {formatSessionDate(session.completedAt ?? session.startedAt)}
                            </Text>
                            <Text style={styles.sessionHistoryBody}>
                              {skippedCount > 0
                                ? `${loggedCount} logged · ${skippedCount} skipped`
                                : `${loggedCount} exercises logged`}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.exerciseList}>
                  {selectedDay.exercises.map((exercise) => {
                    const sessionForCard = currentDaySession ?? justCompletedSession;
                    const sessionLog = sessionForCard
                      ? getSessionLogByExerciseId(sessionForCard.id, exercise.id, logs)
                      : undefined;
                    const draft = drafts[exercise.id];
                    const selectedOptionKey =
                      draft?.selectedOptionKey ??
                      sessionLog?.performedOptionKey ??
                      exercise.defaultOptionKey;
                    const selectedOption =
                      getExerciseOption(exercise, selectedOptionKey) ?? exercise.options[0];
                    const latestLog = latestLogsByHistoryKey.get(selectedOption.historyKey);

                    return (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        focus={selectedDay.focus}
                        mode={detailMode ?? 'review'}
                        draft={draft}
                        autoSaveState={autoSaveStates[exercise.id]}
                        latestLog={latestLog}
                        sessionLog={sessionLog}
                        isNextUp={detailMode === 'active' && nextExercise?.id === exercise.id}
                        onDraftChange={(nextDraft) => handleDraftChange(exercise, nextDraft)}
                        onPlayVideo={handlePlayVideo}
                        onOpenUrl={handleOpenUrl}
                        onStartLog={(preferredOptionKey) =>
                          void handleStartLog(exercise, sessionLog, preferredOptionKey)
                        }
                        onSkipExercise={(preferredOptionKey) =>
                          void handleSkipExercise(exercise, preferredOptionKey)
                        }
                        onCancelEdit={() => handleCancelEdit(exercise.id)}
                        onEditLog={() => sessionLog && void handleStartLog(exercise, sessionLog)}
                        onRemoveLog={() =>
                          sessionLog
                            ? setDialog({
                                title: 'Clear this exercise entry?',
                                message:
                                  'This removes the saved state for this exercise from the current workout. You can log it again or skip it any time before you finish.',
                                actions: [
                                  {
                                    label: 'Cancel',
                                    tone: 'secondary',
                                    onPress: () => undefined,
                                  },
                                  {
                                    label: 'Clear entry',
                                    tone: 'danger',
                                    onPress: () => void removeSessionLog(sessionLog),
                                  },
                                ],
                              })
                            : undefined
                        }
                      />
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

        <ActionDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          disabled={sessionBusy || busyAction !== null}
        />

        <Modal
          animationType="slide"
          presentationStyle="fullScreen"
          visible={Boolean(focusedExercise && selectedDay) && !isVideoModalVisible}
          onRequestClose={() => setFocusedExerciseId(null)}
        >
          <SafeAreaProvider>
            <View style={styles.focusedExerciseModal}>
              <StatusBar style="dark" />
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.focusedExerciseModal}
              >
                <View style={styles.focusedExerciseShell}>
                  {focusedExercise && selectedDay ? (
                    <ExerciseFocusScreen
                      exercise={focusedExercise}
                      draft={
                        drafts[focusedExercise.id] ??
                        createExerciseDraft(focusedExercise, focusedExercise.defaultOptionKey)
                      }
                      onDraftChange={(nextDraft) => handleDraftChange(focusedExercise, nextDraft)}
                      onBack={() => setFocusedExerciseId(null)}
                      onPlayVideo={handlePlayVideo}
                    />
                  ) : null}
                </View>
              </KeyboardAvoidingView>
            </View>
          </SafeAreaProvider>
        </Modal>

        <YouTubePlayerModal
          visible={Boolean(videoPlayerState.url)}
          videoTitle={videoPlayerState.title}
          videoUrl={videoPlayerState.url}
          videoNotes={videoPlayerState.notes}
          onClose={() =>
            setVideoPlayerState({
              title: '',
              url: null,
              notes: '',
            })
          }
          onOpenInYouTube={() =>
            videoPlayerState.url ? void handleOpenUrl(videoPlayerState.url) : undefined
          }
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function MessageBanner({ message }: { message: AppMessage }) {
  const isError = message.type === 'error';

  return (
    <View
      style={[
        styles.messageBanner,
        isError ? styles.messageBannerError : styles.messageBannerSuccess,
      ]}
    >
      <Text style={isError ? styles.messageTitleError : styles.messageTitleSuccess}>
        {isError ? 'Something went wrong' : 'Updated'}
      </Text>
      <Text style={isError ? styles.messageBodyError : styles.messageBodySuccess}>
        {message.text}
      </Text>
    </View>
  );
}

function LoadingScreen() {
  const dotValues = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const ringRotation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const dotAnimations = dotValues.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay((dotValues.length - index - 1) * 140),
        ])
      )
    );

    const ringAnimation = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    dotAnimations.forEach((animation) => animation.start());
    ringAnimation.start();

    return () => {
      dotAnimations.forEach((animation) => animation.stop());
      ringAnimation.stop();
      dotValues.forEach((value) => value.setValue(0));
      ringRotation.setValue(0);
    };
  }, [dotValues, ringRotation]);

  const ringSpin = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={styles.bootstrapScreen}>
        <StatusBar style="dark" />
        <View style={styles.loadingShell}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingArt}>
              <Animated.View style={[styles.loadingRing, { transform: [{ rotate: ringSpin }] }]} />
              <View style={styles.loadingCenter} />
              <View style={styles.loadingDotRow}>
                {dotValues.map((value, index) => {
                  const scale = value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.78, 1.12],
                  });
                  const opacity = value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  });

                  return (
                    <Animated.View
                      key={index}
                      style={[
                        styles.loadingDot,
                        {
                          opacity,
                          transform: [{ scale }],
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ActionDialog({
  dialog,
  onClose,
  disabled,
}: {
  dialog: DialogState | null;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <Modal transparent visible={Boolean(dialog)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <Text style={styles.dialogTitle}>{dialog?.title}</Text>
          <Text style={styles.dialogBody}>{dialog?.message}</Text>

          <View style={styles.dialogActions}>
            {dialog?.actions.map((action) => (
              <Pressable
                key={action.label}
                disabled={disabled}
                onPress={() => {
                  onClose();
                  void action.onPress();
                }}
                style={[
                  styles.dialogButton,
                  action.tone === 'primary'
                    ? styles.dialogButtonPrimary
                    : action.tone === 'danger'
                      ? styles.dialogButtonDanger
                      : styles.dialogButtonSecondary,
                  disabled ? styles.buttonDisabled : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    action.tone === 'primary'
                      ? styles.dialogButtonTextPrimary
                      : action.tone === 'danger'
                        ? styles.dialogButtonTextDanger
                        : styles.dialogButtonTextSecondary,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

async function createProgramFromCsvSource(csvText: string, sourceName: string) {
  return parseWorkoutProgram(csvText, sourceName);
}

function getExerciseOption(exercise: PlannedExercise, optionKey: string): ExerciseOption | undefined {
  return exercise.options.find((option) => option.key === optionKey);
}

function buildExerciseLogFromDraft({
  exercise,
  draft,
  session,
  day,
}: {
  exercise: PlannedExercise;
  draft: ExerciseLogDraft;
  session: WorkoutSession;
  day: WorkoutDay;
}): ExerciseLog | null {
  const selectedOption = getExerciseOption(exercise, draft.selectedOptionKey);

  if (!selectedOption) {
    throw new Error('The selected movement variation could not be found.');
  }

  if (!hasAllWeights(draft)) {
    return null;
  }

  const startedSetLogs = getStartedSetLogs(draft);

  return {
    id: createSessionLogId(session.id, exercise.id),
    sessionId: session.id,
    dayId: day.id,
    programExerciseId: exercise.id,
    performedOptionKey: selectedOption.key,
    performedOptionLabel: selectedOption.label,
    historyKey: selectedOption.historyKey,
    weekNumber: exercise.weekNumber,
    dayName: exercise.dayName,
    loggedAt: new Date().toISOString(),
    exerciseNote: normalizeOptionalText(draft.exerciseNote),
    setLogs: startedSetLogs.map((setLog) => ({
      setNumber: setLog.setNumber,
      weight: setLog.weight.trim(),
      repsCompleted: normalizeOptionalText(setLog.repsCompleted),
    })),
  } satisfies ExerciseLog;
}

function buildSkippedExerciseLog({
  exercise,
  session,
  day,
  optionKey,
}: {
  exercise: PlannedExercise;
  session: WorkoutSession;
  day: WorkoutDay;
  optionKey: string;
}): ExerciseLog {
  const selectedOption = getExerciseOption(exercise, optionKey);

  if (!selectedOption) {
    throw new Error('The selected movement variation could not be found.');
  }

  return {
    id: createSessionLogId(session.id, exercise.id),
    sessionId: session.id,
    dayId: day.id,
    programExerciseId: exercise.id,
    performedOptionKey: selectedOption.key,
    performedOptionLabel: selectedOption.label,
    historyKey: selectedOption.historyKey,
    weekNumber: exercise.weekNumber,
    dayName: exercise.dayName,
    loggedAt: new Date().toISOString(),
    exerciseNote: 'Skipped',
    setLogs: [],
  } satisfies ExerciseLog;
}

function createExerciseLogSnapshot(log: ExerciseLog) {
  return JSON.stringify({
    id: log.id,
    programExerciseId: log.programExerciseId,
    dayId: log.dayId ?? null,
    sessionId: log.sessionId ?? null,
    performedOptionKey: log.performedOptionKey,
    performedOptionLabel: log.performedOptionLabel,
    historyKey: log.historyKey,
    weekNumber: log.weekNumber,
    dayName: log.dayName,
    exerciseNote: log.exerciseNote ?? null,
    setLogs: log.setLogs.map((setLog) => ({
      setNumber: setLog.setNumber,
      weight: setLog.weight,
      repsCompleted: setLog.repsCompleted ?? null,
    })),
  });
}

function hasAllWeights(draft: ExerciseLogDraft) {
  const startedSetLogs = getStartedSetLogs(draft);
  return startedSetLogs.length > 0 && startedSetLogs.every((setLog) => setLog.weight.trim().length > 0);
}

function getStartedSetLogs(draft: ExerciseLogDraft) {
  return draft.setLogs.filter(
    (setLog) => setLog.weight.trim().length > 0 || setLog.repsCompleted.trim().length > 0
  );
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createExerciseDraft(exercise: PlannedExercise, optionKey: string): ExerciseLogDraft {
  return {
    selectedOptionKey: optionKey,
    setLogs: [createEmptySetDraft(1)],
    completedSetNumbers: [],
    skippedSetNumbers: [],
    exerciseNote: '',
  };
}

function createDraftFromLog(log: ExerciseLog): ExerciseLogDraft {
  return {
    selectedOptionKey: log.performedOptionKey,
    setLogs:
      log.setLogs.length > 0
        ? log.setLogs.map((setLog) => ({
            setNumber: setLog.setNumber,
            weight: setLog.weight,
            repsCompleted: setLog.repsCompleted ?? '',
          }))
        : [createEmptySetDraft(1)],
    completedSetNumbers: log.setLogs.map((setLog) => setLog.setNumber),
    skippedSetNumbers: [],
    exerciseNote: log.exerciseNote ?? '',
  };
}

function createEmptySetDraft(setNumber: number): ExerciseSetDraft {
  return {
    setNumber,
    weight: '',
    repsCompleted: '',
  };
}

function createWorkoutSession(day: WorkoutDay): WorkoutSession {
  const timestamp = new Date().toISOString();

  return {
    id: `${day.id}:${Date.now()}`,
    dayId: day.id,
    dayName: day.name,
    weekNumber: day.weekNumber,
    status: 'in_progress',
    startedAt: timestamp,
    createdAt: timestamp,
  };
}

function createSessionLogId(sessionId: string, exerciseId: string) {
  return `${sessionId}:${exerciseId}`;
}

function replaceSessionInCollection(
  currentSessions: WorkoutSession[],
  nextSession: WorkoutSession
) {
  return currentSessions.map((session) =>
    session.id === nextSession.id ? nextSession : session
  );
}

function upsertLogInCollection(currentLogs: ExerciseLog[], nextLog: ExerciseLog) {
  const existingIndex = currentLogs.findIndex((log) => log.id === nextLog.id);

  if (existingIndex === -1) {
    return [...currentLogs, nextLog];
  }

  return currentLogs.map((log) => (log.id === nextLog.id ? nextLog : log));
}

function findWorkoutDayById(program: WorkoutProgram, dayId: string) {
  for (const week of program.weeks) {
    const matchingDay = week.days.find((day) => day.id === dayId);

    if (matchingDay) {
      return matchingDay;
    }
  }

  return null;
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

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoider: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
  },
  page: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 20,
  },
  pageCompact: {
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  bootstrapScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  bootstrapCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  bootstrapTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  bootstrapBody: {
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 28,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 6,
  },
  loadingArt: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 6,
    borderColor: theme.colors.accentSoft,
    borderTopColor: theme.colors.accent,
    borderRightColor: theme.colors.accent,
  },
  loadingCenter: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: theme.colors.accentMuted,
  },
  loadingDotRow: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 10,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  focusedExerciseModal: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
  },
  focusedExerciseShell: {
    flex: 1,
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 0,
  },
  heroCard: {
    overflow: 'hidden',
    backgroundColor: theme.colors.heroSurface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  rootHeader: {
    gap: 14,
    paddingTop: 8,
  },
  rootHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  rootHeaderTopRowCompact: {
    alignItems: 'center',
  },
  rootHeaderChip: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rootHeaderChipText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rootHeaderTitle: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  rootHeaderTitleCompact: {
    fontSize: 31,
  },
  headerActionButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  headerActionButtonCompact: {
    alignSelf: 'flex-start',
  },
  headerActionButtonText: {
    color: theme.colors.accentText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  surfaceCompact: {
    padding: 16,
  },
  heroOrbSecondary: {
    position: 'absolute',
    left: -30,
    bottom: -40,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: 'rgba(22, 33, 59, 0.03)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heroTopRowCompact: {
    gap: 10,
  },
  heroTitle: {
    color: theme.colors.heroText,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.7,
    flex: 1,
  },
  heroTitleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  heroCompletionPill: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroCompletionText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 22,
    gap: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  panelHeader: {
    gap: 6,
  },
  panelOverline: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  panelSubtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  nextUpCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 10,
  },
  nextUpEyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextUpTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  nextUpBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  actionsRow: {
    gap: 12,
  },
  manageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  manageCard: {
    flexGrow: 1,
    minWidth: 240,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 10,
  },
  manageCardDanger: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accentSoft,
  },
  manageCardEyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manageCardTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  manageCardBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  manageMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryButtonText: {
    color: theme.colors.accentText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  messageBanner: {
    borderRadius: theme.radii.lg,
    padding: 18,
    gap: 6,
    borderLeftWidth: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  messageBannerSuccess: {
    backgroundColor: theme.colors.successSurface,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    borderLeftColor: theme.colors.successText,
  },
  messageBannerError: {
    backgroundColor: theme.colors.errorSurface,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    borderLeftColor: theme.colors.errorText,
  },
  messageTitleSuccess: {
    color: theme.colors.successText,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  messageTitleError: {
    color: theme.colors.errorText,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  messageBodySuccess: {
    color: theme.colors.successText,
    fontSize: 14,
    lineHeight: 22,
  },
  messageBodyError: {
    color: theme.colors.errorText,
    fontSize: 14,
    lineHeight: 22,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailStatusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  detailEyebrow: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  dayStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    overflow: 'hidden',
  },
  dayStatusPillPending: {
    backgroundColor: theme.colors.canvas,
    color: theme.colors.muted,
  },
  dayStatusPillActive: {
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.accentStrong,
  },
  dayStatusPillCompleted: {
    backgroundColor: theme.colors.accentMuted,
    color: theme.colors.accentStrong,
  },
  detailTitle: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  detailTitleCompact: {
    fontSize: 28,
  },
  detailTitleDivider: {
    color: theme.colors.muted,
    fontSize: 22,
    fontWeight: '700',
  },
  detailTitleMeta: {
    color: theme.colors.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  detailMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailMetricCard: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
  },
  detailMetricLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailMetricValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
  },
  summaryCardSuccess: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accentSoft,
  },
  summaryTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryMeta: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: theme.colors.canvas,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  progressFillComplete: {
    backgroundColor: theme.colors.successText,
  },
  inlineHint: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  sessionHistoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sessionHistoryCard: {
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
    gap: 6,
  },
  sessionHistoryTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sessionHistoryBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  exerciseList: {
    gap: 18,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(22, 33, 59, 0.24)',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  dialogTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  dialogBody: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  dialogActions: {
    gap: 10,
  },
  dialogButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dialogButtonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  dialogButtonSecondary: {
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dialogButtonDanger: {
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
  },
  dialogButtonText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  dialogButtonTextPrimary: {
    color: theme.colors.accentText,
  },
  dialogButtonTextSecondary: {
    color: theme.colors.text,
  },
  dialogButtonTextDanger: {
    color: theme.colors.errorText,
  },
});
