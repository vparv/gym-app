import * as React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import type { ExerciseLogDraft, ExerciseSetDraft, PlannedExercise } from '../types';

type ExerciseFocusScreenProps = {
  exercise: PlannedExercise;
  draft: ExerciseLogDraft;
  onDraftChange: (draft: ExerciseLogDraft) => void;
  onBack: () => void;
  onPlayVideo: (label: string, url: string, notes: string) => void;
};

type PlannedSetStep = {
  setNumber: number;
  phase: 'warmup' | 'working';
  phaseIndex: number;
  isFinalWorkingSet: boolean;
};

type RestState =
  | { status: 'idle'; remainingSeconds: number }
  | { status: 'running'; remainingSeconds: number }
  | { status: 'finished'; remainingSeconds: number };

export function ExerciseFocusScreen({
  exercise,
  draft,
  onDraftChange,
  onBack,
  onPlayVideo,
}: ExerciseFocusScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 430;
  const setPlan = React.useMemo(() => buildSetPlan(exercise), [exercise]);
  const totalSetCount = setPlan.length;
  const handledSetCount = React.useMemo(() => countHandledSets(draft), [draft]);
  const [activeSetIndex, setActiveSetIndex] = React.useState(
    Math.min(handledSetCount, totalSetCount)
  );
  const [restState, setRestState] = React.useState<RestState>({
    status: 'idle',
    remainingSeconds: 0,
  });
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const currentSet = setPlan[activeSetIndex] ?? null;
  const currentSetDraft =
    currentSet ? getDraftSetByNumber(draft, currentSet.setNumber) ?? createEmptySetDraft(currentSet.setNumber) : null;
  const nextSet = currentSet ? setPlan[activeSetIndex + 1] ?? null : null;
  const recommendedRestSeconds = parseRestSeconds(exercise.restText);
  const showCompleteState = activeSetIndex >= totalSetCount;
  const isReviewingHandledSet = activeSetIndex < handledSetCount;
  const showFixedSetActions =
    !showCompleteState && restState.status === 'idle' && Boolean(currentSet && currentSetDraft);
  const topSpacing = Math.max(insets.top + (isCompact ? 6 : 10), isCompact ? 18 : 24);
  const bottomSpacing = Math.max(insets.bottom + 8, 18);

  React.useEffect(() => {
    setActiveSetIndex(Math.min(countHandledSets(draft), totalSetCount));
    setRestState({
      status: 'idle',
      remainingSeconds: 0,
    });
    setInlineError(null);
  }, [draft.selectedOptionKey, exercise.id, totalSetCount]);

  React.useEffect(() => {
    if (!currentSet) {
      return;
    }

    if (isSkippedSet(draft, currentSet.setNumber)) {
      return;
    }

    if (getDraftSetByNumber(draft, currentSet.setNumber)) {
      return;
    }

    onDraftChange({
      ...draft,
      setLogs: [...draft.setLogs, createEmptySetDraft(currentSet.setNumber)],
    });
  }, [currentSet, draft, onDraftChange]);

  React.useEffect(() => {
    if (restState.status !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      setRestState((currentRest) => {
        if (currentRest.status !== 'running') {
          return currentRest;
        }

        if (currentRest.remainingSeconds <= 1) {
          return {
            status: 'finished',
            remainingSeconds: 0,
          };
        }

        return {
          status: 'running',
          remainingSeconds: currentRest.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [restState.status]);

  const handleSetDraftChange = (field: 'weight' | 'repsCompleted', value: string) => {
    if (!currentSet) {
      return;
    }

    const existingSet =
      getDraftSetByNumber(draft, currentSet.setNumber) ?? createEmptySetDraft(currentSet.setNumber);
    const nextDraftSet = {
      ...existingSet,
      [field]: value,
    };

    setInlineError(null);
    onDraftChange({
      ...draft,
      skippedSetNumbers: (draft.skippedSetNumbers ?? []).filter(
        (setNumber) => setNumber !== currentSet.setNumber
      ),
      setLogs: upsertDraftSet(draft.setLogs, nextDraftSet),
    });
  };

  const advanceToNextSet = () => {
    setRestState({
      status: 'idle',
      remainingSeconds: 0,
    });
    setInlineError(null);
    setActiveSetIndex((currentIndex) => Math.min(currentIndex + 1, totalSetCount));
  };

  const handleSkipSet = () => {
    if (!currentSet) {
      return;
    }

    const nextDraft = {
      ...draft,
      completedSetNumbers: (draft.completedSetNumbers ?? []).filter(
        (setNumber) => setNumber !== currentSet.setNumber
      ),
      setLogs: draft.setLogs.filter((setLog) => setLog.setNumber !== currentSet.setNumber),
      skippedSetNumbers: Array.from(
        new Set([...(draft.skippedSetNumbers ?? []), currentSet.setNumber])
      ).sort((left, right) => left - right),
    };

    onDraftChange(nextDraft);
    setInlineError(null);
    setRestState({
      status: 'idle',
      remainingSeconds: 0,
    });
    setActiveSetIndex(Math.min(countHandledSets(nextDraft), totalSetCount));
  };

  const handleCompleteSet = () => {
    if (!currentSet || !currentSetDraft) {
      return;
    }

    if (currentSetDraft.weight.trim().length === 0) {
      setInlineError('Enter a weight before completing the set.');
      return;
    }

    const nextDraft = {
      ...draft,
      completedSetNumbers: Array.from(
        new Set([...(draft.completedSetNumbers ?? []), currentSet.setNumber])
      ).sort((left, right) => left - right),
      skippedSetNumbers: (draft.skippedSetNumbers ?? []).filter(
        (setNumber) => setNumber !== currentSet.setNumber
      ),
    };

    onDraftChange(nextDraft);

    if (isReviewingHandledSet) {
      setInlineError(null);
      setRestState({
        status: 'idle',
        remainingSeconds: 0,
      });
      setActiveSetIndex(Math.min(countHandledSets(nextDraft), totalSetCount));
      return;
    }

    if (activeSetIndex >= totalSetCount - 1) {
      setInlineError(null);
      setRestState({
        status: 'idle',
        remainingSeconds: 0,
      });
      setActiveSetIndex(totalSetCount);
      return;
    }

    if (recommendedRestSeconds > 0) {
      setRestState({
        status: 'running',
        remainingSeconds: recommendedRestSeconds,
      });
      setInlineError(null);
      return;
    }

    advanceToNextSet();
  };

  const handleSelectRoadmapStep = (index: number) => {
    if (index > handledSetCount) {
      return;
    }

    setRestState({
      status: 'idle',
      remainingSeconds: 0,
    });
    setInlineError(null);
    setActiveSetIndex(index);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.screenScrollContent,
          isCompact ? styles.screenScrollContentCompact : undefined,
          showFixedSetActions ? styles.screenScrollContentWithFooter : undefined,
          { paddingTop: topSpacing },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.headerCard, isCompact ? styles.cardCompact : undefined]}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>Back to workout</Text>
            </Pressable>

            <Pressable
              onPress={() => onPlayVideo(draft.selectedOptionKey === 'primary' ? exercise.options[0]?.label ?? '' : getSelectedOptionLabel(exercise, draft.selectedOptionKey), getSelectedOptionUrl(exercise, draft.selectedOptionKey), exercise.notes)}
              style={styles.videoButton}
            >
              <Text style={styles.videoButtonText}>Play video</Text>
            </Pressable>
          </View>

          <Text style={[styles.title, isCompact ? styles.titleCompact : undefined]}>
            {getSelectedOptionLabel(exercise, draft.selectedOptionKey)}
          </Text>

        </View>

        <View style={[styles.roadmapCard, isCompact ? styles.cardCompact : undefined]}>
          <Text style={styles.sectionLabel}>Set roadmap</Text>
          <View style={styles.roadmapRow}>
            {setPlan.map((step, index) => {
              const isDone = index < handledSetCount;
              const isSelected = !showCompleteState && index === activeSetIndex;
              const isNext =
                !showCompleteState && index === handledSetCount && index !== activeSetIndex;
              const isSelectable = index <= handledSetCount;

              return (
                <Pressable
                  key={step.setNumber}
                  disabled={!isSelectable}
                  onPress={() => handleSelectRoadmapStep(index)}
                  style={[
                    styles.roadmapPill,
                    isDone ? styles.roadmapPillDone : undefined,
                    isSelected ? styles.roadmapPillActive : undefined,
                    isNext ? styles.roadmapPillNext : undefined,
                    !isSelectable ? styles.roadmapPillDisabled : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.roadmapPillLabel,
                      isSelected ? styles.roadmapPillLabelActive : undefined,
                    ]}
                  >
                    {step.phase === 'warmup' ? `WU ${step.phaseIndex}` : `WK ${step.phaseIndex}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showCompleteState ? (
          <View style={[styles.primaryCard, isCompact ? styles.cardCompact : undefined]}>
            <Text style={styles.sectionLabel}>Exercise complete</Text>
            <Text style={styles.completeTitle}>All programmed sets are done.</Text>
            <Text style={styles.completeBody}>
              You can head back to the workout overview and move on to the next exercise whenever you are ready.
            </Text>
            <Pressable onPress={onBack} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Back to workout</Text>
            </Pressable>
          </View>
        ) : restState.status !== 'idle' && nextSet ? (
          <View style={[styles.primaryCard, isCompact ? styles.cardCompact : undefined]}>
            <Text style={styles.sectionLabel}>Rest</Text>
            <Text style={styles.setTitle}>Rest before set {nextSet.setNumber}</Text>
            <Text style={styles.setBody}>
              Suggested rest: {exercise.restText ?? 'Optional'}. The next set is {describeSetStep(nextSet)}.
            </Text>

            <View style={styles.restCard}>
              <Text style={styles.restTime}>{formatSeconds(restState.remainingSeconds)}</Text>
              <Text style={styles.restCaption}>
                {restState.status === 'running' ? 'Rest timer is running' : 'Rest complete'}
              </Text>
            </View>

            <View style={styles.actionRow}>
              {restState.status === 'running' ? (
                <Pressable onPress={advanceToNextSet} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Skip rest</Text>
                </Pressable>
              ) : null}

              {restState.status === 'finished' ? (
                <Pressable onPress={advanceToNextSet} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Start next set</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Next up</Text>
              <Text style={styles.previewTitle}>{describeSetStep(nextSet)}</Text>
              <Text style={styles.previewBody}>{describeRpeTarget(exercise, nextSet)}</Text>
            </View>
          </View>
        ) : currentSet && currentSetDraft ? (
          <View style={[styles.primaryCard, isCompact ? styles.cardCompact : undefined]}>
            <Text style={styles.sectionLabel}>
              Set {currentSet.setNumber} of {totalSetCount}
            </Text>
            <Text style={styles.setTitle}>{describeSetStep(currentSet)}</Text>
            <Text style={styles.setBody}>
              {describeRepsTarget(exercise)} · {describeRpeTarget(exercise, currentSet)}
            </Text>

            <View style={styles.targetGrid}>
              <MetricCard label="Reps target" value={exercise.repsText} />
              <MetricCard label="RPE target" value={getRpeValue(exercise, currentSet)} />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Reps</Text>
                <TextInput
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  value={currentSetDraft.repsCompleted}
                  onChangeText={(value) => handleSetDraftChange('repsCompleted', value)}
                />
              </View>

              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Weight</Text>
                <TextInput
                  placeholder="Required"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  value={currentSetDraft.weight}
                  onChangeText={(value) => handleSetDraftChange('weight', value)}
                />
              </View>
            </View>

            {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}

            {currentSet.phase === 'warmup' ? (
              <View style={styles.guidanceCard}>
                <Text style={styles.guidanceLabel}>Warm-up guidance</Text>
                <Text style={styles.guidanceBody}>
                  {exercise.warmupSetsText.includes('-')
                    ? `The program calls for ${exercise.warmupSetsText} warm-up sets. This flow uses the top end so you can keep moving without guessing.`
                    : 'Use this set to ramp up toward your first working set weight.'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {showFixedSetActions ? (
        <View style={[styles.setActionShell, { paddingBottom: bottomSpacing }]}>
          <View style={styles.setActionRow}>
            <Pressable onPress={handleSkipSet} style={[styles.secondaryButton, styles.setActionButton]}>
              <Text style={styles.secondaryButtonText}>Skip set</Text>
            </Pressable>

            <Pressable onPress={handleCompleteSet} style={[styles.primaryButton, styles.setActionButton]}>
              <Text style={styles.primaryButtonText}>
                {isReviewingHandledSet
                  ? 'Save changes'
                  : activeSetIndex === totalSetCount - 1
                    ? 'Finish exercise'
                    : 'Complete set'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function buildSetPlan(exercise: PlannedExercise): PlannedSetStep[] {
  const warmupCount = parseWarmupSetCount(exercise.warmupSetsText);
  const workingCount = Math.max(1, exercise.workingSets);
  const steps: PlannedSetStep[] = [];

  for (let index = 0; index < warmupCount; index += 1) {
    steps.push({
      setNumber: index + 1,
      phase: 'warmup',
      phaseIndex: index + 1,
      isFinalWorkingSet: false,
    });
  }

  for (let index = 0; index < workingCount; index += 1) {
    steps.push({
      setNumber: warmupCount + index + 1,
      phase: 'working',
      phaseIndex: index + 1,
      isFinalWorkingSet: index === workingCount - 1,
    });
  }

  return steps;
}

function parseWarmupSetCount(warmupText: string) {
  const matches = warmupText.match(/\d+/g);

  if (!matches?.length) {
    return 0;
  }

  return Number.parseInt(matches[matches.length - 1] ?? '0', 10);
}

function parseRestSeconds(restText?: string) {
  if (!restText) {
    return 0;
  }

  const valueMatch = restText.match(/(\d+(?:\.\d+)?)/);

  if (!valueMatch) {
    return 0;
  }

  const numericValue = Number.parseFloat(valueMatch[1]);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  if (/sec|second/i.test(restText)) {
    return Math.round(numericValue);
  }

  return Math.round(numericValue * 60);
}

function countHandledSets(draft: ExerciseLogDraft) {
  const handledSetNumbers = new Set<number>([
    ...(draft.completedSetNumbers ?? []),
    ...(draft.skippedSetNumbers ?? []),
  ]);

  return handledSetNumbers.size;
}

function isSkippedSet(draft: ExerciseLogDraft, setNumber: number) {
  return (draft.skippedSetNumbers ?? []).includes(setNumber);
}

function getDraftSetByNumber(draft: ExerciseLogDraft, setNumber: number) {
  return draft.setLogs.find((setLog) => setLog.setNumber === setNumber);
}

function upsertDraftSet(setLogs: ExerciseSetDraft[], nextSet: ExerciseSetDraft) {
  const existingIndex = setLogs.findIndex((setLog) => setLog.setNumber === nextSet.setNumber);

  if (existingIndex === -1) {
    return [...setLogs, nextSet].sort((left, right) => left.setNumber - right.setNumber);
  }

  return setLogs.map((setLog) => (setLog.setNumber === nextSet.setNumber ? nextSet : setLog));
}

function createEmptySetDraft(setNumber: number): ExerciseSetDraft {
  return {
    setNumber,
    weight: '',
    repsCompleted: '',
  };
}

function getSelectedOptionLabel(exercise: PlannedExercise, optionKey: string) {
  return exercise.options.find((option) => option.key === optionKey)?.label ?? exercise.options[0]?.label ?? 'Exercise';
}

function getSelectedOptionUrl(exercise: PlannedExercise, optionKey: string) {
  return exercise.options.find((option) => option.key === optionKey)?.videoUrl ?? exercise.options[0]?.videoUrl ?? '';
}

function describeSetStep(step: PlannedSetStep) {
  return step.phase === 'warmup'
    ? `Warm-up set ${step.phaseIndex}`
    : `Working set ${step.phaseIndex}${step.isFinalWorkingSet ? ' · final set' : ''}`;
}

function describeRepsTarget(exercise: PlannedExercise) {
  return `Aim for ${exercise.repsText} reps`;
}

function describeRpeTarget(exercise: PlannedExercise, step: PlannedSetStep) {
  if (step.phase === 'warmup') {
    return exercise.earlySetRpeText
      ? `Build toward your working effort around ${exercise.earlySetRpeText} RPE.`
      : 'Use this set to build toward your working weight.';
  }

  if (step.isFinalWorkingSet && exercise.lastSetRpeText) {
    return `Push the final working set to ${exercise.lastSetRpeText} RPE.`;
  }

  if (exercise.earlySetRpeText) {
    return `Keep this set around ${exercise.earlySetRpeText} RPE.`;
  }

  return 'No RPE target is listed for this set.';
}

function getRpeValue(exercise: PlannedExercise, step: PlannedSetStep) {
  if (step.phase === 'warmup') {
    return exercise.earlySetRpeText ?? 'Ramp up';
  }

  if (step.isFinalWorkingSet) {
    return exercise.lastSetRpeText ?? exercise.earlySetRpeText ?? 'Not listed';
  }

  return exercise.earlySetRpeText ?? 'Not listed';
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    gap: 16,
    paddingBottom: 14,
  },
  screenScrollContentCompact: {
    gap: 12,
  },
  screenScrollContentWithFooter: {
    paddingBottom: 10,
  },
  headerCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 22,
    gap: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 22,
    gap: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  roadmapCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
  },
  cardCompact: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  videoButton: {
    backgroundColor: theme.colors.accentMuted,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  videoButtonText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: theme.colors.text,
    fontSize: 31,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.7,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roadmapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roadmapPill: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roadmapPillDone: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accentSoft,
  },
  roadmapPillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  roadmapPillNext: {
    borderColor: theme.colors.accentSoft,
  },
  roadmapPillDisabled: {
    opacity: 0.42,
  },
  roadmapPillLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  roadmapPillLabelActive: {
    color: theme.colors.accentText,
  },
  setTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  setBody: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputField: {
    flex: 1,
    gap: 8,
  },
  inputLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  inlineError: {
    color: theme.colors.errorText,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 15,
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
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
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 18,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  setActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  setActionShell: {
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingBottom: 0,
  },
  setActionButton: {
    flex: 1,
  },
  restCard: {
    backgroundColor: theme.colors.accentMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
    padding: 18,
    gap: 6,
    alignItems: 'center',
  },
  restTime: {
    color: theme.colors.accent,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  restCaption: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    gap: 10,
  },
  previewCard: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 4,
  },
  previewLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  previewBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  guidanceCard: {
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 6,
  },
  guidanceLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  guidanceBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  completeTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  completeBody: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
});
