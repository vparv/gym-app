import * as React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { theme } from '../theme';
import type { ExerciseLog, ExerciseLogDraft, ExerciseSetDraft, PlannedExercise } from '../types';

type ExerciseCardProps = {
  exercise: PlannedExercise;
  focus: string;
  mode: 'review' | 'active' | 'summary';
  draft?: ExerciseLogDraft;
  latestLog?: ExerciseLog;
  sessionLog?: ExerciseLog;
  isNextUp?: boolean;
  onDraftChange?: (draft: ExerciseLogDraft) => void;
  onOpenUrl: (url: string) => void;
  onStartLog?: () => void;
  onSave?: () => void;
  onCancelEdit?: () => void;
  onEditLog?: () => void;
  onRemoveLog?: () => void;
};

export function ExerciseCard({
  exercise,
  focus,
  mode,
  draft,
  latestLog,
  sessionLog,
  isNextUp = false,
  onDraftChange,
  onOpenUrl,
  onStartLog,
  onSave,
  onCancelEdit,
  onEditLog,
  onRemoveLog,
}: ExerciseCardProps) {
  const { width } = useWindowDimensions();
  const [metaGridWidth, setMetaGridWidth] = React.useState(0);
  const isCompact = width < 390;
  const metaGridGap = 10;
  const useTwoColumnMeta = metaGridWidth > 0 ? metaGridWidth >= 260 : width >= 320;
  const metaCardWidth = useTwoColumnMeta && metaGridWidth > 0 ? (metaGridWidth - metaGridGap) / 2 : undefined;
  const selectedOptionKey = draft?.selectedOptionKey ?? sessionLog?.performedOptionKey ?? exercise.defaultOptionKey;
  const selectedOption =
    exercise.options.find((option) => option.key === selectedOptionKey) ?? exercise.options[0];
  const historyLog = latestLog && latestLog.id !== sessionLog?.id ? latestLog : undefined;
  const isEditing = Boolean(draft);

  return (
    <View style={[styles.card, isCompact ? styles.cardCompact : undefined]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.headerBadges}>
            <Text style={styles.focusBadge}>{focus}</Text>
            {mode === 'active' && sessionLog && !isEditing ? (
              <Text style={styles.loggedBadge}>Logged this workout</Text>
            ) : null}
            {mode === 'active' && !sessionLog && isNextUp ? (
              <Text style={styles.nextBadge}>Up next</Text>
            ) : null}
            {mode === 'summary' && sessionLog ? <Text style={styles.loggedBadge}>Completed</Text> : null}
          </View>

          <Text style={[styles.title, isCompact ? styles.titleCompact : undefined]}>
            {selectedOption.label}
          </Text>
          <Text style={[styles.subtitle, isCompact ? styles.subtitleCompact : undefined]}>
            Prescribed slot: {exercise.options[0]?.label}
          </Text>
        </View>

        <Pressable
          onPress={() => onOpenUrl(selectedOption.videoUrl)}
          style={[styles.linkButton, isCompact ? styles.linkButtonCompact : undefined]}
        >
          <Text style={styles.linkButtonText}>Watch video</Text>
        </Pressable>
      </View>

      <View style={styles.optionsRow}>
        {exercise.options.map((option) => {
          const isSelected = option.key === selectedOption.key;

          return (
            <View
              key={option.key}
              style={[styles.optionChip, isSelected ? styles.optionChipSelected : undefined]}
            >
              <Text style={[styles.optionLabel, isSelected ? styles.optionLabelSelected : undefined]}>
                {option.isPrimary ? 'Prescribed' : 'Substitution'}
              </Text>
              <Text style={[styles.optionValue, isSelected ? styles.optionValueSelected : undefined]}>
                {option.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={styles.metaGrid}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;

          if (Math.abs(nextWidth - metaGridWidth) > 1) {
            setMetaGridWidth(nextWidth);
          }
        }}
      >
        <MetaItem
          label="Warmup sets"
          value={exercise.warmupSetsText}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
        <MetaItem
          label="Working sets"
          value={String(exercise.workingSets)}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
        <MetaItem
          label="Reps"
          value={exercise.repsText}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
        <MetaItem
          label="Early-set RPE"
          value={exercise.earlySetRpeText ?? 'Not listed'}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
        <MetaItem
          label="Last-set RPE"
          value={exercise.lastSetRpeText ?? 'Not listed'}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
        <MetaItem
          label="Rest"
          value={exercise.restText ?? 'Not listed'}
          isCompact={isCompact}
          useTwoColumnLayout={useTwoColumnMeta}
          width={metaCardWidth}
        />
      </View>

      {exercise.lastSetIntensityTechnique ? (
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>Intensity technique</Text>
          <Text style={styles.calloutBody}>{exercise.lastSetIntensityTechnique}</Text>
        </View>
      ) : null}

      <View style={styles.callout}>
        <Text style={styles.calloutLabel}>Notes</Text>
        <Text style={styles.calloutBody}>{exercise.notes}</Text>
      </View>

      {sessionLog ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyLabel}>
            {mode === 'summary' ? 'Completed in this workout' : 'Logged in this workout'}
          </Text>
          <Text style={styles.historyDate}>
            {formatLogDate(sessionLog.loggedAt)} · {sessionLog.performedOptionLabel}
          </Text>
          <Text style={styles.historyBody}>{formatSetSummary(sessionLog)}</Text>
          {sessionLog.exerciseNote ? (
            <Text style={styles.historyNote}>Note: {sessionLog.exerciseNote}</Text>
          ) : null}

          {mode === 'active' && !isEditing ? (
            <View style={styles.sessionActionRow}>
              <Pressable onPress={onEditLog} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Edit log</Text>
              </Pressable>

              <Pressable onPress={onRemoveLog} style={styles.inlineButtonDanger}>
                <Text style={styles.inlineButtonDangerText}>Remove log</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {historyLog ? (
        <View style={styles.secondaryHistoryCard}>
          <Text style={styles.secondaryHistoryLabel}>Latest saved history</Text>
          <Text style={styles.secondaryHistoryBody}>
            {formatLogDate(historyLog.loggedAt)} · {formatSetSummary(historyLog)}
          </Text>
        </View>
      ) : null}

      {mode === 'review' ? (
        <View style={styles.reviewStateCard}>
          <Text style={styles.reviewStateTitle}>Ready when you are</Text>
          <Text style={styles.reviewStateBody}>
            Start a workout session to log this exercise for today.
          </Text>
        </View>
      ) : null}

      {mode === 'active' && !sessionLog && !isEditing ? (
        <View style={styles.reviewStateCard}>
          <Text style={styles.reviewStateTitle}>{isNextUp ? 'Suggested next exercise' : 'Not logged yet'}</Text>
          <Text style={styles.reviewStateBody}>
            {isNextUp
              ? 'This is the first exercise you have not logged in the current workout.'
              : 'You can log this exercise whenever you want in the session.'}
          </Text>
          <Pressable onPress={onStartLog} style={styles.primaryActionButton}>
            <Text style={styles.primaryActionButtonText}>Log this exercise</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'active' && draft && onDraftChange ? (
        <ExerciseLogger
          exercise={exercise}
          draft={draft}
          isEditingExistingLog={Boolean(sessionLog)}
          onDraftChange={onDraftChange}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      ) : null}
    </View>
  );
}

function ExerciseLogger({
  exercise,
  draft,
  isEditingExistingLog,
  onDraftChange,
  onSave,
  onCancel,
}: {
  exercise: PlannedExercise;
  draft: ExerciseLogDraft;
  isEditingExistingLog: boolean;
  onDraftChange: (draft: ExerciseLogDraft) => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  const currentSetLog = draft.setLogs[draft.setLogs.length - 1];
  const completedSetLogs = draft.setLogs.slice(0, -1).filter((setLog) => setLog.weight.trim().length > 0);
  const startedSetCount = draft.setLogs.filter(isStartedSet).length;
  const hasIncompleteStartedSet = draft.setLogs.some(
    (setLog) => isStartedSet(setLog) && setLog.weight.trim().length === 0
  );
  const canAddAnotherSet =
    Boolean(currentSetLog) &&
    draft.setLogs.length < exercise.workingSets &&
    currentSetLog.weight.trim().length > 0;
  const canRemoveEmptySet =
    draft.setLogs.length > 1 &&
    currentSetLog.weight.trim().length === 0 &&
    currentSetLog.repsCompleted.trim().length === 0;
  const isSaveDisabled = startedSetCount === 0 || hasIncompleteStartedSet;

  return (
    <View style={styles.logger}>
      <Text style={styles.loggerTitle}>{isEditingExistingLog ? 'Edit this exercise' : 'Log working sets'}</Text>
      <Text style={styles.loggerSubtitle}>
        Save only when the weights for every started set are filled in.
      </Text>

      <View style={styles.optionSelector}>
        {exercise.options.map((option) => {
          const isSelected = option.key === draft.selectedOptionKey;

          return (
            <Pressable
              key={option.key}
              onPress={() =>
                onDraftChange({
                  ...draft,
                  selectedOptionKey: option.key,
                })
              }
              style={[
                styles.optionSelectorChip,
                isSelected ? styles.optionSelectorChipSelected : undefined,
              ]}
            >
              <Text
                style={[
                  styles.optionSelectorText,
                  isSelected ? styles.optionSelectorTextSelected : undefined,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {completedSetLogs.length ? (
        <View style={styles.completedSetList}>
          {completedSetLogs.map((setLog) => (
            <View key={setLog.setNumber} style={styles.completedSetCard}>
              <View style={styles.completedSetCopy}>
                <Text style={styles.completedSetLabel}>Set {setLog.setNumber}</Text>
                <Text style={styles.completedSetValue}>{formatSetDraftSummary(setLog)}</Text>
              </View>

              <Pressable
                onPress={() =>
                  onDraftChange({
                    ...draft,
                    setLogs: renumberSetLogs(
                      draft.setLogs.filter((currentDraftSetLog) => currentDraftSetLog !== setLog)
                    ),
                  })
                }
                style={styles.completedSetRemoveButton}
              >
                <Text style={styles.completedSetRemoveButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {currentSetLog ? (
        <View style={styles.setList}>
          <SetRow
            setLog={currentSetLog}
            onChange={(nextSetLog) => {
              const nextSetLogs = draft.setLogs.map((draftSetLog, index) =>
                index === draft.setLogs.length - 1 ? nextSetLog : draftSetLog
              );

              onDraftChange({
                ...draft,
                setLogs: nextSetLogs,
              });
            }}
          />
        </View>
      ) : null}

      {canAddAnotherSet || canRemoveEmptySet ? (
        <View style={styles.setActions}>
          {canAddAnotherSet ? (
            <Pressable
              onPress={() =>
                onDraftChange({
                  ...draft,
                  setLogs: [...draft.setLogs, createEmptySetDraft(draft.setLogs.length + 1)],
                })
              }
              style={styles.addSetButton}
            >
              <Text style={styles.addSetButtonText}>
                Add set {draft.setLogs.length + 1}
                {exercise.workingSets > 1 ? ` of ${exercise.workingSets}` : ''}
              </Text>
            </Pressable>
          ) : null}

          {canRemoveEmptySet ? (
            <Pressable
              onPress={() =>
                onDraftChange({
                  ...draft,
                  setLogs: draft.setLogs.slice(0, -1),
                })
              }
              style={styles.removeSetButton}
            >
              <Text style={styles.removeSetButtonText}>Remove empty set</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.noteField}>
        <Text style={styles.inputLabel}>Exercise note</Text>
        <TextInput
          multiline
          numberOfLines={3}
          placeholder="Optional note about machine used, setup, or anything worth remembering."
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, styles.noteInput]}
          value={draft.exerciseNote}
          onChangeText={(exerciseNote) =>
            onDraftChange({
              ...draft,
              exerciseNote,
            })
          }
        />
      </View>

      <View style={styles.loggerActions}>
        <Pressable
          disabled={isSaveDisabled}
          onPress={onSave}
          style={[styles.saveButton, isSaveDisabled ? styles.saveButtonDisabled : undefined]}
        >
          <Text style={styles.saveButtonText}>{isEditingExistingLog ? 'Update log' : 'Save log'}</Text>
        </Pressable>

        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaItem({
  label,
  value,
  isCompact,
  useTwoColumnLayout,
  width,
}: {
  label: string;
  value: string;
  isCompact: boolean;
  useTwoColumnLayout: boolean;
  width?: number;
}) {
  return (
    <View
      style={[
        styles.metaCard,
        useTwoColumnLayout && width ? { width } : styles.metaCardFull,
        isCompact ? styles.metaCardCompact : undefined,
      ]}
    >
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, isCompact ? styles.metaValueCompact : undefined]}>{value}</Text>
    </View>
  );
}

function SetRow({
  setLog,
  onChange,
}: {
  setLog: ExerciseSetDraft;
  onChange: (setLog: ExerciseSetDraft) => void;
}) {
  return (
    <View style={styles.setRow}>
      <View style={styles.setNumber}>
        <Text style={styles.setNumberText}>Set {setLog.setNumber}</Text>
      </View>

      <View style={styles.setField}>
        <Text style={styles.inputLabel}>Reps</Text>
        <TextInput
          placeholder="Optional"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          value={setLog.repsCompleted}
          onChangeText={(repsCompleted) =>
            onChange({
              ...setLog,
              repsCompleted,
            })
          }
        />
      </View>

      <View style={styles.setField}>
        <Text style={styles.inputLabel}>Weight</Text>
        <TextInput
          placeholder="Required"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          value={setLog.weight}
          onChangeText={(weight) =>
            onChange({
              ...setLog,
              weight,
            })
          }
        />
      </View>
    </View>
  );
}

function createEmptySetDraft(setNumber: number): ExerciseSetDraft {
  return {
    setNumber,
    weight: '',
    repsCompleted: '',
  };
}

function isStartedSet(setLog: ExerciseSetDraft) {
  return setLog.weight.trim().length > 0 || setLog.repsCompleted.trim().length > 0;
}

function formatSetDraftSummary(setLog: ExerciseSetDraft) {
  const reps = setLog.repsCompleted.trim();
  return reps.length > 0 ? `${reps} reps of ${setLog.weight} lb` : `${setLog.weight} lb`;
}

function renumberSetLogs(setLogs: ExerciseSetDraft[]) {
  return setLogs.map((setLog, index) => ({
    ...setLog,
    setNumber: index + 1,
  }));
}

function formatLogDate(loggedAt: string) {
  return new Date(loggedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSetSummary(log: ExerciseLog) {
  return log.setLogs
    .map((setLog) => {
      const reps = setLog.repsCompleted?.trim();
      const summary = reps?.length ? `${reps} reps of ${setLog.weight} lb` : `${setLog.weight} lb`;
      return `Set ${setLog.setNumber}: ${summary}`;
    })
    .join(' · ');
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 16,
  },
  cardCompact: {
    padding: 16,
    gap: 14,
  },
  header: {
    gap: 12,
  },
  headerCopy: {
    gap: 6,
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.badge,
    color: theme.colors.badgeText,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  loggedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.successSurface,
    color: theme.colors.successText,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    color: theme.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  linkButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkButtonCompact: {
    alignSelf: 'stretch',
  },
  linkButtonText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionsRow: {
    gap: 10,
  },
  optionChip: {
    backgroundColor: theme.colors.chip,
    borderRadius: theme.radii.lg,
    padding: 14,
    gap: 4,
  },
  optionChipSelected: {
    backgroundColor: theme.colors.chipSelected,
  },
  optionLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  optionLabelSelected: {
    color: theme.colors.accentText,
  },
  optionValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  optionValueSelected: {
    color: theme.colors.chipSelectedText,
  },
  optionSelector: {
    gap: 8,
  },
  optionSelectorChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelectorChipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  optionSelectorText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  optionSelectorTextSelected: {
    color: theme.colors.accent,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
    minHeight: 78,
  },
  metaCardCompact: {
    padding: 12,
  },
  metaCardFull: {
    width: '100%',
  },
  metaLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  metaValueCompact: {
    fontSize: 15,
  },
  callout: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radii.md,
    padding: 14,
    gap: 4,
  },
  calloutLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calloutBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  historyCard: {
    backgroundColor: theme.colors.successSurface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    padding: 14,
    gap: 6,
  },
  historyLabel: {
    color: theme.colors.successText,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  historyDate: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  historyBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  historyNote: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  secondaryHistoryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    padding: 14,
    gap: 4,
  },
  secondaryHistoryLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  secondaryHistoryBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  sessionActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  inlineButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineButtonDanger: {
    backgroundColor: theme.colors.errorSurface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButtonDangerText: {
    color: theme.colors.errorText,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewStateCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  reviewStateTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  reviewStateBody: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryActionButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  primaryActionButtonText: {
    color: theme.colors.accentText,
    fontSize: 14,
    fontWeight: '800',
  },
  logger: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 14,
  },
  loggerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  loggerSubtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  completedSetList: {
    gap: 10,
  },
  completedSetCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 10,
  },
  completedSetCopy: {
    gap: 2,
  },
  completedSetLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  completedSetValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  completedSetRemoveButton: {
    alignSelf: 'flex-start',
  },
  completedSetRemoveButtonText: {
    color: theme.colors.errorText,
    fontSize: 13,
    fontWeight: '700',
  },
  setList: {
    gap: 12,
  },
  setRow: {
    gap: 12,
  },
  setNumber: {
    backgroundColor: theme.colors.badge,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  setNumberText: {
    color: theme.colors.badgeText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  setField: {
    gap: 6,
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
    color: theme.colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteField: {
    gap: 6,
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  setActions: {
    gap: 10,
  },
  addSetButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addSetButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  removeSetButton: {
    backgroundColor: theme.colors.errorSurface,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  removeSetButtonText: {
    color: theme.colors.errorText,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  loggerActions: {
    gap: 10,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.accentText,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
