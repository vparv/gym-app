import * as React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { theme } from '../theme';
import type { ExerciseLog, ExerciseLogDraft, ExerciseSetDraft, PlannedExercise } from '../types';

type ExerciseCardProps = {
  exercise: PlannedExercise;
  focus: string;
  mode: 'review' | 'active' | 'summary';
  draft?: ExerciseLogDraft;
  autoSaveState?: 'saving' | 'saved' | 'error';
  latestLog?: ExerciseLog;
  sessionLog?: ExerciseLog;
  isNextUp?: boolean;
  onDraftChange?: (draft: ExerciseLogDraft) => void;
  onPlayVideo: (label: string, url: string, notes: string) => void;
  onOpenUrl?: (url: string) => void;
  onStartLog?: (optionKey: string) => void;
  onSkipExercise?: (optionKey: string) => void;
  onCancelEdit?: () => void;
  onEditLog?: () => void;
  onRemoveLog?: () => void;
  showInlineLogger?: boolean;
};

export function ExerciseCard({
  exercise,
  focus,
  mode,
  draft,
  autoSaveState,
  latestLog,
  sessionLog,
  isNextUp = false,
  onDraftChange,
  onPlayVideo,
  onStartLog,
  onSkipExercise,
  onCancelEdit,
  onEditLog,
  onRemoveLog,
  showInlineLogger = false,
}: ExerciseCardProps) {
  const { width } = useWindowDimensions();
  const [metaGridWidth, setMetaGridWidth] = React.useState(0);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [previewOptionKey, setPreviewOptionKey] = React.useState(
    sessionLog?.performedOptionKey ?? draft?.selectedOptionKey ?? exercise.defaultOptionKey
  );
  const isCompact = width < 390;
  const metaGridGap = 10;
  const useTwoColumnMeta = metaGridWidth > 0 ? metaGridWidth >= 260 : width >= 320;
  const metaCardWidth = useTwoColumnMeta && metaGridWidth > 0 ? (metaGridWidth - metaGridGap) / 2 : undefined;
  const selectedOptionKey =
    draft?.selectedOptionKey ?? sessionLog?.performedOptionKey ?? previewOptionKey;
  const selectedOption =
    exercise.options.find((option) => option.key === selectedOptionKey) ?? exercise.options[0];
  const historyLog = latestLog && latestLog.id !== sessionLog?.id ? latestLog : undefined;
  const isEditing = Boolean(draft);
  const isSkippedSessionLog = Boolean(sessionLog && sessionLog.setLogs.length === 0);
  const canPreviewOptions = !draft && !sessionLog;
  const shouldShowCompactHandledState =
    mode === 'active' && Boolean(sessionLog) && !isEditing && !isExpanded;
  const alternativeOptions = exercise.options.filter((option) => option.key !== selectedOption.key);

  React.useEffect(() => {
    if (draft?.selectedOptionKey) {
      setPreviewOptionKey(draft.selectedOptionKey);
    }
  }, [draft?.selectedOptionKey]);

  React.useEffect(() => {
    if (sessionLog?.performedOptionKey) {
      setPreviewOptionKey(sessionLog.performedOptionKey);
    }
  }, [sessionLog?.performedOptionKey]);

  React.useEffect(() => {
    if (draft) {
      setIsExpanded(true);
    }
  }, [draft]);

  React.useEffect(() => {
    if (mode === 'active' && sessionLog && !draft) {
      setIsExpanded(false);
    }
  }, [draft, mode, sessionLog?.id, sessionLog?.loggedAt]);

  if (shouldShowCompactHandledState && sessionLog) {
    const content = (
      <>
        <View style={styles.compactLoggedHeader}>
          <View style={styles.compactLoggedCopy}>
            <Text style={[styles.compactLoggedTitle, isCompact ? styles.compactLoggedTitleCompact : undefined]}>
              {sessionLog.performedOptionLabel}
            </Text>
            <Text style={styles.compactLoggedSubtitle}>
              {isSkippedSessionLog
                ? 'Skipped for this workout. Tap to reopen details.'
                : 'Logged in this workout. Tap to reopen details.'}
            </Text>
          </View>

          <Text style={isSkippedSessionLog ? styles.skippedBadge : styles.loggedBadge}>
            {isSkippedSessionLog ? 'Skipped' : 'Logged'}
          </Text>
        </View>

        {isSkippedSessionLog ? (
          <View style={styles.compactLoggedSetRow}>
            <Text style={styles.compactLoggedSetLabel}>Session status</Text>
            <Text style={styles.compactLoggedSetValue}>Skipped</Text>
          </View>
        ) : (
          <View style={styles.compactLoggedSetList}>
            {sessionLog.setLogs.map((setLog) => (
              <View key={setLog.setNumber} style={styles.compactLoggedSetRow}>
                <Text style={styles.compactLoggedSetLabel}>Set {setLog.setNumber}</Text>
                <Text style={styles.compactLoggedSetValue}>{formatCompactSetSummary(setLog)}</Text>
              </View>
            ))}
          </View>
        )}
      </>
    );

    return (
      <Pressable
        onPress={() => setIsExpanded(true)}
        style={({ pressed }) => [
          styles.card,
          styles.compactLoggedCard,
          isCompact ? styles.cardCompact : undefined,
          pressed ? styles.compactLoggedCardPressed : undefined,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, isCompact ? styles.cardCompact : undefined]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, isCompact ? styles.titleCompact : undefined]}>
              {selectedOption.label}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => onPlayVideo(selectedOption.label, selectedOption.videoUrl, exercise.notes)}
              style={styles.playButton}
            >
              <Text style={styles.playButtonText}>Play video</Text>
            </Pressable>
          </View>
        </View>

        {(mode === 'active' && sessionLog && !isEditing) ||
        (mode === 'active' && !sessionLog && isNextUp) ||
        (mode === 'summary' && sessionLog) ? (
          <View style={styles.headerBadges}>
            {mode === 'active' && sessionLog && !isEditing ? (
              <Text style={isSkippedSessionLog ? styles.skippedBadge : styles.loggedBadge}>
                {isSkippedSessionLog ? 'Skipped this workout' : 'Logged this workout'}
              </Text>
            ) : null}
            {mode === 'active' && !sessionLog && isNextUp ? (
              <Text style={styles.nextBadge}>Up next</Text>
            ) : null}
            {mode === 'summary' && sessionLog ? (
              <Text style={isSkippedSessionLog ? styles.skippedBadge : styles.loggedBadge}>
                {isSkippedSessionLog ? 'Skipped' : 'Completed'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {alternativeOptions.length ? (
        <View style={styles.optionsRow}>
          {alternativeOptions.map((option) => (
            <Pressable
              key={option.key}
              disabled={!canPreviewOptions}
              onPress={() => setPreviewOptionKey(option.key)}
              style={[styles.optionChip, !canPreviewOptions ? styles.optionChipDisabled : undefined]}
            >
              <Text numberOfLines={2} style={styles.optionValue}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

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
            {isSkippedSessionLog
              ? 'Skipped in this workout'
              : mode === 'summary'
                ? 'Completed in this workout'
                : 'Logged in this workout'}
          </Text>
          <Text style={styles.historyDate}>
            {formatLogDate(sessionLog.loggedAt)} · {sessionLog.performedOptionLabel}
          </Text>
          <Text style={styles.historyBody}>
            {isSkippedSessionLog
              ? 'This exercise is marked as skipped for the current session.'
              : formatSetSummary(sessionLog)}
          </Text>
          {!isSkippedSessionLog && sessionLog.exerciseNote ? (
            <Text style={styles.historyNote}>Note: {sessionLog.exerciseNote}</Text>
          ) : null}

          {mode === 'active' && !isEditing ? (
            <View style={styles.sessionActionRow}>
              <Pressable onPress={onEditLog} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>
                  {isSkippedSessionLog ? 'Log instead' : 'Edit log'}
                </Text>
              </Pressable>

              <Pressable onPress={onRemoveLog} style={styles.inlineButtonDanger}>
                <Text style={styles.inlineButtonDangerText}>
                  {isSkippedSessionLog ? 'Undo skip' : 'Clear entry'}
                </Text>
              </Pressable>

              <Pressable onPress={() => setIsExpanded(false)} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Back to summary</Text>
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

      {mode === 'active' && draft && onDraftChange && showInlineLogger ? (
        <ExerciseLogger
          exercise={exercise}
          draft={draft}
          autoSaveState={autoSaveState}
          isEditingExistingLog={Boolean(sessionLog)}
          onDraftChange={onDraftChange}
          onCancel={onCancelEdit}
        />
      ) : null}

      {!sessionLog && !isEditing ? (
        <View style={styles.footerActionRow}>
          {mode === 'active' ? (
            <Pressable onPress={() => onSkipExercise?.(selectedOption.key)} style={styles.footerSkipButton}>
              <Text style={styles.footerSkipButtonText}>Skip</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => onStartLog?.(selectedOption.key)} style={styles.footerStartButton}>
            <Text style={styles.footerStartButtonText}>Start</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ExerciseLogger({
  exercise,
  draft,
  autoSaveState,
  isEditingExistingLog,
  onDraftChange,
  onCancel,
}: {
  exercise: PlannedExercise;
  draft: ExerciseLogDraft;
  autoSaveState?: 'saving' | 'saved' | 'error';
  isEditingExistingLog: boolean;
  onDraftChange: (draft: ExerciseLogDraft) => void;
  onCancel?: () => void;
}) {
  const currentSetLog = draft.setLogs[draft.setLogs.length - 1];
  const startedSetCount = draft.setLogs.filter(isStartedSet).length;
  const hasIncompleteStartedSet = draft.setLogs.some(
    (setLog) => isStartedSet(setLog) && setLog.weight.trim().length === 0
  );
  const canAddAnotherSet = Boolean(currentSetLog) && currentSetLog.weight.trim().length > 0;
  const canRemoveEmptySet =
    draft.setLogs.length > 1 &&
    currentSetLog.weight.trim().length === 0 &&
    currentSetLog.repsCompleted.trim().length === 0;
  const statusMessage =
    startedSetCount === 0
      ? 'Changes save automatically after you log your first complete set.'
      : hasIncompleteStartedSet
        ? 'Changes save automatically as soon as every started set has a weight.'
        : autoSaveState === 'saving'
          ? 'Saving changes...'
          : autoSaveState === 'error'
            ? 'Could not save the latest changes. Keep editing to retry.'
            : autoSaveState === 'saved'
              ? 'Changes saved automatically.'
              : 'Changes save automatically.';

  return (
    <View style={styles.logger}>
      <Text style={styles.loggerTitle}>{isEditingExistingLog ? 'Edit this exercise' : 'Log working sets'}</Text>
      <Text style={styles.loggerSubtitle}>{statusMessage}</Text>

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

      <View style={styles.setList}>
        {draft.setLogs.map((setLog, index) => (
          <SetRow
            key={setLog.setNumber}
            setLog={setLog}
            canRemove={draft.setLogs.length > 1}
            canDuplicate={isStartedSet(setLog)}
            onChange={(nextSetLog) => {
              const nextSetLogs = draft.setLogs.map((draftSetLog, draftIndex) =>
                draftIndex === index ? nextSetLog : draftSetLog
              );

              onDraftChange({
                ...draft,
                setLogs: nextSetLogs,
              });
            }}
            onRemove={() =>
              onDraftChange({
                ...draft,
                setLogs: renumberSetLogs(
                  draft.setLogs.filter((_, draftIndex) => draftIndex !== index)
                ),
              })
            }
            onDuplicate={() =>
              onDraftChange({
                ...draft,
                setLogs: renumberSetLogs([
                  ...draft.setLogs.slice(0, index + 1),
                  { ...setLog },
                  ...draft.setLogs.slice(index + 1),
                ]),
              })
            }
          />
        ))}
      </View>

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
              <Text style={styles.addSetButtonText}>Add set {draft.setLogs.length + 1}</Text>
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
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Close</Text>
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
  canRemove,
  canDuplicate,
  onChange,
  onRemove,
  onDuplicate,
}: {
  setLog: ExerciseSetDraft;
  canRemove: boolean;
  canDuplicate: boolean;
  onChange: (setLog: ExerciseSetDraft) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  return (
    <View style={styles.setRow}>
      <View style={styles.setRowHeader}>
        <View style={styles.setNumber}>
          <Text style={styles.setNumberText}>Set {setLog.setNumber}</Text>
        </View>

        <View style={styles.setRowActions}>
          {canDuplicate ? (
            <Pressable onPress={onDuplicate} style={styles.completedSetDuplicateButton}>
              <Text style={styles.completedSetDuplicateButtonText}>Duplicate</Text>
            </Pressable>
          ) : null}

          {canRemove ? (
            <Pressable onPress={onRemove} style={styles.completedSetRemoveButton}>
              <Text style={styles.completedSetRemoveButtonText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.setFieldsRow}>
        <View style={styles.setFieldHalf}>
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

        <View style={styles.setFieldHalf}>
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

function formatCompactSetSummary(setLog: ExerciseLog['setLogs'][number]) {
  const reps = setLog.repsCompleted?.trim();

  return reps?.length ? `${reps} reps · ${setLog.weight} lb` : `${setLog.weight} lb`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 22,
    gap: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 6,
  },
  cardCompact: {
    padding: 16,
    gap: 14,
  },
  compactLoggedCard: {
    gap: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  compactLoggedCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  compactLoggedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  compactLoggedCopy: {
    flex: 1,
    gap: 4,
  },
  compactLoggedTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  compactLoggedTitleCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  compactLoggedSubtitle: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  compactLoggedSetList: {
    gap: 8,
  },
  compactLoggedSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactLoggedSetLabel: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compactLoggedSetValue: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  header: {
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  headerTopRowCompact: {
    flexDirection: 'column',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  skippedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceTint,
    color: theme.colors.muted,
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
    letterSpacing: -0.5,
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
  headerActions: {
    flexBasis: '42%',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
  },
  headerActionsCompact: {
    width: '100%',
    minWidth: undefined,
  },
  playButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 9,
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  playButtonText: {
    color: theme.colors.accentText,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  linkButton: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkButtonCompact: {
    alignSelf: 'stretch',
  },
  linkButtonText: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkButtonLegacy: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 8,
  },
  optionChip: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
    gap: 3,
  },
  optionChipDisabled: {
    opacity: 0.72,
  },
  optionValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  optionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionSelectorChip: {
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
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
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
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
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButtonDangerText: {
    color: theme.colors.errorText,
    fontSize: 13,
    fontWeight: '700',
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  footerSkipButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  footerSkipButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerStartButton: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  footerStartButtonText: {
    color: theme.colors.accentText,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  logger: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
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
  completedSetRemoveButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.errorSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completedSetDuplicateButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completedSetDuplicateButtonText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  setRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  setRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
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
  setFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  setFieldHalf: {
    flex: 1,
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
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    color: theme.colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
    borderRadius: theme.radii.lg,
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
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
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
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
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
