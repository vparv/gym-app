import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { DayList } from './src/components/DayList';
import { ExerciseCard } from './src/components/ExerciseCard';
import { WeekPicker } from './src/components/WeekPicker';
import { buildLatestLogsByHistoryKey } from './src/lib/history';
import { loadBundledCsvTextAsync, readPickedDocumentTextAsync } from './src/lib/program-source';
import {
  appendLog,
  clearLogsOnly,
  loadAppData,
  replaceProgramAndClearLogs,
  saveProgram,
} from './src/lib/storage';
import { parseWorkoutProgram } from './src/lib/csv';
import { theme } from './src/theme';
import {
  type AppMessage,
  type AppViewState,
  type ExerciseLog,
  type ExerciseLogDraft,
  type ExerciseOption,
  type PlannedExercise,
  type WorkoutProgram,
} from './src/types';

const SEEDED_PROGRAM_ASSET = require('./src/assets/bodybuilding_transformation_workouts_corrected.csv');
const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'];

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const [bootstrapState, setBootstrapState] = React.useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [program, setProgram] = React.useState<WorkoutProgram | null>(null);
  const [logs, setLogs] = React.useState<ExerciseLog[]>([]);
  const [viewState, setViewState] = React.useState<AppViewState>({ screen: 'home' });
  const [drafts, setDrafts] = React.useState<Record<string, ExerciseLogDraft>>({});
  const [message, setMessage] = React.useState<AppMessage | null>(null);
  const [busyAction, setBusyAction] = React.useState<'replace' | 'clear-logs' | null>(null);
  const [storageMode, setStorageMode] = React.useState<'supabase' | 'local-cache'>('local-cache');

  React.useEffect(() => {
    void bootstrapApp();
  }, []);

  async function bootstrapApp() {
    setBootstrapState('loading');
    setBootstrapError(null);
    setMessage(null);

    try {
      const { program: storedProgram, logs: storedLogs, notice, mode } = await loadAppData();

      if (storedProgram) {
        setProgram(storedProgram);
        setLogs(storedLogs);
        setStorageMode(mode);
        setViewState({ screen: 'home' });
        setDrafts({});
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
      setStorageMode(result.mode);
      setViewState({ screen: 'home' });
      setDrafts({});
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

  const latestLogsByHistoryKey = buildLatestLogsByHistoryKey(logs);

  const activeWeek =
    program?.weeks.find((week) => week.weekNumber === program.activeWeek) ?? program?.weeks[0] ?? null;

  const selectedDay =
    activeWeek && viewState.screen === 'day'
      ? activeWeek.days.find((day) => day.id === viewState.dayId) ?? null
      : null;

  React.useEffect(() => {
    if (viewState.screen === 'day' && !selectedDay) {
      setViewState({ screen: 'home' });
      setDrafts({});
    }
  }, [selectedDay, viewState]);

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

  const handleOpenDay = (dayId: string) => {
    setViewState({ screen: 'day', dayId });
    setDrafts({});
    setMessage(null);
  };

  const handleBackToProgram = () => {
    setViewState({ screen: 'home' });
    setDrafts({});
    setMessage(null);
  };

  const updateDraft = (exerciseId: string, nextDraft: ExerciseLogDraft) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [exerciseId]: nextDraft,
    }));
  };

  const saveExerciseLog = async (exercise: PlannedExercise, draft: ExerciseLogDraft) => {
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
        text: 'Enter a weight for every set you started before saving.',
      });
      return;
    }

    try {
      const startedSetLogs = getStartedSetLogs(draft);
      const nextLog: ExerciseLog = {
        id: createLogId(exercise.id),
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

      const nextLogs = [...logs, nextLog];

      const result = await appendLog(nextLog, nextLogs);
      setLogs(nextLogs);
      setStorageMode(result.mode);
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [exercise.id]: createExerciseDraft(exercise, selectedOption.key),
      }));
      setMessage({
        type: 'success',
        text: result.notice
          ? `Saved ${selectedOption.label}. ${result.notice}`
          : `Saved ${selectedOption.label}.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not save your workout log. ${getErrorMessage(error)}`,
      });
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
      setStorageMode(storageResult.mode);
      setViewState({ screen: 'home' });
      setDrafts({});
      setMessage({
        type: 'success',
        text: storageResult.notice
          ? `Replaced the program with ${pickedAsset.name}, cleared all workout logs, and ${storageResult.notice.toLowerCase()}`
          : `Replaced the program with ${pickedAsset.name} and cleared all workout logs.`,
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

  const handleClearLogs = async () => {
    if (!logs.length) {
      setMessage({
        type: 'success',
        text: 'There are no saved workout logs to clear.',
      });
      return;
    }

    const confirmed = await confirmDestructiveAction(
      'Clear Logs',
      'This will remove every saved workout log and keep the current program.'
    );

    if (!confirmed) {
      return;
    }

    setBusyAction('clear-logs');
    setMessage(null);

    try {
      const result = await clearLogsOnly();
      setLogs([]);
      setStorageMode(result.mode);
      setDrafts({});
      setMessage({
        type: 'success',
        text: result.notice ? `Cleared all saved workout logs. ${result.notice}` : 'Cleared all saved workout logs.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Could not clear logs. ${getErrorMessage(error)}`,
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

  if (bootstrapState === 'loading') {
    return (
      <SafeAreaView style={styles.bootstrapScreen}>
        <StatusBar style="dark" />
        <View style={styles.bootstrapCard}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={styles.bootstrapTitle}>Loading your program</Text>
          <Text style={styles.bootstrapBody}>
            Restoring your program, cached history, and Supabase data.
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, isCompact ? styles.pageCompact : undefined]}>
          {viewState.screen === 'home' ? (
            <>
              <View style={[styles.heroCard, isCompact ? styles.surfaceCompact : undefined]}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroBadge}>Program</Text>
                  <Text style={[styles.heroTitle, isCompact ? styles.heroTitleCompact : undefined]}>
                    Bodybuilding Transformation Tracker
                  </Text>
                  <Text style={styles.heroBody}>
                    Follow the prescribed weekly split, watch the right movement demo, and save your
                    working weights without turning this into a giant fitness app.
                  </Text>
                </View>

                <View style={styles.heroMetaCard}>
                  <Text style={styles.heroMetaLabel}>Current block</Text>
                  <Text style={styles.heroMetaValue}>{activeWeek.block}</Text>
                  <Text style={styles.heroMetaHint}>
                    {activeWeek.days.length} workout days in week {activeWeek.weekNumber}
                  </Text>
                  <Text
                    style={[
                      styles.heroMetaSync,
                      storageMode === 'supabase' ? styles.heroMetaSyncOnline : styles.heroMetaSyncOffline,
                    ]}
                  >
                    {storageMode === 'supabase' ? 'Sync: Supabase' : 'Sync: Local cache'}
                  </Text>
                </View>
              </View>

              {message ? <MessageBanner message={message} /> : null}

              <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>Choose your week</Text>
                    <Text style={styles.panelSubtitle}>
                      The app remembers your current week locally.
                    </Text>
                  </View>
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
                  <View>
                    <Text style={styles.panelTitle}>Workout days</Text>
                    <Text style={styles.panelSubtitle}>
                      Open a day to see the prescribed movement, substitutions, and your latest logs.
                    </Text>
                  </View>
                </View>

                <DayList days={activeWeek.days} onSelectDay={handleOpenDay} />
              </View>

              <View style={[styles.panel, isCompact ? styles.surfaceCompact : undefined]}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>Program management</Text>
                    <Text style={styles.panelSubtitle}>
                      Replace the workout CSV or wipe saved training history without changing weeks.
                    </Text>
                  </View>
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
                    onPress={() => void handleClearLogs()}
                    style={[
                      styles.secondaryButton,
                      busyAction !== null ? styles.buttonDisabled : undefined,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {busyAction === 'clear-logs' ? 'Clearing logs...' : 'Clear Logs'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : selectedDay ? (
            <>
              <View style={styles.detailHeader}>
                <Pressable style={styles.backButton} onPress={handleBackToProgram}>
                  <Text style={styles.backButtonText}>Back to Program</Text>
                </Pressable>

                <View style={styles.detailHeadingCopy}>
                  <Text style={styles.detailEyebrow}>
                    Week {activeWeek.weekNumber} · {activeWeek.block}
                  </Text>
                  <Text style={[styles.detailTitle, isCompact ? styles.detailTitleCompact : undefined]}>
                    {selectedDay.name}
                  </Text>
                  <Text style={styles.detailSubtitle}>{selectedDay.focus}</Text>
                </View>
              </View>

              {message ? <MessageBanner message={message} /> : null}

              <View style={styles.exerciseList}>
                {selectedDay.exercises.map((exercise) => {
                  const draft =
                    drafts[exercise.id] ?? createExerciseDraft(exercise, exercise.defaultOptionKey);
                  const selectedOption =
                    getExerciseOption(exercise, draft.selectedOptionKey) ?? exercise.options[0];
                  const latestLog = latestLogsByHistoryKey.get(selectedOption.historyKey);

                  return (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      focus={selectedDay.focus}
                      draft={draft}
                      latestLog={latestLog}
                      onDraftChange={(nextDraft) => updateDraft(exercise.id, nextDraft)}
                      onOpenUrl={handleOpenUrl}
                      onSave={() => void saveExerciseLog(exercise, draft)}
                    />
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
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

function createLogId(exerciseId: string) {
  return `${exerciseId}-${Date.now()}`;
}

function createExerciseDraft(exercise: PlannedExercise, optionKey: string): ExerciseLogDraft {
  return {
    selectedOptionKey: optionKey,
    setLogs: [createEmptySetDraft(1)],
    exerciseNote: '',
  };
}

function createEmptySetDraft(setNumber: number) {
  return {
    setNumber,
    weight: '',
    repsCompleted: '',
  };
}

async function confirmDestructiveAction(title: string, message: string) {
  if (Platform.OS === 'web') {
    return window.confirm(message);
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
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
  scrollContent: {
    flexGrow: 1,
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
    gap: 18,
  },
  surfaceCompact: {
    padding: 16,
  },
  heroCopy: {
    gap: 10,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.badge,
    color: theme.colors.badgeText,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroBody: {
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
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
  heroMetaSync: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroMetaSyncOnline: {
    color: theme.colors.accent,
  },
  heroMetaSyncOffline: {
    color: theme.colors.warning,
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
  detailHeadingCopy: {
    gap: 6,
  },
  detailEyebrow: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  exerciseList: {
    gap: 16,
  },
});
