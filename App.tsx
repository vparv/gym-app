import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { DayList, type WorkoutDayListItem } from './src/components/DayList';
import { ExerciseCard } from './src/components/ExerciseCard';
import { YouTubePlayerModal } from './src/components/YouTubePlayerModal';
import { WeekPicker } from './src/components/WeekPicker';
import { parseWorkoutProgram } from './src/lib/csv';
import { buildLatestLogsByHistoryKey } from './src/lib/history';
import { loadBundledCsvTextAsync, readPickedDocumentTextAsync } from './src/lib/program-source';
import {
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
  const [message, setMessage] = React.useState<AppMessage | null>(null);
  const [busyAction, setBusyAction] = React.useState<'replace' | 'clear-logs' | null>(null);
  const [storageMode, setStorageMode] = React.useState<'supabase'>('supabase');
  const [sessionBusy, setSessionBusy] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [justCompletedSessionId, setJustCompletedSessionId] = React.useState<string | null>(null);
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
      setDrafts({});
      setJustCompletedSessionId(null);
    }
  }, [selectedDay, viewState]);

  async function bootstrapApp() {
    setBootstrapState('loading');
    setBootstrapError(null);
    setMessage(null);

    try {
      const { program: storedProgram, logs: storedLogs, sessions: storedSessions, notice, mode } =
        await loadAppData();

      if (storedProgram) {
        setProgram(storedProgram);
        setLogs(storedLogs);
        setSessions(storedSessions);
        setStorageMode(mode);
        setViewState({ screen: 'home' });
        setDrafts({});
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
      setLogs([]);
      setSessions([]);
      setStorageMode(result.mode);
      setViewState({ screen: 'home' });
      setDrafts({});
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

      setViewState({ screen: 'day', dayId: day.id });
      setDrafts({});
      setJustCompletedSessionId(null);
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
      setDialog({
        title: 'Workout already in progress',
        message:
          'You already have this workout open. Resume it where you left off, or discard the current session and start over.',
        actions: [
          {
            label: 'Resume workout',
            tone: 'primary',
            onPress: () => void openDayScreen(day),
          },
          {
            label: 'Start over',
            tone: 'danger',
            onPress: () => void handleStartOverSession(activeSession, day),
          },
          {
            label: 'Cancel',
            tone: 'secondary',
            onPress: () => undefined,
          },
        ],
      });
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

  const handleBackToProgram = () => {
    setViewState({ screen: 'home' });
    setDrafts({});
    setJustCompletedSessionId(null);
    setMessage(null);
  };

  const updateDraft = (exerciseId: string, nextDraft: ExerciseLogDraft) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [exerciseId]: nextDraft,
    }));
  };

  const clearDraft = (exerciseId: string) => {
    setDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[exerciseId];
      return nextDrafts;
    });
  };

  const handleStartLog = (
    exercise: PlannedExercise,
    existingLog?: ExerciseLog,
    preferredOptionKey?: string
  ) => {
    const nextDraft = existingLog
      ? createDraftFromLog(existingLog)
      : createExerciseDraft(exercise, preferredOptionKey ?? exercise.defaultOptionKey);

    updateDraft(exercise.id, nextDraft);
    setMessage(null);
  };

  const handleCancelEdit = (exerciseId: string) => {
    clearDraft(exerciseId);
  };

  const saveExerciseLog = async (exercise: PlannedExercise, draft: ExerciseLogDraft) => {
    if (!currentDaySession || !selectedDay) {
      setMessage({
        type: 'error',
        text: 'Start a workout session before saving exercise logs.',
      });
      return;
    }

    const selectedOption = getExerciseOption(exercise, draft.selectedOptionKey);

    if (!selectedOption) {
      setMessage({
        type: 'error',
        text: 'The selected movement variation could not be found.',
      });
      return;
    }

    if (!hasAllWeights(draft)) {
      setMessage({
        type: 'error',
        text: 'Enter a weight for every started set before saving.',
      });
      return;
    }

    setSessionBusy(true);

    try {
      const startedSetLogs = getStartedSetLogs(draft);
      const nextLog: ExerciseLog = {
        id: createSessionLogId(currentDaySession.id, exercise.id),
        sessionId: currentDaySession.id,
        dayId: selectedDay.id,
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
      };

      const nextLogs = upsertLogInCollection(logs, nextLog);
      const result = await upsertExerciseLog(nextLog, nextLogs);

      setLogs(nextLogs);
      setStorageMode(result.mode);
      clearDraft(exercise.id);
      setMessage({
        type: 'success',
        text: result.notice
          ? `Saved ${selectedOption.label} for this workout. ${result.notice}`
          : `Saved ${selectedOption.label} for this workout.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not save your workout log. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const removeSessionLog = async (log: ExerciseLog) => {
    setSessionBusy(true);

    try {
      const nextLogs = logs.filter((currentLog) => currentLog.id !== log.id);
      const result = await deleteExerciseLog(log.id, nextLogs);

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
      return;
    }

    setSessionBusy(true);

    try {
      const nextSession = createWorkoutSession(day);
      const nextSessions = [...baseSessions, nextSession];
      const result = await upsertSession(nextSession, nextSessions);

      setSessions(nextSessions);
      setStorageMode(result.mode);
      setViewState({ screen: 'day', dayId: day.id });
      setDrafts({});
      setJustCompletedSessionId(null);
      setMessage({
        type: 'success',
        text: result.notice
          ? `${successPrefix} for ${day.name}. ${result.notice}`
          : `${successPrefix} for ${day.name}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not start that workout. ${getErrorMessage(error)}`,
      });
    } finally {
      setSessionBusy(false);
    }
  };

  const discardWorkoutSession = async (session: WorkoutSession, successText: string) => {
    setSessionBusy(true);

    try {
      const nextSessions = sessions.filter((currentSession) => currentSession.id !== session.id);
      const nextLogs = logs.filter((log) => log.sessionId !== session.id);
      const result = await deleteSession(session.id, nextSessions, nextLogs);

      setSessions(nextSessions);
      setLogs(nextLogs);
      setStorageMode(result.mode);
      setDrafts({});
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

    if (currentDayLoggedCount === 0) {
      setMessage({
        type: 'error',
        text: 'Log at least one exercise before finishing the workout.',
      });
      return;
    }

    const missingCount = selectedDay.exercises.length - currentDayLoggedCount;

    if (missingCount > 0) {
      setDialog({
        title: 'Finish workout?',
        message: `You logged ${currentDayLoggedCount} of ${selectedDay.exercises.length} exercises. You can still finish now, or keep logging before you mark the day complete.`,
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

    if (currentDayLoggedCount === 0) {
      await discardWorkoutSession(
        currentDaySession,
        `Canceled the ${selectedDay.name} workout before any exercises were logged.`
      );
      return;
    }

    setDialog({
      title: 'Cancel workout?',
      message: `This will delete the in-progress ${selectedDay.name} workout and remove the ${currentDayLoggedCount} exercise log${currentDayLoggedCount === 1 ? '' : 's'} already saved in it.`,
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
      setDrafts({});
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

      const storageResult = await replaceProgramAndClearLogs(nextProgram);

      setProgram(nextProgram);
      setLogs([]);
      setSessions([]);
      setStorageMode(storageResult.mode);
      setViewState({ screen: 'home' });
      setDrafts({});
      setJustCompletedSessionId(null);
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
      const result = await clearLogsOnly();
      setLogs([]);
      setSessions([]);
      setStorageMode(result.mode);
      setDrafts({});
      setJustCompletedSessionId(null);
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

  const renderDetailHeaderCard = () => {
    if (!selectedDay || !activeWeek || !detailMode) {
      return null;
    }

    const dayStatus = getWorkoutDayStatus(selectedDay.id, sessions);
    const latestCompletedSession = selectedDayRecentSessions[0];

    return (
      <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
        <View style={styles.detailStatusRow}>
          <Text style={styles.detailEyebrow}>
            Week {activeWeek.weekNumber} · {activeWeek.block}
          </Text>
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
        </Text>
        <Text style={styles.detailSubtitle}>{selectedDay.focus}</Text>

        {detailMode === 'review' ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ready to train</Text>
            <Text style={styles.summaryBody}>
              {latestCompletedSession
                ? `Last completed ${formatSessionDate(latestCompletedSession.completedAt)}. Start a new session when you are ready.`
                : 'Start a workout session when you want to log this day. Nothing will be marked complete until you finish it yourself.'}
            </Text>
            <Pressable
              disabled={sessionBusy}
              onPress={() => void startWorkoutSession(selectedDay)}
              style={[styles.primaryButton, sessionBusy ? styles.buttonDisabled : undefined]}
            >
              <Text style={styles.primaryButtonText}>Start Workout</Text>
            </Pressable>
          </View>
        ) : null}

        {detailMode === 'active' && currentDaySession ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Workout in progress</Text>
            <Text style={styles.summaryBody}>
              {currentDayLoggedCount} of {selectedDay.exercises.length} exercises logged.
            </Text>
            <Text style={styles.summaryMeta}>
              Started {formatSessionDateTime(currentDaySession.startedAt)}
            </Text>
            <Text style={styles.summaryBody}>
              {nextExercise
                ? `Up next: ${nextExercise.options[0]?.label ?? 'Next exercise'}`
                : 'Everything in this workout has a log. Finish when you are ready.'}
            </Text>
            <View style={styles.actionsRow}>
              <Pressable
                disabled={sessionBusy || currentDayLoggedCount === 0}
                onPress={() => void finishWorkoutSession()}
                style={[
                  styles.primaryButton,
                  (sessionBusy || currentDayLoggedCount === 0) ? styles.buttonDisabled : undefined,
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
            {currentDayLoggedCount === 0 ? (
              <Text style={styles.inlineHint}>
                Log at least one exercise before finishing, or cancel this workout to delete it.
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
              You logged {currentDayLoggedCount} of {selectedDay.exercises.length} exercises in this session.
            </Text>
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
                onPress={handleBackToProgram}
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
    return (
      <SafeAreaView style={styles.bootstrapScreen}>
        <StatusBar style="dark" />
        <View style={styles.bootstrapCard}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={styles.bootstrapTitle}>Loading your program</Text>
          <Text style={styles.bootstrapBody}>
            Restoring your program, workout history, and session progress.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (bootstrapState === 'error' || !program || !activeWeek) {
    return (
      <SafeAreaView style={styles.bootstrapScreen}>
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
    );
  }

  return (
    <SafeAreaView style={styles.app}>
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
          <View style={[styles.page, isCompact ? styles.pageCompact : undefined]}>
            {viewState.screen === 'home' ? (
              <>
                <View style={[styles.heroCard, isCompact ? styles.surfaceCompact : undefined]}>
                  <View style={styles.heroMetaCard}>
                    <Text style={styles.heroMetaLabel}>Current block</Text>
                    <Text style={styles.heroMetaValue}>{activeWeek.block}</Text>
                    <Text style={styles.heroMetaHint}>
                      {activeWeek.days.length} workout days in week {activeWeek.weekNumber}
                    </Text>
                  </View>
                </View>

                {message ? <MessageBanner message={message} /> : null}

                <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Choose your week</Text>
                    <Text style={styles.panelSubtitle}>
                      Your current week is saved automatically. You can change it whenever you need.
                    </Text>
                  </View>

                  <WeekPicker
                    weeks={program.weeks.map((week) => ({
                      weekNumber: week.weekNumber,
                      block: week.block,
                    }))}
                    activeWeek={program.activeWeek}
                    onSelectWeek={(weekNumber) => void handleWeekSelect(weekNumber)}
                  />
                </View>

                <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Next up</Text>
                    {activeSession && currentWorkoutDay ? (
                      <Text style={styles.panelSubtitle}>
                        Workout in progress: Week {activeSession.weekNumber} {currentWorkoutDay.name}.
                      </Text>
                    ) : nextUpDay ? (
                      <Text style={styles.panelSubtitle}>
                        Suggested next day: {nextUpDay.name}. You can still pick any day you want.
                      </Text>
                    ) : (
                      <Text style={styles.panelSubtitle}>This week is complete.</Text>
                    )}
                  </View>

                  <View style={styles.nextUpCard}>
                    {activeSession && currentWorkoutDay ? (
                      <>
                        <Text style={styles.nextUpTitle}>
                          Resume {currentWorkoutDay.name}
                        </Text>
                        <Text style={styles.nextUpBody}>
                          Started {formatSessionDateTime(activeSession.startedAt)}.
                        </Text>
                        <Pressable onPress={() => void openDayScreen(currentWorkoutDay)} style={styles.primaryButton}>
                          <Text style={styles.primaryButtonText}>Open Current Workout</Text>
                        </Pressable>
                      </>
                    ) : nextUpDay ? (
                      <>
                        <Text style={styles.nextUpTitle}>{nextUpDay.name}</Text>
                        <Text style={styles.nextUpBody}>{nextUpDay.focus}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.nextUpTitle}>Week complete</Text>
                        <Text style={styles.nextUpBody}>
                          Every day in this week has a completed workout session.
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Workout days</Text>
                    <Text style={styles.panelSubtitle}>
                      Tap any day to review it. Completed days show the latest finish date.
                    </Text>
                  </View>

                  <DayList items={dayItems} onSelectDay={handleOpenDay} />
                </View>

                <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Program management</Text>
                    <Text style={styles.panelSubtitle}>
                      Replace the workout CSV or clear your saved progress without deleting the plan.
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      disabled={busyAction !== null}
                      onPress={() => void handleReplaceProgram()}
                      style={[
                        styles.primaryButton,
                        busyAction !== null ? styles.buttonDisabled : undefined,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {busyAction === 'replace' ? 'Replacing program...' : 'Replace Program'}
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={busyAction !== null}
                      onPress={handleClearLogs}
                      style={[
                        styles.secondaryButton,
                        busyAction !== null ? styles.buttonDisabled : undefined,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {busyAction === 'clear-logs' ? 'Clearing progress...' : 'Clear Logs'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : selectedDay ? (
              <>
                <View style={styles.detailHeader}>
                  <Pressable style={styles.backButton} onPress={handleBackToProgram}>
                    <Text style={styles.backButtonText}>Back to Week</Text>
                  </Pressable>
                </View>

                {message ? <MessageBanner message={message} /> : null}

                {renderDetailHeaderCard()}

                {selectedDayRecentSessions.length ? (
                  <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>Recent sessions</Text>
                      <Text style={styles.panelSubtitle}>
                        The latest completed workouts for this exact day.
                      </Text>
                    </View>

                    <View style={styles.sessionHistoryList}>
                      {selectedDayRecentSessions.map((session) => (
                        <View key={session.id} style={styles.sessionHistoryCard}>
                          <Text style={styles.sessionHistoryTitle}>
                            {formatSessionDate(session.completedAt ?? session.startedAt)}
                          </Text>
                          <Text style={styles.sessionHistoryBody}>
                            {countLoggedExercisesInSession(session.id, logs)} exercises logged
                          </Text>
                        </View>
                      ))}
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
                        latestLog={latestLog}
                        sessionLog={sessionLog}
                        isNextUp={detailMode === 'active' && nextExercise?.id === exercise.id}
                        onDraftChange={(nextDraft) => updateDraft(exercise.id, nextDraft)}
                        onPlayVideo={handlePlayVideo}
                        onOpenUrl={handleOpenUrl}
                        onStartLog={(preferredOptionKey) =>
                          handleStartLog(exercise, sessionLog, preferredOptionKey)
                        }
                        onSave={() =>
                          void saveExerciseLog(
                            exercise,
                            draft ?? createExerciseDraft(exercise, exercise.defaultOptionKey)
                          )
                        }
                        onCancelEdit={() => handleCancelEdit(exercise.id)}
                        onEditLog={() => sessionLog && handleStartLog(exercise, sessionLog)}
                        onRemoveLog={() =>
                          sessionLog
                            ? setDialog({
                                title: 'Remove this exercise log?',
                                message:
                                  'This removes the exercise from the current workout session. You can log it again any time before you finish.',
                                actions: [
                                  {
                                    label: 'Cancel',
                                    tone: 'secondary',
                                    onPress: () => undefined,
                                  },
                                  {
                                    label: 'Remove log',
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
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 18,
  },
  pageCompact: {
    paddingHorizontal: 12,
    paddingVertical: 18,
    gap: 14,
  },
  bootstrapScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  bootstrapCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    gap: 12,
    alignItems: 'center',
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
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
  },
  surfaceCompact: {
    padding: 16,
  },
  heroMetaCard: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radii.lg,
    padding: 18,
    gap: 6,
  },
  heroMetaLabel: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroMetaValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  heroMetaHint: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 16,
  },
  panelHeader: {
    gap: 6,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  nextUpCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 10,
  },
  nextUpTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  nextUpBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  actionsRow: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: theme.colors.accentText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  messageBanner: {
    borderRadius: theme.radii.lg,
    padding: 16,
    gap: 4,
  },
  messageBannerSuccess: {
    backgroundColor: theme.colors.successSurface,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  messageBannerError: {
    backgroundColor: theme.colors.errorSurface,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
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
  detailHeader: {
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailEyebrow: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
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
    color: theme.colors.accent,
  },
  dayStatusPillCompleted: {
    backgroundColor: theme.colors.successSurface,
    color: theme.colors.successText,
  },
  detailTitle: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  detailTitleCompact: {
    fontSize: 28,
  },
  detailSubtitle: {
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 10,
  },
  summaryCardSuccess: {
    backgroundColor: theme.colors.successSurface,
    borderColor: theme.colors.successBorder,
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
  inlineHint: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  sessionHistoryList: {
    gap: 10,
  },
  sessionHistoryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
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
    gap: 16,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  dialogButtonDanger: {
    backgroundColor: theme.colors.errorSurface,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
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
